import { recordUsage } from "@/lib/usage-tracking";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
export const EMBEDDING_DIMENSIONS = 1024;

type VoyageInputType = "document" | "query";

type VoyageEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number };
};

/**
 * Voyage rate-limits per minute and returns 429 with a Retry-After header. An
 * account without a payment method is capped at 3 requests per minute, which a
 * batch of writes will hit immediately — so retries are not optional here.
 */
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 5_000;

/**
 * Optional client-side pacing. A Voyage account without a payment method is
 * limited to 3 requests per minute, which no amount of retrying survives —
 * set VOYAGE_MAX_RPM to that ceiling and requests are serialised and spaced
 * instead of hammering the limit. Unset (the default, and what production
 * should run) requests are issued immediately and concurrently.
 */
const MAX_RPM = Number(process.env.VOYAGE_MAX_RPM ?? 0);

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function paced<T>(fn: () => Promise<T>): Promise<T> {
  if (!MAX_RPM || MAX_RPM <= 0) return fn();

  const minIntervalMs = 60_000 / MAX_RPM;
  const run = queue.then(async () => {
    const wait = lastRequestAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  // Exponential with jitter, so parallel callers don't retry in lockstep.
  return BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 500;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function embedBatch(texts: string[], inputType: VoyageInputType): Promise<number[][]> {
  if (texts.length === 0) return Promise.resolve([]);
  return paced(() => embedBatchNow(texts, inputType));
}

async function embedBatchNow(texts: string[], inputType: VoyageInputType): Promise<number[][]> {

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
    });

    if (response.status === 429 || response.status >= 500) {
      const body = await response.text();
      lastError = new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
      if (attempt === MAX_ATTEMPTS - 1) break;
      await sleep(backoffMs(attempt, response.headers.get("retry-after")));
      continue;
    }

    if (!response.ok) {
      // 4xx other than 429 is a request problem — retrying cannot fix it.
      throw new Error(`Voyage embeddings request failed (${response.status}): ${await response.text()}`);
    }

    const json = (await response.json()) as VoyageEmbeddingsResponse;

    recordUsage({ provider: "voyage", operation: inputType, totalTokens: json.usage?.total_tokens });

    // Voyage may return results out of order; `index` maps each back to its input.
    const ordered: number[][] = new Array(texts.length);
    for (const item of json.data) ordered[item.index] = item.embedding;

    const missing = ordered.findIndex((embedding) => !embedding);
    if (missing !== -1) {
      throw new Error(`Voyage embeddings response was missing an embedding for input ${missing}`);
    }
    return ordered;
  }

  throw lastError ?? new Error("Voyage embeddings request failed");
}

/** Embed memory content at write time (remember()). */
export async function embedDocument(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], "document");
  return embedding;
}

/**
 * Embed several memories in one request. One remember() call should make one
 * embedding request no matter how many candidates it extracted.
 */
export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embedBatch(texts, "document");
}

/** Embed a search query at read time (recall()) — asymmetric mode. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], "query");
  return embedding;
}
