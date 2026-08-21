import { withApiKey } from "@/lib/with-api-key";
import { recordExperience } from "@/lib/experience-engine";
import { badRequest, recordExperienceBodySchema } from "@/lib/api-schemas";

export async function POST(request: Request) {
  return withApiKey(request, { scope: "write" }, async (ctx) => {
    const parsed = recordExperienceBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
    }
    const { source, ...input } = parsed.data;

    const experience = await recordExperience(
      { projectId: ctx.projectId, environmentId: ctx.environmentId },
      { ...input, sourceType: source?.type ?? "api", sourceId: source?.id }
    );

    return Response.json({ experience });
  });
}
