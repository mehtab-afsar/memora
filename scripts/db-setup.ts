import { loadEnv, requireEnv } from "../evals/env";

/**
 * Prepares a database, then migrates it.
 *
 * The extensions have to exist before the first migration runs: `memories`
 * declares a `vector(1024)` column, and without pgvector installed
 * `drizzle-kit migrate` fails with an exit code and no message — which is a
 * miserable way to find out on a fresh deploy. No migration can do this itself,
 * because CREATE EXTENSION needs privileges a migration may not have and is
 * per-database rather than per-schema.
 *
 *   pnpm db:setup
 */
async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Supabase (and some other managed providers) keep extensions in their own
    // schema rather than public. Install there when it exists, so we match the
    // provider's convention instead of fighting it.
    const { rows } = await pool.query(
      `select 1 from information_schema.schemata where schema_name = 'extensions'`
    );
    const target = rows.length > 0 ? " with schema extensions" : "";

    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector${target}`);
    console.log(`[db:setup] extension ready: vector${target || " (public schema)"}`);

    // Installing it is not the same as being able to use it: if the schema is
    // not on the search path, `vector(1024)` in a migration fails with an
    // unhelpful "type does not exist". Prove it resolves before migrating.
    await pool.query(`select '[1,2,3]'::vector`);
    console.log("[db:setup] vector type resolves on the current search_path");
  } catch (error) {
    console.error(
      `[db:setup] could not prepare extensions. On managed Postgres the extension ` +
        `may need enabling by the provider, or by a role with rights to do it. ` +
        `If it installed but the type does not resolve, add its schema to the ` +
        `search_path for this role:\n` +
        `  alter role <role> set search_path = public, extensions;`
    );
    throw error;
  } finally {
    await pool.end();
  }

  const { execFileSync } = await import("node:child_process");
  execFileSync("pnpm", ["drizzle-kit", "migrate"], { stdio: "inherit" });
  console.log("[db:setup] migrations applied");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
