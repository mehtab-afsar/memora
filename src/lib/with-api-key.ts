import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, environments, projects } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys";
import { withUsageTracking } from "@/lib/usage-tracking";

export type ApiKeyContext = {
  orgId: string;
  projectId: string;
  environmentId: string;
  apiKeyId: string;
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
      environmentId: environments.id,
      projectId: projects.id,
      orgId: projects.orgId,
    })
    .from(apiKeys)
    .innerJoin(environments, eq(apiKeys.environmentId, environments.id))
    .innerJoin(projects, eq(environments.projectId, projects.id))
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  // Fire-and-forget usage tracking — must not block or fail the request.
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.apiKeyId));

  return row;
}

export async function withApiKey(
  request: Request,
  handler: (ctx: ApiKeyContext) => Promise<Response>
): Promise<Response> {
  const ctx = await resolveApiKey(request);
  if (!ctx) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return withUsageTracking(
    { projectId: ctx.projectId, environmentId: ctx.environmentId, apiKeyId: ctx.apiKeyId, source: "api" },
    () => handler(ctx)
  );
}
