import { withApiKey } from "@/lib/with-api-key";

export async function GET(request: Request) {
  return withApiKey(request, async (ctx) => Response.json(ctx));
}
