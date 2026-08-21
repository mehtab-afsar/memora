import { withApiKey } from "@/lib/with-api-key";
import { updateMemory, forgetMemory } from "@/lib/memory-engine";
import { eraseMemory } from "@/lib/erasure";
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

/**
 * Archives by default; permanently destroys with `?confirm=erase`.
 *
 * Archiving is the right default — the version chain and evidence trail are
 * the product, and a memory someone stopped believing is still evidence of
 * what was believed. Erasure exists because that is not an acceptable answer
 * to a GDPR Article 17 request, and it takes an explicit acknowledgement
 * because it cannot be undone.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "write" }, async (keyCtx) => {
    if (new URL(request.url).searchParams.get("confirm") === "erase") {
      const erased = await eraseMemory(id, keyCtx);
      if (!erased) return Response.json({ error: "Memory not found" }, { status: 404 });
      return Response.json({ erased: true, id });
    }

    const updated = await forgetMemory(id, keyCtx);
    if (!updated) return Response.json({ error: "Memory not found" }, { status: 404 });
    return Response.json({ memory: updated });
  });
}
