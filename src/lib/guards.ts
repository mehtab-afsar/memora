import { createHash } from "node:crypto";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRequests, idempotencyKeys, rateLimitWindows } from "@/db/schema";
import {
  billingPeriodStart,
  isOverQuota,
  limitsFor,
  quotaFor,
  rateLimitWindowStart,
  secondsUntilWindowReset,
  type PlanName,
  type QuotaKind,
} from "@/lib/plans";

/**
 * The guards every `/api/v1` request passes through before it reaches an
 * engine: scope, rate limit, monthly quota, and idempotency.
 *
 * All four are enforced in Postgres. Counting in the database rather than in
 * process memory is what makes a limit real once there is more than one server
 * — an in-memory counter multiplies the limit by the number of instances, which
 * is the same as not having one.
 */

const RATE_LIMIT_WINDOW_MS = 60_000;

export type Scope = "read" | "write";

// -- scope -------------------------------------------------------------------

export function hasScope(granted: Scope[], required: Scope): boolean {
  return granted.includes(required);
}

// -- rate limiting -----------------------------------------------------------

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window counter. One upsert per request, returning the new count in the
 * same round trip — the increment and the check cannot race because they are
 * the same statement.
 *
 * A fixed window admits a burst across a boundary (up to 2x the limit in the
 * worst case). That is a known and acceptable property here: the limit exists
 * to stop a runaway retry loop, not to shape traffic precisely.
 */
export async function consumeRateLimit(
  apiKeyId: string,
  plan: PlanName,
  now = new Date()
): Promise<RateLimitResult> {
  const limit = limitsFor(plan).requestsPerMinute;
  const windowStart = rateLimitWindowStart(now, RATE_LIMIT_WINDOW_MS);

  const [row] = await db
    .insert(rateLimitWindows)
    .values({ apiKeyId, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitWindows.apiKeyId, rateLimitWindows.windowStart],
      set: { count: sql`${rateLimitWindows.count} + 1` },
    })
    .returning({ count: rateLimitWindows.count });

  const used = row?.count ?? 1;
  return {
    allowed: used <= limit,
    limit,
    remaining: Math.max(0, limit - used),
    retryAfterSeconds: secondsUntilWindowReset(now, RATE_LIMIT_WINDOW_MS),
  };
}

/** Deletes counters for windows that have already closed. */
export async function pruneRateLimitWindows(now = new Date()): Promise<number> {
  const cutoff = new Date(rateLimitWindowStart(now, RATE_LIMIT_WINDOW_MS).getTime() - RATE_LIMIT_WINDOW_MS);
  const deleted = await db.delete(rateLimitWindows).where(sql`${rateLimitWindows.windowStart} < ${cutoff}`).returning({
    apiKeyId: rateLimitWindows.apiKeyId,
  });
  return deleted.length;
}

// -- monthly quota -----------------------------------------------------------

export type QuotaResult = { allowed: boolean; used: number; quota: number | null };

/**
 * Counts billable requests this calendar month for the organization. Reads the
 * request log rather than deriving from memories, so a write that extracted
 * nothing still counts — it cost a model call either way.
 */
export async function checkQuota(
  orgId: string,
  plan: PlanName,
  kind: QuotaKind,
  now = new Date()
): Promise<QuotaResult> {
  const quota = quotaFor(plan, kind);
  if (quota === null) return { allowed: true, used: 0, quota: null };

  const [row] = await db
    .select({ total: count() })
    .from(apiRequests)
    .where(
      and(
        eq(apiRequests.orgId, orgId),
        eq(apiRequests.kind, kind),
        gte(apiRequests.createdAt, billingPeriodStart(now))
      )
    );

  const used = row?.total ?? 0;
  return { allowed: !isOverQuota(plan, kind, used), used, quota };
}

export async function recordRequest(params: {
  orgId: string;
  projectId: string;
  environmentId: string;
  apiKeyId: string;
  kind: QuotaKind;
  route: string;
  statusCode: number;
}): Promise<void> {
  await db.insert(apiRequests).values(params);
}

// -- idempotency -------------------------------------------------------------

export function hashRequest(method: string, path: string, body: string): string {
  return createHash("sha256").update(`${method} ${path} ${body}`).digest("hex");
}

export type StoredResponse = { statusCode: number; body: string };

/**
 * Returns a previously stored response for this key, or null.
 *
 * Throws when the same key arrives with a different request body: replaying a
 * key against changed content is a client bug, and answering it with the old
 * response would hide the bug behind a plausible success.
 */
export async function lookupIdempotent(
  apiKeyId: string,
  key: string,
  requestHash: string
): Promise<StoredResponse | null> {
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.apiKeyId, apiKeyId), eq(idempotencyKeys.key, key)))
    .limit(1);

  if (!existing) return null;
  if (existing.requestHash !== requestHash) {
    throw new IdempotencyConflict(key);
  }
  return { statusCode: existing.statusCode, body: existing.responseBody };
}

export class IdempotencyConflict extends Error {
  constructor(key: string) {
    super(`Idempotency-Key "${key}" was already used with a different request body`);
    this.name = "IdempotencyConflict";
  }
}

export async function storeIdempotent(
  apiKeyId: string,
  key: string,
  requestHash: string,
  response: StoredResponse
): Promise<void> {
  await db
    .insert(idempotencyKeys)
    .values({
      apiKeyId,
      key,
      requestHash,
      statusCode: response.statusCode,
      responseBody: response.body,
    })
    // Two concurrent replays of the same key: the first write wins, the second
    // is a no-op, and both callers get the same body.
    .onConflictDoNothing();
}

/** Idempotency records older than this are dropped. Stripe uses 24 hours. */
export const IDEMPOTENCY_RETENTION_HOURS = 24;

export async function pruneIdempotencyKeys(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - IDEMPOTENCY_RETENTION_HOURS * 3600_000);
  const deleted = await db
    .delete(idempotencyKeys)
    .where(sql`${idempotencyKeys.createdAt} < ${cutoff}`)
    .returning({ id: idempotencyKeys.id });
  return deleted.length;
}
