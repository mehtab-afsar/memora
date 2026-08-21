import { withApiKey } from "@/lib/with-api-key";
import { updateMemory, forgetMemory } from "@/lib/memory-engine";
import { badRequest, memoryPatchSchema } from "@/lib/api-schemas";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "write" }, async (keyCtx) => {
    const parsed = memoryPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(parsed.error);
    }
    const updated = await updateMemory(id, keyCtx, parsed.data);
    if (!updated) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json({ memory: updated });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "write" }, async (keyCtx) => {
    const updated = await forgetMemory(id, keyCtx);
    if (!updated) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json({ memory: updated });
  });
}
