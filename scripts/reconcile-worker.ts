import { loadEnv, requireEnv } from "../evals/env";

/**
 * Reconciliation worker. The remember() route drains its own jobs after the
 * response, so this exists for what that misses: retries, jobs orphaned by a
 * crash or deploy, and backlog from a burst of writes.
 *
 * Run once:        pnpm reconcile
 * Run continuously: pnpm reconcile --watch [--interval 5]
 */

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY");

  const { drainPendingJobs, pendingJobCount } = await import("@/lib/reconcile");
  const { pruneIdempotencyKeys, pruneRateLimitWindows } = await import("@/lib/guards");

  const argv = process.argv.slice(2);
  const watch = argv.includes("--watch");
  const intervalIndex = argv.indexOf("--interval");
  const intervalMs = (intervalIndex === -1 ? 5 : Number(argv[intervalIndex + 1] ?? 5)) * 1000;

  const runOnce = async () => {
    const pending = await pendingJobCount();
    if (pending > 0) {
      const completed = await drainPendingJobs(null, 25);
      console.log(`[reconcile] ${completed}/${pending} job(s) completed`);
      return completed;
    }
    return 0;
  };

  // Rate-limit counters and idempotency records are write-heavy and short
  // lived. Nothing else would ever delete them, so an unswept table would grow
  // forever and slowly make every request slower.
  let lastSweep = 0;
  const SWEEP_INTERVAL_MS = 10 * 60_000;
  const sweep = async () => {
    if (Date.now() - lastSweep < SWEEP_INTERVAL_MS) return;
    lastSweep = Date.now();
    const [windows, keys] = await Promise.all([pruneRateLimitWindows(), pruneIdempotencyKeys()]);
    if (windows > 0 || keys > 0) {
      console.log(`[sweep] pruned ${windows} rate-limit window(s), ${keys} idempotency key(s)`);
    }
  };

  if (!watch) {
    await runOnce();
    await sweep();
    return;
  }

  console.log(`[reconcile] watching, every ${intervalMs / 1000}s — ctrl-c to stop`);
  for (;;) {
    try {
      await runOnce();
      await sweep();
    } catch (error) {
      console.error("[reconcile] pass failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
