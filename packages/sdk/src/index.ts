/**
 * Memora — TypeScript client.
 *
 * Every method maps to one `/api/v1` route. No dependencies: `fetch` is used
 * directly, so this runs in Node 18+, Bun, Deno, Cloudflare Workers and the
 * browser — though an environment-scoped API key belongs on a server, never in
 * a browser bundle.
 */

export type MemoryType =
  | "preference"
  | "fact"
  | "goal"
  | "relationship"
  | "event"
  | "instruction"
  | "decision"
  | "context";

export type MemoryStatus = "active" | "stale" | "superseded" | "archived" | "flagged";

export type RememberOutcome = {
  candidateContent: string;
  decision: "ADD" | "UPDATE" | "MERGE" | "IGNORE" | "FLAG";
  memoryId: string | null;
  reasoning: string;
  /**
   * Writes are append-only and judged afterwards. "pending" means this memory
   * has not yet been compared against existing ones, so its version links and
   * contradiction flags are still to come.
   */
  reconciliation?: "pending" | "done";
};

export type RecalledMemory = {
  memoryId: string;
  content: string;
  type: MemoryType;
  similarity: number;
  confidence: number;
  freshness: number;
  relevanceScore: number;
  /**
   * "flagged" means this memory contradicts another and neither is settled —
   * show the conflict rather than treating it as fact.
   */
  status: MemoryStatus;
  /** Which retrieval pass found it: semantic, keyword, or both. */
  matchedOn: "both" | "meaning" | "keyword";
  /**
   * Earlier versions of this same fact, newest first — what used to be true
   * before this version replaced it. Empty for a memory that never changed.
   */
  history: { content: string; supersededAt: string }[];
  /** Plain-English account of why this was returned. */
  reason: string;
};

/** A synthesis of everything known about one user. Null until enough is known. */
export type UserProfile = {
  content: string;
  /** ISO timestamp of when it was last rebuilt. */
  generatedAt: string;
  /** How many memories it was built from. */
  memoryCount: number;
};

export type Memory = {
  id: string;
  endUserId: string;
  agentId: string | null;
  sessionId: string | null;
  content: string;
  type: MemoryType;
  status: MemoryStatus;
  confidence: number;
  importance: number;
  createdAt: string;
  updatedAt: string;
  lastConfirmedAt: string;
  reconciledAt: string | null;
};

export type Experience = {
  id: string;
  task: string;
  action: string;
  context: string | null;
  outcome: "success" | "failure";
  cause: string | null;
  resolution: string | null;
  lesson: string;
  createdAt: string;
};

/** What {@link Memora.exportUser} returns: everything held about one end user. */
export type UserExport = {
  userId: string;
  exportedAt: string;
  profile: { content: string; generatedAt: string; memoryCount: number } | null;
  memories: {
    id: string;
    content: string;
    type: MemoryType;
    status: MemoryStatus;
    confidence: number;
    importance: number;
    agentId: string | null;
    sessionId: string | null;
    source: { type: string; id: string | null };
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    lastConfirmedAt: string;
    supersedesId: string | null;
    evidence: {
      excerpt: string;
      eventType: string;
      reasoning: string | null;
      source: { type: string; id: string | null };
      createdAt: string;
    }[];
  }[];
};

export type RememberParams = {
  userId: string;
  content: string;
  agentId?: string;
  sessionId?: string;
  source?: { type: string; id?: string };
  /**
   * Send the same key to retry a write safely: the original response comes
   * back instead of a second set of memories. Reusing a key with different
   * content is rejected with 409 rather than silently answered.
   */
  idempotencyKey?: string;
};

export type RecallParams = {
  userId: string;
  query: string;
  topK?: number;
  types?: MemoryType[];
  minConfidence?: number;
  since?: Date | string;
  until?: Date | string;
  agentId?: string;
  sessionId?: string;
};

export type MemoraOptions = {
  apiKey: string;
  /** Defaults to the hosted API. Point this at your own deployment if self-hosting. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30s. */
  timeoutMs?: number;
  /** Retries for timeouts, 429s and 5xx. Default 2. */
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
};

/** Thrown for any non-2xx response. `status` distinguishes retryable from not. */
export class MemoraError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** Seconds to wait before retrying, when the server said. */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, message: string, body: unknown, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "MemoraError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** 401/403: the API key is missing, wrong, revoked, or lacks the scope. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** 429: too many requests this minute. Retried automatically. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /**
   * 402: the plan's monthly quota is spent. Never retried — waiting does not
   * fix it, and hammering a paywall is how a client burns its rate limit too.
   */
  get isQuotaExceeded(): boolean {
    return this.status === 402;
  }
}

const DEFAULT_BASE_URL = "https://api.memora.dev";
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

export class Memora {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: MemoraOptions) {
    if (!options.apiKey) throw new Error("Memora: apiKey is required");
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  // -- memories ------------------------------------------------------------

