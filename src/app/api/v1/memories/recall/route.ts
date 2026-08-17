import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { recall } from "@/lib/memory-engine";

const bodySchema = z.object({
  user_id: z.string().min(1),
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  return withApiKey(request, async (ctx) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const { user_id, query, top_k } = parsed.data;

    const results = await recall({
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      endUserId: user_id,
      query,
      topK: top_k,
    });

    return Response.json({ results });
  });
}
