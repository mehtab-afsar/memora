/**
 * Memora — TypeScript client.
 *
 * Every method maps to one `/api/v1` route. No dependencies: `fetch` is used
 * directly, so this runs in Node 18+, Bun, Deno, Cloudflare Workers and the
 * browser — though an environment-scoped API key belongs on a server, never in
 * a browser bundle.
 */
export type MemoryType = "preference" | "fact" | "goal" | "relationship" | "event" | "instruction" | "decision" | "context";
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
    history: {
        content: string;
        supersededAt: string;
    }[];
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
    profile: {
        content: string;
        generatedAt: string;
        memoryCount: number;
    } | null;
    memories: {
        id: string;
        content: string;
        type: MemoryType;
        status: MemoryStatus;
        confidence: number;
        importance: number;
        agentId: string | null;
        sessionId: string | null;
        source: {
            type: string;
            id: string | null;
        };
        metadata: Record<string, unknown> | null;
        createdAt: string;
        updatedAt: string;
        lastConfirmedAt: string;
        supersedesId: string | null;
        evidence: {
            excerpt: string;
            eventType: string;
            reasoning: string | null;
            source: {
                type: string;
                id: string | null;
            };
            createdAt: string;
        }[];
    }[];
};
export type RememberParams = {
    userId: string;
    content: string;
    agentId?: string;
    sessionId?: string;
    source?: {
        type: string;
        id?: string;
    };
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
export declare class MemoraError extends Error {
    readonly status: number;
    readonly body: unknown;
    /** Seconds to wait before retrying, when the server said. */
    readonly retryAfterSeconds: number | null;
    constructor(status: number, message: string, body: unknown, retryAfterSeconds?: number | null);
    /** 401/403: the API key is missing, wrong, revoked, or lacks the scope. */
    get isAuthError(): boolean;
    /** 429: too many requests this minute. Retried automatically. */
    get isRateLimited(): boolean;
    /**
     * 402: the plan's monthly quota is spent. Never retried — waiting does not
     * fix it, and hammering a paywall is how a client burns its rate limit too.
     */
    get isQuotaExceeded(): boolean;
}
export declare class Memora {
    #private;
    constructor(options: MemoraOptions);
    /**
     * Write what a user said. Memora extracts the durable facts from it, stores
     * them, and judges them against what it already knows in the background.
     */
    remember(params: RememberParams): Promise<{
        outcomes: RememberOutcome[];
    }>;
    /**
     * Retrieve the memories relevant to a query, ranked and explained — plus a
     * short profile of the user, once enough is known to be worth summarising.
     * Put the profile in your system prompt for the shape of the person, and the
     * ranked memories for the specifics.
     */
    recall(params: RecallParams): Promise<{
        results: RecalledMemory[];
        profile: UserProfile | null;
    }>;
    list(params?: {
        userId?: string;
        status?: MemoryStatus;
        type?: MemoryType;
        limit?: number;
        offset?: number;
    }): Promise<{
        memories: Memory[];
        total: number;
        limit: number;
        offset: number;
    }>;
    /** A memory's full evidence trail and version history. */
    explain(memoryId: string): Promise<unknown>;
    /** Re-assess a memory's confidence given its age and evidence. */
    verify(memoryId: string): Promise<unknown>;
    update(memoryId: string, patch: {
        content?: string;
        confidence?: number;
        importance?: number;
    }): Promise<{
        memory: Memory;
    }>;
    /** Archive a memory. Nothing is destroyed — the record stays auditable. */
    forget(memoryId: string): Promise<{
        memory: Memory;
    }>;
    /** Archive everything held for one end user. Reversible; nothing is destroyed. */
    forgetUser(userId: string): Promise<{
        archived: number;
    }>;
    /**
     * Everything held about one end user, including archived and superseded
     * memories and the excerpts they were learned from. What you send someone
     * who asks what you have on them.
     */
    exportUser(userId: string): Promise<UserExport>;
    /**
     * Permanently destroys everything held about one end user. Unlike
     * {@link forgetUser}, this cannot be undone — it is the erasure operation, for
     * answering a right-to-be-forgotten request rather than tidying up.
     *
     * Returns a `subjectHash` you can keep as proof the request was actioned.
     */
    eraseUser(userId: string): Promise<{
        erased: true;
        memoriesErased: number;
        profilesErased: number;
        subjectHash: string;
    }>;
    /** Permanently destroys one memory, rather than archiving it. */
    eraseMemory(memoryId: string): Promise<{
        erased: true;
        id: string;
    }>;
    readonly experiences: {
        record: (params: {
            task: string;
            action: string;
            outcome: "success" | "failure";
            context?: string;
            cause?: string;
            resolution?: string;
            lesson?: string;
            source?: {
                type: string;
                id?: string;
            };
        }) => Promise<{
            experience: Experience;
        }>;
        recall: (params: {
            query: string;
            topK?: number;
        }) => Promise<{
            results: unknown[];
        }>;
        /** What prior attempts suggest for a task, or nulls when nothing is relevant. */
        recommend: (task: string) => Promise<{
            recommendation: string | null;
            confidence: number | null;
            reasoning: string | null;
            supportingExperiences: unknown[];
        }>;
        list: (params?: {
            limit?: number;
            offset?: number;
        }) => Promise<{
            experiences: Experience[];
            total: number;
        }>;
    };
}
export default Memora;
