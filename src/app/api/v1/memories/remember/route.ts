import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { remember } from "@/lib/memory-engine";

const bodySchema = z.object({
  user_id: z.string().min(1),
  content: z.string().min(1),
  source: z.object({ type: z.string().min(1), id: z.string().optional() }).optional(),
});

export async function POST(request: Request) {
  return withApiKey(request, async (ctx) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const { user_id, content, source } = parsed.data;

    const { outcomes } = await remember({
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      endUserId: user_id,
      content,
      sourceType: source?.type ?? "api",
      sourceId: source?.id,
    });

    return Response.json({ outcomes });
  });
}
