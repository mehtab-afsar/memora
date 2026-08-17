import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { recallExperiences } from "@/lib/experience-engine";

const bodySchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  return withApiKey(request, async (ctx) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const { query, top_k } = parsed.data;

    const results = await recallExperiences(
      { projectId: ctx.projectId, environmentId: ctx.environmentId },
      query,
      top_k
    );

    return Response.json({ results });
  });
}
