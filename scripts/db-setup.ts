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
    for (const extension of ["vector"]) {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
      console.log(`[db:setup] extension ready: ${extension}`);
    }
  } catch (error) {
    console.error(
      `[db:setup] could not create extensions. On managed Postgres the ` +
        `extension may need enabling by the provider, or by a role with rights to do it.`
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
