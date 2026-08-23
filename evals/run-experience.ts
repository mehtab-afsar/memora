import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, requireEnv } from "./env";

/**
 * Same deferred-import reasoning as run.ts: modules that read process.env at
 * import time need .env loaded first.
 */
async function imports() {
  const [drizzle, dbModule, schema, engine, usage, pricing] = await Promise.all([
    import("drizzle-orm"),
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/experience-engine"),
    import("@/lib/usage-tracking"),
    import("./pricing"),
  ]);
  return { ...drizzle, ...dbModule, ...schema, ...engine, ...usage, ...pricing };
}

type Args = {
  dataset: string;
  tag: string;
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
    dataset: get("--dataset") ?? "experience-golden",
    tag: get("--tag") ?? "run",
    limit: get("--limit") ? Number(get("--limit")) : null,
    case: get("--case"),
    keep: argv.includes("--keep"),
  };
}

type CaseResult = {
  caseId: string;
  expectReuse: boolean;
  reused: boolean;
  recommendation: string | null;
};

async function main() {
  loadEnv();
  requireEnv("DATABASE_URL", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY");

  // Same Voyage free-tier ceiling as the memory eval.
  process.env.VOYAGE_MAX_RPM ??= "3";

  const {
    eq, and, gte,
    db, organizations, projects, environments, usageEvents,
    recordExperience, recommendForTask,
    withUsageTracking,
    costOf,
  } = await imports();

  const args = parseArgs(process.argv.slice(2));
  const { loadExperienceDataset } = await import("./experience-dataset");
  const dataset = loadExperienceDataset(args.dataset);
  const selected = args.case ? dataset.cases.filter((c) => c.id === args.case) : dataset.cases;
  if (selected.length === 0) throw new Error(`No case matching --case ${args.case}`);
  const cases = args.limit ? selected.slice(0, args.limit) : selected;
  const startedAt = new Date();

  console.log(`\nMemora experience eval — dataset "${dataset.name}"`);
  console.log(`  cases      ${cases.length}/${dataset.cases.length}\n`);

  // --- provision an isolated project --------------------------------------
  const [org] = await db.insert(organizations).values({ name: `eval-experience-${startedAt.toISOString()}` }).returning();
  const [project] = await db.insert(projects).values({ orgId: org.id, name: `eval-${args.tag}` }).returning();

  // Experiences are scoped by (projectId, environmentId) only — there is no
  // per-end-user isolation the way memories have via endUserId. Sharing one
  // environment across every case would let an earlier case's experience
  // leak into a later case's recommendForTask() call, which would show up as
  // a false reuse that isn't actually the thing being measured. Each case
  // gets its own environment instead, so cases can never see each other.
  const results: CaseResult[] = [];

  try {
    for (const evalCase of cases) {
      process.stdout.write(`  ${evalCase.id.padEnd(24)}`);

      const [environment] = await db
        .insert(environments)
        .values({ projectId: project.id, name: `eval-${evalCase.id}` })
        .returning();
      const scope = { projectId: project.id, environmentId: environment.id };
      const usageScope = { ...scope, source: "api" as const };

      const recorded = await withUsageTracking(usageScope, () =>
        recordExperience(scope, {
          task: evalCase.prior.task,
          action: evalCase.prior.action,
          outcome: evalCase.prior.outcome,
          lesson: evalCase.prior.lesson,
          sourceType: "eval",
        })
      );
      process.stdout.write("w");

      const recommendation = await withUsageTracking(usageScope, () => recommendForTask(scope, evalCase.laterTask));
      process.stdout.write("r");

      const reused = Boolean(
        recommendation?.supportingExperiences.some((e) => e.experienceId === recorded.id)
      );

      results.push({
        caseId: evalCase.id,
        expectReuse: evalCase.expectReuse,
        reused,
        recommendation: recommendation?.recommendation ?? null,
      });

      const hit = reused === evalCase.expectReuse;
      process.stdout.write(`  ${hit ? "." : "x"}  (expected ${evalCase.expectReuse ? "reuse" : "no reuse"}, got ${reused ? "reuse" : "no reuse"})\n`);
    }

    // --- metrics -----------------------------------------------------------
    const reuseCases = results.filter((r) => r.expectReuse);
    const controlCases = results.filter((r) => !r.expectReuse);
    const experienceReuseRate = reuseCases.length > 0 ? reuseCases.filter((r) => r.reused).length / reuseCases.length : 0;
    const falseReuseRate = controlCases.length > 0 ? controlCases.filter((r) => r.reused).length / controlCases.length : 0;

    // --- cost ----------------------------------------------------------
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

    const pipelineCost = costOf(usageRows, "claude-sonnet-5");

    const report = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      dataset: dataset.name,
      tag: args.tag,
      experienceReuseRate,
      falseReuseRate,
      reuseCases: reuseCases.length,
      controlCases: controlCases.length,
      cost: pipelineCost,
      results,
    };

    mkdirSync(join(process.cwd(), "evals", "results"), { recursive: true });
    const file = join(
      process.cwd(),
      "evals",
      "results",
      `${startedAt.toISOString().replace(/[:.]/g, "-")}-${args.tag}-experience.json`
    );
    writeFileSync(file, JSON.stringify(report, null, 2));

    // --- report --------------------------------------------------------
    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    console.log(`\n  Experience Reuse Rate   ${pct(experienceReuseRate)}  (${reuseCases.filter((r) => r.reused).length}/${reuseCases.length})`);
    console.log(`  False Reuse Rate        ${pct(falseReuseRate)}  (${controlCases.filter((r) => r.reused).length}/${controlCases.length})`);
    console.log(`  Cost                    $${pipelineCost.totalUsd.toFixed(4)}`);
    console.log(`\n  Report     ${file}\n`);
  } finally {
    if (args.keep) {
      console.log(`  Kept project ${project.id} (--keep)\n`);
    } else {
      // Cascades to environments and experiences.
      await db.delete(organizations).where(eq(organizations.id, org.id));
    }
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n", error);
    process.exit(1);
  }
);
