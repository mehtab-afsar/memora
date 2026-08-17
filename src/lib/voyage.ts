import { recordUsage } from "@/lib/usage-tracking";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
export const EMBEDDING_DIMENSIONS = 1024;

type VoyageInputType = "document" | "query";

type VoyageEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number };
};

async function embed(text: string, inputType: VoyageInputType): Promise<number[]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as VoyageEmbeddingsResponse;

  recordUsage({ provider: "voyage", operation: inputType, totalTokens: json.usage?.total_tokens });

  const embedding = json.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Voyage embeddings response contained no embedding");
  }
  return embedding;
}

/** Embed memory content at write time (remember()). */
export function embedDocument(text: string): Promise<number[]> {
  return embed(text, "document");
}

/** Embed a search query at read time (recall()) — asymmetric mode. */
export function embedQuery(text: string): Promise<number[]> {
  return embed(text, "query");
}
