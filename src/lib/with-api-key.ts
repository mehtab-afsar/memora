import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, environments, organizations, projects } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys";
import { withUsageTracking } from "@/lib/usage-tracking";
import {
  consumeRateLimit,
  checkQuota,
  hashRequest,
  IdempotencyConflict,
  lookupIdempotent,
  recordRequest,
  storeIdempotent,
  type Scope,
} from "@/lib/guards";
import { limitsFor, type PlanName } from "@/lib/plans";

export type ApiKeyContext = {
  orgId: string;
  projectId: string;
  environmentId: string;
  apiKeyId: string;
  plan: PlanName;
  scopes: Scope[];
};

export async function resolveApiKey(request: Request): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice("Bearer ".length).trim();
  if (!key) return null;

  const hash = hashApiKey(key);
  const [row] = await db
    .select({
      apiKeyId: apiKeys.id,
      scopes: apiKeys.scopes,
      environmentId: environments.id,
      projectId: projects.id,
      orgId: projects.orgId,
      plan: organizations.plan,
    })
    .from(apiKeys)
    .innerJoin(environments, eq(apiKeys.environmentId, environments.id))
    .innerJoin(projects, eq(environments.projectId, projects.id))
    .innerJoin(organizations, eq(projects.orgId, organizations.id))
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  // Fire-and-forget usage tracking — must not block or fail the request.
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.apiKeyId));

  return {
    orgId: row.orgId,
    projectId: row.projectId,
    environmentId: row.environmentId,
    apiKeyId: row.apiKeyId,
    plan: row.plan,
    scopes: row.scopes as Scope[],
  };
}

export type GuardOptions = {
  /** Which scope the key needs. Also decides which quota the call counts against. */
  scope: Scope;
  /** Route name for the request log. Defaults to the URL path. */
  route?: string;
};

function error(status: number, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return Response.json({ error: message, ...extra }, { status, headers });
}

/**
 * Wraps an API route with everything that has to be true before an engine runs:
 *
 *   authenticated -> in scope -> under its rate limit -> within its monthly
 *   quota -> not a replay of a request already answered
 *
 * Order matters. Rate limiting comes before quota because a runaway client
 * should be stopped by the cheap check, and both come before idempotency so a
 * flood of replays cannot bypass either.
 */
export async function withApiKey(
  request: Request,
  optionsOrHandler: GuardOptions | ((ctx: ApiKeyContext) => Promise<Response>),
  maybeHandler?: (ctx: ApiKeyContext) => Promise<Response>
): Promise<Response> {
  // Legacy two-argument form: default to a write scope, which is the stricter
  // of the two, so an un-migrated route can never be less protected.
  const options: GuardOptions =
    typeof optionsOrHandler === "function" ? { scope: "write" } : optionsOrHandler;
  const handler = typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler!;

  const ctx = await resolveApiKey(request);
  if (!ctx) return error(401, "Invalid or missing API key");

  const route = options.route ?? new URL(request.url).pathname;
  const kind = options.scope === "write" ? ("writes" as const) : ("reads" as const);

  const finish = async (response: Response): Promise<Response> => {
    void recordRequest({
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      apiKeyId: ctx.apiKeyId,
      kind,
      route,
      statusCode: response.status,
    }).catch(() => undefined);
    return response;
  };

  if (!ctx.scopes.includes(options.scope)) {
    return finish(
      error(403, `This API key does not have the "${options.scope}" scope`, { scopes: ctx.scopes })
    );
  }

  const rate = await consumeRateLimit(ctx.apiKeyId, ctx.plan);
  const rateHeaders = {
    "RateLimit-Limit": String(rate.limit),
    "RateLimit-Remaining": String(rate.remaining),
    "RateLimit-Reset": String(rate.retryAfterSeconds),
  };
  if (!rate.allowed) {
    return finish(
      error(
        429,
        `Rate limit exceeded: ${rate.limit} requests per minute on the ${limitsFor(ctx.plan).label} plan`,
        { retry_after: rate.retryAfterSeconds },
        { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) }
      )
    );
  }

  const quota = await checkQuota(ctx.orgId, ctx.plan, kind);
  if (!quota.allowed) {
    // 402, not 429: waiting does not fix this, changing plan does.
    return finish(
      error(
        402,
        `Monthly ${kind} quota exhausted for the ${limitsFor(ctx.plan).label} plan (${quota.used}/${quota.quota})`,
        { used: quota.used, quota: quota.quota },
        rateHeaders
      )
    );
  }

  // Idempotency only applies to requests that change something.
  const idempotencyKey = options.scope === "write" ? request.headers.get("idempotency-key") : null;
  let requestHash = "";
  let body = "";

  if (idempotencyKey) {
    body = await request.clone().text();
    requestHash = hashRequest(request.method, route, body);
    try {
      const replayed = await lookupIdempotent(ctx.apiKeyId, idempotencyKey, requestHash);
      if (replayed) {
        return finish(
          new Response(replayed.body, {
            status: replayed.statusCode,
            headers: { "Content-Type": "application/json", "Idempotent-Replay": "true", ...rateHeaders },
          })
        );
      }
    } catch (e) {
      if (e instanceof IdempotencyConflict) return finish(error(409, e.message, {}, rateHeaders));
      throw e;
    }
  }

  const response = await withUsageTracking(
    { projectId: ctx.projectId, environmentId: ctx.environmentId, apiKeyId: ctx.apiKeyId, source: "api" },
    () => handler(ctx)
  );

  // Only successful writes are worth replaying; a stored failure would pin the
  // client to an error it could otherwise retry past.
  if (idempotencyKey && response.status < 400) {
    const stored = await response.clone().text();
    await storeIdempotent(ctx.apiKeyId, idempotencyKey, requestHash, {
      statusCode: response.status,
      body: stored,
    });
  }

  const withHeaders = new Response(response.body, response);
  for (const [name, value] of Object.entries(rateHeaders)) withHeaders.headers.set(name, value);
  return finish(withHeaders);
}
