import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { recommendForTask } from "@/lib/experience-engine";

const bodySchema = z.object({
  task: z.string().min(1),
});

export async function POST(request: Request) {
  return withApiKey(request, async (ctx) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }

    const result = await recommendForTask({ projectId: ctx.projectId, environmentId: ctx.environmentId }, parsed.data.task);

    return Response.json(result ?? { recommendation: null, confidence: null, reasoning: null, supportingExperiences: [] });
  });
}
