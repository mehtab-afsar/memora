import { after } from "next/server";
import { withApiKey } from "@/lib/with-api-key";
import { remember } from "@/lib/memory-engine";
import { drainPendingJobs } from "@/lib/reconcile";
import { badRequest, rememberBodySchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  return withApiKey(request, { scope: "write" }, async (ctx) => {
    const parsed = rememberBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
    }
    const { user_id, content, agent_id, session_id, source } = parsed.data;

    const { outcomes } = await remember({
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      endUserId: user_id,
      agentId: agent_id,
      sessionId: session_id,
      content,
      sourceType: source?.type ?? "api",
      sourceId: source?.id,
    });

    // Reconciliation runs once the response is on the wire. The queue is
    // durable, so anything this misses — a crash, a timeout, a failed Claude
    // call — is picked up by scripts/reconcile-worker.ts rather than lost.
    after(async () => {
      try {
        await drainPendingJobs({
          projectId: ctx.projectId,
          environmentId: ctx.environmentId,
          endUserId: user_id,
        });
      } catch (error) {
        console.error("[reconcile] post-response drain failed", error);
      }
    });

    return Response.json({ outcomes });
  });
}
