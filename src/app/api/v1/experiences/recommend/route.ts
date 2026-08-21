import { withApiKey } from "@/lib/with-api-key";
import { recommendForTask } from "@/lib/experience-engine";
import { badRequest, recommendBodySchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  return withApiKey(request, { scope: "read" }, async (ctx) => {
    const parsed = recommendBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
    }

    const result = await recommendForTask({ projectId: ctx.projectId, environmentId: ctx.environmentId }, parsed.data.task);

    return Response.json(result ?? { recommendation: null, confidence: null, reasoning: null, supportingExperiences: [] });
  });
}
