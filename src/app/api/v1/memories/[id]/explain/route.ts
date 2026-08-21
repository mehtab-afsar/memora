import { withApiKey } from "@/lib/with-api-key";
import { explain } from "@/lib/memory-engine";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "read" }, async (keyCtx) => {
    const result = await explain(id, keyCtx);
    if (!result) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json(result);
  });
}
