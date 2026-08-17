import { withApiKey } from "@/lib/with-api-key";
import { listExperiences } from "@/lib/experience-engine";

export async function GET(request: Request) {
  return withApiKey(request, async (ctx) => {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    const result = await listExperiences(
      { projectId: ctx.projectId, environmentId: ctx.environmentId },
      { limit, offset }
    );

    return Response.json(result);
  });
}
