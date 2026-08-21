import { withApiKey } from "@/lib/with-api-key";

export async function GET(request: Request) {
  return withApiKey(request, { scope: "read" }, async (ctx) => Response.json(ctx));
}
