import { withApiKey } from "@/lib/with-api-key";
import { recallExperiences } from "@/lib/experience-engine";
import { badRequest, recallExperiencesBodySchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  return withApiKey(request, { scope: "read" }, async (ctx) => {
    const parsed = recallExperiencesBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
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
