import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, requireEnv } from "./env";

/**
 * Modules that read process.env at import time — the db pool, the Anthropic
 * client, the pipeline model constant — are imported dynamically inside main()
 * so the .env file is loaded first.
 */
async function imports() {
  const [drizzle, dbModule, schema, engine, usage, reconcile, anthropic, dataset, judge, pricing] = await Promise.all([
    import("drizzle-orm"),
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/memory-engine"),
    import("@/lib/usage-tracking"),
    import("@/lib/reconcile"),
    import("@/lib/anthropic"),
    import("./dataset"),
    import("./judge"),
    import("./pricing"),
  ]);
  return { ...drizzle, ...dbModule, ...schema, ...engine, ...usage, ...reconcile, ...anthropic, ...dataset, ...judge, ...pricing };
}

type Args = {
  dataset: string;
  tag: string;
  judgeModel: string;
  limit: number | null;
  case: string | null;
  keep: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  return {
    dataset: get("--dataset") ?? "golden",
    tag: get("--tag") ?? "run",
    judgeModel: get("--judge-model") ?? "claude-opus-5",
    limit: get("--limit") ? Number(get("--limit")) : null,
    case: get("--case"),
    keep: argv.includes("--keep"),
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  return [result, performance.now() - start];
}

type QuestionResult = {
  caseId: string;
  category: string;
  question: string;
  gold: string;
  answer: string;
  correct: boolean;
  reason: string;
  retrieved: number;
  topScore: number | null;
  readMs: number;
};

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY");

  // A Voyage account without a payment method is capped at 3 requests/minute.
  // Pace to whatever the account allows so a run completes instead of dying on
  // a 429 halfway through; override with VOYAGE_MAX_RPM in the environment.
  process.env.VOYAGE_MAX_RPM ??= "3";

  const {
    and, eq, gte,
    db, organizations, projects, environments, memories, usageEvents,
    remember, recall, withUsageTracking, drainPendingJobs, activeModel,
    loadDataset, countQuestions,
    answerFromMemories, grade, judgeUsage,
    ANTHROPIC_RATES, costOf,
  } = await imports();

  const args = parseArgs(process.argv.slice(2));
  const dataset = loadDataset(args.dataset);
  const selected = args.case ? dataset.cases.filter((c) => c.id === args.case) : dataset.cases;
  if (selected.length === 0) throw new Error(`No case matching --case ${args.case}`);
  const cases = args.limit ? selected.slice(0, args.limit) : selected;
  const pipelineModel = activeModel();
  const startedAt = new Date();

  console.log(`\nMemora eval — dataset "${dataset.name}"`);
  console.log(`  cases      ${cases.length}/${dataset.cases.length}`);
  console.log(`  questions  ${countQuestions({ ...dataset, cases })}`);
  console.log(`  pipeline   ${pipelineModel}   (set MEMORA_MODEL to change)`);
  console.log(`  judge      ${args.judgeModel}\n`);

  // --- provision an isolated project -------------------------------------
  const [org] = await db.insert(organizations).values({ name: `eval-${startedAt.toISOString()}` }).returning();
  const [project] = await db.insert(projects).values({ orgId: org.id, name: `eval-${args.tag}` }).returning();
  const [environment] = await db
    .insert(environments)
    .values({ projectId: project.id, name: "eval" })
    .returning();

  const scope = { projectId: project.id, environmentId: environment.id };
  const usageScope = { ...scope, source: "api" as const };

  const writeMs: number[] = [];
  const reconcileMs: number[] = [];
  const readMs: number[] = [];
  const results: QuestionResult[] = [];
  const ungraded: { question: string; error: string }[] = [];
  const memoriesPerCase: Record<string, number> = {};

  try {
    for (const evalCase of cases) {
      process.stdout.write(`  ${evalCase.id.padEnd(20)}`);

      for (const session of evalCase.sessions) {
        const [, ms] = await timed(() =>
          withUsageTracking(usageScope, () =>
            remember({ ...scope, endUserId: evalCase.userId, content: session, sourceType: "eval" })
          )
        );
        writeMs.push(ms);
        process.stdout.write("w");
      }

      // Writes are append-only; the judgement that used to sit inline now runs
      // here, off the caller's latency path. The eval drains it before asking
      // questions so accuracy measures the settled record, not the in-flight one.
      // Drain until the queue for this case is actually empty. A single pass is
      // capped, and a LoCoMo conversation produces hundreds of memories — a
      // partial drain would leave most of them unjudged and quietly understate
      // everything measured afterwards.
      const [, drainMs] = await timed(async () => {
        for (let pass = 0; pass < 100; pass++) {
          const completed = await withUsageTracking(usageScope, () =>
            drainPendingJobs({ ...scope, endUserId: evalCase.userId }, 50)
          );
          if (completed === 0) break;
        }
      });
      reconcileMs.push(drainMs);
      process.stdout.write("r");

      const writtenRows = await db
        .select({ id: memories.id })
        .from(memories)
        .where(and(eq(memories.projectId, project.id), eq(memories.endUserId, evalCase.userId)));
      const written = writtenRows.length;
      memoriesPerCase[evalCase.id] = written;

      for (const question of evalCase.questions) {
        const [retrieved, ms] = await timed(() =>
          withUsageTracking(usageScope, () =>
            recall({ ...scope, endUserId: evalCase.userId, query: question.q, topK: 10 })
          )
        );
        readMs.push(ms);

        const answer = await answerFromMemories(args.judgeModel, question.q, retrieved);

        // A question that cannot be graded is recorded as ungraded and left out
        // of the accuracy figure — never counted as a failure, and never a
        // reason to throw away everything the run has already measured.
        let verdict: { correct: boolean; reason: string } | null = null;
        try {
          verdict = await grade(args.judgeModel, question, answer);
        } catch (error) {
          ungraded.push({ question: question.q, error: error instanceof Error ? error.message : String(error) });
        }

        if (verdict === null) {
          process.stdout.write("?");
          continue;
        }

        results.push({
          caseId: evalCase.id,
          category: question.category,
          question: question.q,
          gold: question.gold,
          answer,
          correct: verdict.correct,
          reason: verdict.reason,
          retrieved: retrieved.length,
          topScore: retrieved[0]?.relevanceScore ?? null,
          readMs: ms,
        });
        process.stdout.write(verdict.correct ? "." : "x");
      }
      process.stdout.write(`  (${written} memories)\n`);
    }

    // --- cost ------------------------------------------------------------
    const usageRows = await db
      .select({
        provider: usageEvents.provider,
        operation: usageEvents.operation,
        inputTokens: usageEvents.inputTokens,
        outputTokens: usageEvents.outputTokens,
        totalTokens: usageEvents.totalTokens,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.projectId, project.id), gte(usageEvents.createdAt, startedAt)));

    const pipelineCost = costOf(usageRows, pipelineModel);
    const judge = judgeUsage();
    const judgeRate = ANTHROPIC_RATES[args.judgeModel] ?? ANTHROPIC_RATES["claude-opus-5"];
    const judgeUsd =
      (judge.inputTokens / 1_000_000) * judgeRate.input + (judge.outputTokens / 1_000_000) * judgeRate.output;

    const totalMemories = Object.values(memoriesPerCase).reduce((a, b) => a + b, 0);
    const byCategory: Record<string, { correct: number; total: number }> = {};
    for (const r of results) {
      byCategory[r.category] ??= { correct: 0, total: 0 };
      byCategory[r.category].total += 1;
      if (r.correct) byCategory[r.category].correct += 1;
    }

    const correct = results.filter((r) => r.correct).length;
    const report = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      dataset: dataset.name,
      tag: args.tag,
      pipelineModel,
      judgeModel: args.judgeModel,
      accuracy: results.length === 0 ? 0 : correct / results.length,
      correct,
      total: results.length,
      ungraded,
      byCategory,
      latency: {
        writeP50: percentile(writeMs, 50),
        writeP95: percentile(writeMs, 95),
        writeCalls: writeMs.length,
        reconcileP50: percentile(reconcileMs, 50),
        reconcileP95: percentile(reconcileMs, 95),
        reconcileCalls: reconcileMs.length,
        readP50: percentile(readMs, 50),
        readP95: percentile(readMs, 95),
        readCalls: readMs.length,
      },
      storage: { totalMemories, memoriesPerCase, memoriesPerWrite: totalMemories / writeMs.length },
      // Provider call counts are the latency metric that survives rate limiting:
      // wall-clock includes 429 backoff, this does not. Phase 1 targets these.
      calls: {
        anthropicPerWrite: usageRows.filter((r) => r.provider === "anthropic").length / writeMs.length,
        voyagePerWrite: usageRows.filter((r) => r.provider === "voyage" && r.operation === "document").length / writeMs.length,
        voyagePerRead: usageRows.filter((r) => r.provider === "voyage" && r.operation === "query").length / readMs.length,
        byOperation: usageRows.reduce<Record<string, number>>((acc, r) => {
          const key = `${r.provider}:${r.operation}`;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      },
      cost: {
        pipeline: pipelineCost,
        pipelineUsdPer1kMemories: totalMemories > 0 ? (pipelineCost.totalUsd / totalMemories) * 1000 : 0,
        judgeUsd,
        judgeTokens: judge,
      },
      results,
    };

    mkdirSync(join(process.cwd(), "evals", "results"), { recursive: true });
    const file = join(
      process.cwd(),
      "evals",
      "results",
      `${startedAt.toISOString().replace(/[:.]/g, "-")}-${args.tag}.json`
    );
    writeFileSync(file, JSON.stringify(report, null, 2));

    // --- report ----------------------------------------------------------
    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    console.log(`\n  Accuracy   ${pct(report.accuracy)}  (${correct}/${results.length})`);
    for (const [category, stats] of Object.entries(byCategory).sort()) {
      console.log(
        `    ${category.padEnd(14)} ${pct(stats.correct / stats.total).padStart(6)}  (${stats.correct}/${stats.total})`
      );
    }
    console.log(
      `\n  Write      p50 ${report.latency.writeP50.toFixed(0)}ms   p95 ${report.latency.writeP95.toFixed(0)}ms   (${writeMs.length} calls)`
    );
    console.log(
      `  Reconcile  p50 ${report.latency.reconcileP50.toFixed(0)}ms   p95 ${report.latency.reconcileP95.toFixed(0)}ms   (off the caller's path)`
    );
    console.log(
      `  Read       p50 ${report.latency.readP50.toFixed(0)}ms   p95 ${report.latency.readP95.toFixed(0)}ms   (${readMs.length} calls)`
    );
    console.log(
      `  Storage    ${totalMemories} memories   ${report.storage.memoriesPerWrite.toFixed(2)} per remember()`
    );
    console.log(
      `  Calls      ${report.calls.anthropicPerWrite.toFixed(2)} Claude + ${report.calls.voyagePerWrite.toFixed(2)} Voyage per remember()   ${report.calls.voyagePerRead.toFixed(2)} Voyage per recall()`
    );
    console.log(
      `  Cost       $${pipelineCost.totalUsd.toFixed(4)} pipeline   $${report.cost.pipelineUsdPer1kMemories.toFixed(2)} per 1k memories   $${judgeUsd.toFixed(4)} judging`
    );
    if (pipelineCost.voyageUnpriced) {
      console.log(
        `             (${pipelineCost.voyageTokens} embedding tokens unpriced — set VOYAGE_RATE_PER_MTOK to include them)`
      );
    }

    if (ungraded.length > 0) {
      console.log(`\n  Ungraded (excluded from accuracy)`);
      for (const u of ungraded) console.log(`    ${u.question}\n      ${u.error}`);
    }

    const failures = results.filter((r) => !r.correct);
    if (failures.length > 0) {
      console.log(`\n  Failures`);
      for (const f of failures) {
        console.log(`    [${f.category}] ${f.question}`);
        console.log(`      got:   ${f.answer}`);
        console.log(`      why:   ${f.reason}`);
      }
    }

    console.log(`\n  Report     ${file}\n`);
  } finally {
    if (args.keep) {
      console.log(`  Kept project ${project.id} (--keep)\n`);
    } else {
      // Cascades to environments, memories, evidence and usage events.
      await db.delete(organizations).where(eq(organizations.id, org.id));
    }
  }
}

// Exit explicitly: the pg pool keeps the event loop alive. Never exit from a
// finally block — it swallows the error before the catch can report it.
main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n", error);
    process.exit(1);
  }
);
