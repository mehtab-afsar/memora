import { z } from "zod";
import { withApiKey } from "@/lib/with-api-key";
import { updateMemory, forgetMemory } from "@/lib/memory-engine";

const patchSchema = z.object({
  content: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, async (keyCtx) => {
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const updated = await updateMemory(id, keyCtx, parsed.data);
    if (!updated) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json({ memory: updated });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, async (keyCtx) => {
    const updated = await forgetMemory(id, keyCtx);
    if (!updated) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json({ memory: updated });
  });
}