  /**
   * Write what a user said. Memora extracts the durable facts from it, stores
   * them, and judges them against what it already knows in the background.
   */
  async remember(params: RememberParams): Promise<{ outcomes: RememberOutcome[] }> {
    return this.#request(
      "POST",
      "/api/v1/memories/remember",
      {
        user_id: params.userId,
        content: params.content,
        agent_id: params.agentId,
        session_id: params.sessionId,
        source: params.source,
      },
      params.idempotencyKey
    );
  }

  /**
   * Retrieve the memories relevant to a query, ranked and explained — plus a
   * short profile of the user, once enough is known to be worth summarising.
   * Put the profile in your system prompt for the shape of the person, and the
   * ranked memories for the specifics.
   */
  async recall(params: RecallParams): Promise<{ results: RecalledMemory[]; profile: UserProfile | null }> {
    return this.#request("POST", "/api/v1/memories/recall", {
      user_id: params.userId,
      query: params.query,
      top_k: params.topK,
      type: params.types,
      min_confidence: params.minConfidence,
      since: toIso(params.since),
      until: toIso(params.until),
      agent_id: params.agentId,
      session_id: params.sessionId,
    });
  }

  async list(params: {
    userId?: string;
    status?: MemoryStatus;
    type?: MemoryType;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ memories: Memory[]; total: number; limit: number; offset: number }> {
    return this.#request("GET", `/api/v1/memories${query({
      user_id: params.userId,
      status: params.status,
      type: params.type,
      limit: params.limit,
      offset: params.offset,
    })}`);
  }

  /** A memory's full evidence trail and version history. */
  async explain(memoryId: string): Promise<unknown> {
    return this.#request("GET", `/api/v1/memories/${encodeURIComponent(memoryId)}/explain`);
  }

  /** Re-assess a memory's confidence given its age and evidence. */
  async verify(memoryId: string): Promise<unknown> {
    return this.#request("POST", `/api/v1/memories/${encodeURIComponent(memoryId)}/verify`);
  }

  async update(
    memoryId: string,
    patch: { content?: string; confidence?: number; importance?: number }
  ): Promise<{ memory: Memory }> {
    return this.#request("PATCH", `/api/v1/memories/${encodeURIComponent(memoryId)}`, patch);
  }

  /** Archive a memory. Nothing is destroyed — the record stays auditable. */
  async forget(memoryId: string): Promise<{ memory: Memory }> {
    return this.#request("DELETE", `/api/v1/memories/${encodeURIComponent(memoryId)}`);
  }

  /** Archive everything held for one end user. Reversible; nothing is destroyed. */
  async forgetUser(userId: string): Promise<{ archived: number }> {
    return this.#request("DELETE", `/api/v1/memories${query({ user_id: userId })}`);
  }

  /**
   * Everything held about one end user, including archived and superseded
   * memories and the excerpts they were learned from. What you send someone
   * who asks what you have on them.
   */
  async exportUser(userId: string): Promise<UserExport> {
    return this.#request("GET", `/api/v1/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Permanently destroys everything held about one end user. Unlike
   * {@link forgetUser}, this cannot be undone — it is the erasure operation, for
   * answering a right-to-be-forgotten request rather than tidying up.
   *
   * Returns a `subjectHash` you can keep as proof the request was actioned.
   */
  async eraseUser(userId: string): Promise<{
    erased: true;
    memoriesErased: number;
    profilesErased: number;
    subjectHash: string;
  }> {
    return this.#request("DELETE", `/api/v1/users/${encodeURIComponent(userId)}?confirm=erase`);
  }

  /** Permanently destroys one memory, rather than archiving it. */
  async eraseMemory(memoryId: string): Promise<{ erased: true; id: string }> {
    return this.#request("DELETE", `/api/v1/memories/${encodeURIComponent(memoryId)}?confirm=erase`);
  }

  // -- experiences ---------------------------------------------------------

  readonly experiences = {
    record: (params: {
      task: string;
      action: string;
      outcome: "success" | "failure";
      context?: string;
      cause?: string;
      resolution?: string;
      lesson?: string;
      source?: { type: string; id?: string };
    }): Promise<{ experience: Experience }> =>
      this.#request("POST", "/api/v1/experiences/record", params),

    recall: (params: { query: string; topK?: number }): Promise<{ results: unknown[] }> =>
      this.#request("POST", "/api/v1/experiences/recall", {
        query: params.query,
        top_k: params.topK,
      }),

    /** What prior attempts suggest for a task, or nulls when nothing is relevant. */
    recommend: (task: string): Promise<{
      recommendation: string | null;
      confidence: number | null;
      reasoning: string | null;
      supportingExperiences: unknown[];
    }> => this.#request("POST", "/api/v1/experiences/recommend", { task }),

    list: (params: { limit?: number; offset?: number } = {}): Promise<{
      experiences: Experience[];
      total: number;
    }> => this.#request("GET", `/api/v1/experiences${query(params)}`),
  };

  // -- transport -----------------------------------------------------------

  async #request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

      try {
        const response = await this.#fetch(`${this.#baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(stripUndefined(body)),
          signal: controller.signal,
        });

        if (response.ok) return (await response.json()) as T;

        const payload = await response.json().catch(() => null);
        const message =
          (payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : null) ?? `Memora request failed with ${response.status}`;
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
        const error = new MemoraError(
          response.status,
          message,
          payload,
          Number.isFinite(retryAfter) ? retryAfter : null
        );

        if (!RETRYABLE.has(response.status) || attempt === this.#maxRetries) throw error;
        lastError = error;

        // Honour the server's own backoff when it gives one, rather than
        // guessing an interval that keeps the limit saturated.
        if (error.retryAfterSeconds !== null) {
          await sleep(error.retryAfterSeconds * 1000);
          continue;
        }
      } catch (error) {
        // Abort and network errors are worth retrying; a MemoraError has already
        // been filtered above for whether it is.
        if (error instanceof MemoraError && !RETRYABLE.has(error.status)) throw error;
        if (attempt === this.#maxRetries) throw error;
        lastError = error;
      } finally {
        clearTimeout(timer);
      }

      await sleep(250 * 2 ** attempt + Math.random() * 100);
    }

    throw lastError;
  }
}

function toIso(value: Date | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : "";
}

function stripUndefined(body: unknown): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return body;
  return Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([, v]) => v !== undefined));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default Memora;
