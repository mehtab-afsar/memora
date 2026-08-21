import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Bounded on purpose. Left unset, node-postgres defaults to 10 while every
  // app instance and every worker opens its own pool — enough instances and
  // Postgres refuses connections, which looks like a database outage rather
  // than a configuration mistake. Reconciliation runs several users at once
  // (RECONCILE_CONCURRENCY), so the pool has to leave room for that.
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  // Hand back idle connections rather than holding them open forever.
  idleTimeoutMillis: 30_000,
  // Fail a request that cannot get a connection rather than hanging on it.
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
