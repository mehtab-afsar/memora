import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Liveness and readiness in one endpoint — a load balancer should not send
 * traffic to an instance that cannot reach its database, and "the process is
 * up" is not the same question as "this instance can serve a request".
 *
 * Unauthenticated on purpose, and deliberately says nothing beyond whether the
 * database answered.
 */
export async function GET() {
  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      database: "ok",
      latencyMs: Math.round(performance.now() - started),
    });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
