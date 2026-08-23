import { createAgentOrg } from "@/lib/org";
import { consumeAgentInitRateLimit, getClientIp, hashIp } from "@/lib/guards";
import { error } from "@/lib/with-api-key";

/**
 * Provisions a working API key with no authentication at all — an agent
 * calling this directly (or via `@memora/cli`'s `init --agent`) gets a live
 * key immediately, and a human claims ownership of the org later at
 * `claimUrl`. See src/lib/org.ts's `createAgentOrg` for why this doesn't
 * need a `users` row to exist.
 */
export async function POST(request: Request) {
  const ipHash = hashIp(getClientIp(request));
  const rate = await consumeAgentInitRateLimit(ipHash);
  if (!rate.allowed) {
    return error(
      429,
      "Too many workspace creation attempts from this address",
      { retry_after: rate.retryAfterSeconds },
      { "Retry-After": String(rate.retryAfterSeconds) }
    );
  }

  const { org, project, environment, apiKey, claimToken } = await createAgentOrg();
  const baseUrl = process.env.AUTH_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;

  return Response.json({
    apiKey,
    orgId: org.id,
    projectId: project.id,
    environmentId: environment.id,
    claimUrl: `${baseUrl}/claim/${claimToken}`,
  });
}
