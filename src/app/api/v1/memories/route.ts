import { withApiKey } from "@/lib/with-api-key";
import { memoryStatusEnum, memoryTypeEnum } from "@/db/schema";
import { forgetUser, listMemories } from "@/lib/memory-engine";

const STATUS_VALUES = new Set(memoryStatusEnum.enumValues);
const TYPE_VALUES = new Set(memoryTypeEnum.enumValues);

export async function GET(request: Request) {
  return withApiKey(request, { scope: "read" }, async (ctx) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    if (status && !STATUS_VALUES.has(status as (typeof memoryStatusEnum.enumValues)[number])) {
      return Response.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    if (type && !TYPE_VALUES.has(type as (typeof memoryTypeEnum.enumValues)[number])) {
      return Response.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }

    const result = await listMemories(
      { projectId: ctx.projectId, environmentId: ctx.environmentId },
      {
        endUserId: userId ?? undefined,
        status: status as (typeof memoryStatusEnum.enumValues)[number] | undefined,
        type: type as (typeof memoryTypeEnum.enumValues)[number] | undefined,
        limit,
        offset,
      }
    );

    return Response.json(result);
  });
}

export async function DELETE(request: Request) {
  return withApiKey(request, { scope: "write" }, async (ctx) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    if (!userId) {
      return Response.json({ error: "user_id query parameter is required" }, { status: 400 });
    }
    const count = await forgetUser({ projectId: ctx.projectId, environmentId: ctx.environmentId, endUserId: userId });
    return Response.json({ archived: count });
  });
}
