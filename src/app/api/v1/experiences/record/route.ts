import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { recordExperience } from "@/lib/experience-engine";

const bodySchema = z.object({
  task: z.string().min(1),
  action: z.string().min(1),
  context: z.string().optional(),
  outcome: z.enum(["success", "failure"]),
  cause: z.string().optional(),
  resolution: z.string().optional(),
  lesson: z.string().optional(),
  source: z.object({ type: z.string().min(1), id: z.string().optional() }).optional(),
});

export async function POST(request: Request) {
  return withApiKey(request, async (ctx) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const { source, ...input } = parsed.data;

    const experience = await recordExperience(
      { projectId: ctx.projectId, environmentId: ctx.environmentId },
      { ...input, sourceType: source?.type ?? "api", sourceId: source?.id }
    );

    return Response.json({ experience });
  });
}
