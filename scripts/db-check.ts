import { loadEnv, requireEnv } from "../evals/env";

/**
 * Checks that a database is actually usable by Memora, and says precisely what
 * is wrong when it is not.
 *
 *   pnpm db:check
 *
 * Exists because every failure mode here presents as something unhelpful:
 * pgvector missing is "type vector does not exist" from inside a migration,
 * the wrong pooling mode is an intermittent error under load, and an IPv6-only
 * host is a connection timeout that looks like a firewall problem.
 */

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL");

  const url = process.env.DATABASE_URL!;
  const { Pool } = await import("pg");
  const checks: Check[] = [];

  // --- what kind of connection string is this? ----------------------------
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const isSupabase = host.includes("supabase.co") || host.includes("supabase.com");
  const isPooler = host.includes("pooler.supabase.com");
  const isDirect = host.startsWith("db.") && isSupabase;

  console.log(`\nChecking ${host}:${port}\n`);

  if (isDirect) {
    checks.push({
      name: "connection route",
      ok: false,
      detail:
        "This is Supabase's direct connection, which resolves to IPv6 only. It works from a " +
        "machine with IPv6 egress and times out from one without — including most CI runners " +
        "and many container hosts. Prefer the pooler string unless you know you have IPv6.",
    });
  } else if (isPooler) {
    checks.push({
      name: "connection route",
      ok: true,
      detail:
        port === "6543"
          ? "Supavisor, transaction mode (6543). Right for the app; migrations need session mode (5432)."
          : "Supavisor, session mode (5432). Right for migrations, and fine for the app.",
    });
  } else {
    checks.push({ name: "connection route", ok: true, detail: `Direct connection to ${host}.` });
  }

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000, max: 2 });

  try {
    // --- can we connect at all? -------------------------------------------
    const started = Date.now();
    const { rows: version } = await pool.query<{ version: string }>("select version()");
    checks.push({
      name: "connection",
      ok: true,
      detail: `${version[0].version.split(" ").slice(0, 2).join(" ")} — ${Date.now() - started}ms`,
    });

    // --- pgvector ----------------------------------------------------------
    const { rows: ext } = await pool.query<{ extversion: string; nspname: string }>(
      `select e.extversion, n.nspname
         from pg_extension e join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'vector'`
    );
    if (ext.length === 0) {
      checks.push({
        name: "pgvector",
        ok: false,
        detail: "Not installed. Run `pnpm db:setup`, or enable it in your provider's dashboard.",
      });
    } else {
      checks.push({
        name: "pgvector",
        ok: true,
        detail: `v${ext[0].extversion}, installed in schema "${ext[0].nspname}"`,
      });

      // Installed is not the same as usable.
      try {
        await pool.query("select '[1,2,3]'::vector");
        checks.push({ name: "vector type", ok: true, detail: "resolves on the current search_path" });
      } catch {
        checks.push({
          name: "vector type",
          ok: false,
          detail:
            `Installed in "${ext[0].nspname}" but not on the search_path, so migrations will fail ` +
            `with "type vector does not exist". Fix with:\n      ` +
            `alter role ${parsed.username} set search_path = public, ${ext[0].nspname};`,
        });
      }
    }

    // --- schema ------------------------------------------------------------
    const { rows: tables } = await pool.query<{ count: string }>(
      `select count(*)::text from information_schema.tables
        where table_schema = 'public' and table_name in
        ('memories','memory_evidence','reconciliation_jobs','user_profiles','api_keys')`
    );
    const found = Number(tables[0].count);
    checks.push({
      name: "schema",
      ok: found === 5,
      detail:
        found === 5
          ? "all core tables present"
          : `${found}/5 core tables — run \`pnpm db:setup\` to migrate`,
    });

    // --- write permission --------------------------------------------------
    try {
      await pool.query("create temporary table memora_write_check (id int)");
      checks.push({ name: "permissions", ok: true, detail: "role can create tables" });
    } catch (error) {
      checks.push({
        name: "permissions",
        ok: false,
        detail: `role cannot create tables: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "connection",
      ok: false,
      detail:
        /timeout/i.test(message) && isDirect
          ? `${message}\n      Almost certainly the IPv6 problem above — switch to the pooler string.`
          : message,
    });
  } finally {
    await pool.end();
  }

  for (const check of checks) {
    console.log(`  ${check.ok ? "OK  " : "FAIL"}  ${check.name.padEnd(18)} ${check.detail}`);
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n  ${failed === 0 ? "Ready." : `${failed} problem(s) to fix.`}\n`);
  if (failed > 0) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
