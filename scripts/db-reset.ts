import { loadEnv, requireEnv } from "../evals/env";

/**
 * Drops everything and rebuilds from migrations.
 *
 *   pnpm db:reset            # local only
 *   pnpm db:reset --force    # required for any non-local database
 *
 * The non-obvious part is why this exists rather than a one-line `drop schema
 * public cascade`. Drizzle keeps its migration journal in a separate `drizzle`
 * schema, so dropping `public` alone leaves the journal behind — the next
 * migrate reads it, concludes every migration has already run, prints
 * "migrations applied successfully", and creates nothing. You are left with an
 * empty database and a tool insisting it is up to date.
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const url = process.env.DATABASE_URL!;
  const host = new URL(url).hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "postgres";
  const force = process.argv.includes("--force");

  if (!isLocal && !force) {
    console.error(
      `Refusing to reset a non-local database (${host}).\n` +
        `This destroys every memory, every evidence trail and every account it holds.\n` +
        `Pass --force if that is genuinely what you want.`
    );
    process.exit(1);
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 });

  try {
    const { rows } = await pool.query<{ memories: string; users: string }>(
      `select
         (select count(*) from information_schema.tables
           where table_schema = 'public' and table_name = 'memories') as has_memories,
         coalesce((select count(*)::text from public.memories), '0') as memories,
         coalesce((select count(*)::text from public.users), '0') as users`
    ).catch(() => ({ rows: [{ memories: "?", users: "?" }] }));

    console.log(`\nResetting ${host}`);
    console.log(`  destroying ${rows[0].memories} memories and ${rows[0].users} dashboard account(s)\n`);

    await pool.query("drop schema if exists public cascade");
    // The journal, without which the rebuild silently does nothing.
    await pool.query("drop schema if exists drizzle cascade");
    await pool.query("create schema public");
    console.log("[db:reset] dropped public and drizzle schemas");
  } finally {
    await pool.end();
  }

  const { execFileSync } = await import("node:child_process");
  execFileSync("pnpm", ["db:setup"], { stdio: "inherit" });
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
