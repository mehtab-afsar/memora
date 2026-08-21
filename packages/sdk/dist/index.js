/**
 * Memora — TypeScript client.
 *
 * Every method maps to one `/api/v1` route. No dependencies: `fetch` is used
 * directly, so this runs in Node 18+, Bun, Deno, Cloudflare Workers and the
 * browser — though an environment-scoped API key belongs on a server, never in
 * a browser bundle.
 */
/** Thrown for any non-2xx response. `status` distinguishes retryable from not. */
export class MemoraError extends Error {
    status;
    body;
    /** Seconds to wait before retrying, when the server said. */
    retryAfterSeconds;
    constructor(status, message, body, retryAfterSeconds = null) {
        super(message);
        this.name = "MemoraError";
        this.status = status;
        this.body = body;
        this.retryAfterSeconds = retryAfterSeconds;
    }
    /** 401/403: the API key is missing, wrong, revoked, or lacks the scope. */
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
    /** 429: too many requests this minute. Retried automatically. */
    get isRateLimited() {
        return this.status === 429;
    }
    /**
     * 402: the plan's monthly quota is spent. Never retried — waiting does not
     * fix it, and hammering a paywall is how a client burns its rate limit too.
     */
    get isQuotaExceeded() {
        return this.status === 402;
    }
}
const DEFAULT_BASE_URL = "https://api.memora.dev";
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
export class Memora {
    #apiKey;
    #baseUrl;
    #timeoutMs;
    #maxRetries;
    #fetch;
    constructor(options) {
        if (!options.apiKey)
            throw new Error("Memora: apiKey is required");
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
    async remember(params) {
        return this.#request("POST", "/api/v1/memories/remember", {
            user_id: params.userId,
            content: params.content,
            agent_id: params.agentId,
            session_id: params.sessionId,
            source: params.source,
        }, params.idempotencyKey);
    }
    /**
     * Retrieve the memories relevant to a query, ranked and explained — plus a
     * short profile of the user, once enough is known to be worth summarising.
     * Put the profile in your system prompt for the shape of the person, and the
     * ranked memories for the specifics.
     */
    async recall(params) {
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
    async list(params = {}) {
        return this.#request("GET", `/api/v1/memories${query({
            user_id: params.userId,
            status: params.status,
            type: params.type,
            limit: params.limit,
            offset: params.offset,
        })}`);
    }
    /** A memory's full evidence trail and version history. */
    async explain(memoryId) {
        return this.#request("GET", `/api/v1/memories/${encodeURIComponent(memoryId)}/explain`);
    }
    /** Re-assess a memory's confidence given its age and evidence. */
    async verify(memoryId) {
        return this.#request("POST", `/api/v1/memories/${encodeURIComponent(memoryId)}/verify`);
    }
    async update(memoryId, patch) {
        return this.#request("PATCH", `/api/v1/memories/${encodeURIComponent(memoryId)}`, patch);
    }
    /** Archive a memory. Nothing is destroyed — the record stays auditable. */
    async forget(memoryId) {
        return this.#request("DELETE", `/api/v1/memories/${encodeURIComponent(memoryId)}`);
    }
    /** Archive everything held for one end user. */
    async forgetUser(userId) {
        return this.#request("DELETE", `/api/v1/memories${query({ user_id: userId })}`);
    }
    // -- experiences ---------------------------------------------------------
    experiences = {
        record: (params) => this.#request("POST", "/api/v1/experiences/record", params),
        recall: (params) => this.#request("POST", "/api/v1/experiences/recall", {
            query: params.query,
            top_k: params.topK,
        }),
        /** What prior attempts suggest for a task, or nulls when nothing is relevant. */
        recommend: (task) => this.#request("POST", "/api/v1/experiences/recommend", { task }),
        list: (params = {}) => this.#request("GET", `/api/v1/experiences${query(params)}`),
    };
    // -- transport -----------------------------------------------------------
    async #request(method, path, body, idempotencyKey) {
        let lastError;
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
                if (response.ok)
                    return (await response.json());
                const payload = await response.json().catch(() => null);
                const message = (payload && typeof payload === "object" && "error" in payload
                    ? String(payload.error)
                    : null) ?? `Memora request failed with ${response.status}`;
                const retryAfterHeader = response.headers.get("retry-after");
                const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
                const error = new MemoraError(response.status, message, payload, Number.isFinite(retryAfter) ? retryAfter : null);
                if (!RETRYABLE.has(response.status) || attempt === this.#maxRetries)
                    throw error;
                lastError = error;
                // Honour the server's own backoff when it gives one, rather than
                // guessing an interval that keeps the limit saturated.
                if (error.retryAfterSeconds !== null) {
                    await sleep(error.retryAfterSeconds * 1000);
                    continue;
                }
            }
            catch (error) {
                // Abort and network errors are worth retrying; a MemoraError has already
                // been filtered above for whether it is.
                if (error instanceof MemoraError && !RETRYABLE.has(error.status))
                    throw error;
                if (attempt === this.#maxRetries)
                    throw error;
                lastError = error;
            }
            finally {
                clearTimeout(timer);
            }
            await sleep(250 * 2 ** attempt + Math.random() * 100);
        }
        throw lastError;
    }
}
function toIso(value) {
    if (value === undefined)
        return undefined;
    return value instanceof Date ? value.toISOString() : value;
}
function query(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null)
            search.set(key, String(value));
    }
    const rendered = search.toString();
    return rendered ? `?${rendered}` : "";
}
function stripUndefined(body) {
    if (body === null || typeof body !== "object" || Array.isArray(body))
        return body;
    return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export default Memora;
