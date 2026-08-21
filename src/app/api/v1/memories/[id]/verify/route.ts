import { withApiKey } from "@/lib/with-api-key";
import { verify } from "@/lib/memory-engine";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "write" }, async (keyCtx) => {
    const result = await verify(id, keyCtx);
    if (!result) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json(result);
  });
}
