import { withApiKey } from "@/lib/with-api-key";
import { eraseUser, exportUser } from "@/lib/erasure";

/**
 * Data-subject rights for one end user.
 *
 *   GET    /api/v1/users/:id   everything held about them
 *   DELETE /api/v1/users/:id   permanently destroys it
 *
 * Kept off `/memories` on purpose. `DELETE /api/v1/memories?user_id=…`
 * archives — it is the "stop using this" operation, and it is reversible.
 * Erasure is a different thing about a different noun: not "forget this set of
 * memories" but "this person is to stop existing here".
 */

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "read", route: "/api/v1/users/[id]" }, async (keyCtx) => {
    const data = await exportUser({
      projectId: keyCtx.projectId,
      environmentId: keyCtx.environmentId,
      endUserId: decodeURIComponent(id),
    });
    return Response.json(data);
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withApiKey(request, { scope: "write", route: "/api/v1/users/[id]" }, async (keyCtx) => {
    // Erasure is irreversible and a mistyped user id destroys the wrong
    // person's data, so it takes an explicit acknowledgement rather than
    // happening because a DELETE reached this URL.
    const url = new URL(request.url);
    if (url.searchParams.get("confirm") !== "erase") {
      return Response.json(
        {
          error:
            "Permanent erasure requires ?confirm=erase. To archive instead, use DELETE /api/v1/memories?user_id=…",
        },
        { status: 400 }
      );
    }

    const result = await eraseUser(
      {
        projectId: keyCtx.projectId,
        environmentId: keyCtx.environmentId,
        endUserId: decodeURIComponent(id),
      },
      "api"
    );

    return Response.json({
      erased: true,
      memoriesErased: result.memoriesErased,
      profilesErased: result.profilesErased,
      // So the caller can record proof of erasure on their side too.
      subjectHash: result.subjectHash,
    });
  });
}
