import { loadEnv, requireEnv } from "../evals/env";

/**
 * Measures what prompt caching actually does to the extraction call.
 *
 *   pnpm cache:probe
 *
 * Caching is easy to add and easy to get silently wrong: a byte of drift in the
 * prefix and every request pays the 1.25x write premium while reading nothing
 * back, which looks exactly like working code. The only way to know is to run
 * the real call twice and read the usage numbers, so that is what this does.
 *
 * It also prices the result, because the reason to care is the bill.
 */

// Claude Sonnet 5 introductory rates, $ per million tokens.
const INPUT = 2.0;
const OUTPUT = 10.0;
const CACHE_WRITE = INPUT * 1.25;
const CACHE_READ = INPUT * 0.1;

const SAMPLES = [
  "Hey, quick update — I moved to Lisbon last month and I'm working at Cloudsmith now as a staff engineer.",
  "Honestly I can't stand video calls before 10am. Mornings are for deep work.",
  "We decided to go with Postgres instead of Mongo for the events table. Priya pushed for it.",
];

const CANDIDATES = [
  { content: "Lives in Lisbon", type: "fact" as const, importance: 0.7, confidence: 0.9, rationale: "stated directly" },
  { content: "Dislikes meetings before 10am", type: "preference" as const, importance: 0.5, confidence: 0.9, rationale: "stated directly" },
  { content: "Team chose PostgreSQL for the events table", type: "decision" as const, importance: 0.6, confidence: 0.9, rationale: "stated directly" },
];

const NEIGHBOURS = [
  { id: "11111111-1111-1111-1111-111111111111", content: "Lives in Porto", type: "fact", confidence: 0.8, createdAt: "2026-01-04T00:00:00.000Z", lastConfirmedAt: "2026-01-04T00:00:00.000Z", similarity: 0.81 },
  { id: "22222222-2222-2222-2222-222222222222", content: "Works at Cloudsmith", type: "fact", confidence: 0.9, createdAt: "2026-02-11T00:00:00.000Z", lastConfirmedAt: "2026-02-11T00:00:00.000Z", similarity: 0.64 },
];

async function main() {
  loadEnv();
  requireEnv("ANTHROPIC_API_KEY");

  const { extractMemories, decideMemoryAction } = await import("@/lib/anthropic");
  const { collectUsage } = await import("@/lib/usage-tracking");
  type UsageEvent = import("@/lib/usage-tracking").UsageEvent;

  type Call = { input: number; output: number; read: number; write: number };

  const measure = async (fn: () => Promise<unknown>): Promise<Call> => {
    const events: UsageEvent[] = [];
    await collectUsage(events, fn);
    const event = events[events.length - 1];
    return {
      input: event?.inputTokens ?? 0,
      output: event?.outputTokens ?? 0,
      read: event?.cacheReadTokens ?? 0,
      write: event?.cacheWriteTokens ?? 0,
    };
  };

  const cost = (c: Call) =>
    (c.input * INPUT + c.write * CACHE_WRITE + c.read * CACHE_READ + c.output * OUTPUT) / 1_000_000;

  const uncachedCost = (c: Call) =>
    ((c.input + c.read + c.write) * INPUT + c.output * OUTPUT) / 1_000_000;

  const report = async (label: string, runs: (() => Promise<unknown>)[]) => {
    console.log(`\n${label}\n`);
    console.log("        uncached   cache write   cache read   output");

    const calls: Call[] = [];
    for (const [i, run] of runs.entries()) {
      const call = await measure(run);
      calls.push(call);
      console.log(
        `  ${i + 1}.  ${String(call.input).padStart(8)}   ${String(call.write).padStart(11)}   ` +
          `${String(call.read).padStart(10)}   ${String(call.output).padStart(6)}`
      );
    }

    const steady = calls[calls.length - 1];
    if (calls[0].write === 0 && calls[0].read === 0) {
      console.log(
        "\n  Nothing cached. The prefix is below this model's minimum cacheable size\n" +
          "  (1,024 tokens on Sonnet 5) — the marker is silently ignored, at no cost."
      );
      return null;
    }
    if (steady.read === 0) {
      console.log(
        "\n  WARNING: a repeat call read nothing from cache. Something in the prefix\n" +
          "  differs between requests — see docs/prompt-caching.md."
      );
      return null;
    }

    const cached = cost(steady);
    const plain = uncachedCost(steady);
    console.log(`\n  Cached prefix:    ${(steady.read + steady.write).toLocaleString()} tokens`);
    console.log(`  Per 1,000 calls:  $${(cached * 1000).toFixed(2)}  (was $${(plain * 1000).toFixed(2)})`);
    console.log(`  Saving:           ${(((plain - cached) / plain) * 100).toFixed(1)}%`);
    return { cached, plain };
  };

  const extraction = await report(
    "Extraction — one call per remember()",
    SAMPLES.map((text) => () => extractMemories(text))
  );

  const decision = await report(
    "Decision — one call per candidate during reconciliation",
    CANDIDATES.map((candidate) => () => decideMemoryAction(candidate, NEIGHBOURS))
  );

  if (extraction && decision) {
    // The shape of a real write: extract once, then decide on what came out.
    // One candidate per input is the common case and the conservative one —
    // more candidates means more decision calls, so more of the saving.
    const before = extraction.plain + decision.plain;
    const after = extraction.cached + decision.cached;
    console.log("\nA write end to end (one extraction + one decision):\n");
    console.log(`  Per 1,000 writes:  $${(after * 1000).toFixed(2)}  (was $${(before * 1000).toFixed(2)})`);
    console.log(`  Saving:            ${(((before - after) / before) * 100).toFixed(1)}%\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
