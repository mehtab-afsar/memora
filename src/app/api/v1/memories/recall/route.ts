import { withApiKey } from "@/lib/with-api-key";
import { recallWithProfile } from "@/lib/memory-engine";
import { badRequest, recallBodySchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  return withApiKey(request, { scope: "read" }, async (ctx) => {
    const parsed = recallBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
    }
    const { user_id, query, top_k, type, min_confidence, since, until, agent_id, session_id } = parsed.data;

    const { results, profile } = await recallWithProfile({
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      endUserId: user_id,
      query,
      topK: top_k,
      types: type,
      minConfidence: min_confidence,
      since,
      until,
      agentId: agent_id,
      sessionId: session_id,
    });

    return Response.json({ results, profile });
  });
}
