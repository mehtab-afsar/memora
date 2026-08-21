import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, requireEnv } from "./env";

/**
 * Extraction in isolation.
 *
 * The full eval (`pnpm eval`) measures the whole pipeline and needs a database,
 * embeddings and a judge model — which makes it slow, and on a rate-limited
 * Voyage account, very slow. This one calls only `extractMemories()` and checks
 * deterministic assertions, so it runs in seconds and can be iterated on while
 * tuning the extraction prompt.
 *
 *   pnpm eval:extraction [--case employer-specificity] [--tag before]
 */

type Expectation = {
  minCount?: number;
  maxCount?: number;
  /** Case-insensitive substrings that must appear in some candidate's content. */
  mustMention?: string[];
  /** Substrings that must appear in none of them. */
  mustNotMention?: string[];
  /** Regexes (as strings) that must match some candidate's content. */
  mustMatch?: string[];
  /** Regexes that must match none of them — for asserting nothing was invented. */
  mustNotMatch?: string[];
  /** Every candidate must be phrased about the user, not by them. */
  thirdPerson?: boolean;
};

type ExtractionCase = { id: string; text: string; why: string; expect: Expectation };
type ExtractionDataset = { name: string; description: string; cases: ExtractionCase[] };

type Candidate = { content: string; type: string; importance: number; confidence: number };

const FIRST_PERSON = /^(i |i'm |i've |my |me |we |our )/i;

function evaluate(candidates: Candidate[], expect: Expectation): string[] {
  const failures: string[] = [];
  const all = candidates.map((c) => c.content).join(" • ");

  if (expect.minCount !== undefined && candidates.length < expect.minCount) {
    failures.push(`expected at least ${expect.minCount} candidate(s), got ${candidates.length}`);
  }
  if (expect.maxCount !== undefined && candidates.length > expect.maxCount) {
    failures.push(`expected at most ${expect.maxCount} candidate(s), got ${candidates.length}`);
  }
  for (const needle of expect.mustMention ?? []) {
    if (!all.toLowerCase().includes(needle.toLowerCase())) failures.push(`missing "${needle}"`);
  }
  for (const needle of expect.mustNotMention ?? []) {
    if (all.toLowerCase().includes(needle.toLowerCase())) failures.push(`should not mention "${needle}"`);
  }
  for (const pattern of expect.mustMatch ?? []) {
    if (!new RegExp(pattern, "i").test(all)) failures.push(`nothing matched /${pattern}/`);
  }
  for (const pattern of expect.mustNotMatch ?? []) {
    if (new RegExp(pattern, "i").test(all)) failures.push(`should not have matched /${pattern}/`);
  }
  if (expect.thirdPerson) {
    for (const candidate of candidates) {
      if (FIRST_PERSON.test(candidate.content.trim())) {
        failures.push(`first person: "${candidate.content}"`);
      }
    }
  }
  return failures;
}

async function main() {
  loadEnv();
  requireEnv("ANTHROPIC_API_KEY");

  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  const tag = get("--tag") ?? "run";
  const only = get("--case");

  const { extractMemories, activeModel } = await import("@/lib/anthropic");

  const dataset = JSON.parse(
    readFileSync(join(process.cwd(), "evals", "datasets", "extraction.json"), "utf8")
  ) as ExtractionDataset;
  const cases = only ? dataset.cases.filter((c) => c.id === only) : dataset.cases;
  if (cases.length === 0) throw new Error(`No case matching --case ${only}`);

  const startedAt = new Date();
  console.log(`\nExtraction eval — ${cases.length} case(s), model ${activeModel()}\n`);

  // Extraction is one Anthropic call per case with no embeddings involved, so
  // these run concurrently — unlike the full eval, nothing here is rate limited.
  const results = await Promise.all(
    cases.map(async (evalCase) => {
      const started = performance.now();
      let candidates: Candidate[] = [];
      let error: string | null = null;
      try {
        candidates = (await extractMemories(evalCase.text)) as Candidate[];
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const ms = performance.now() - started;
      const failures = error ? [error] : evaluate(candidates, evalCase.expect);
      return { ...evalCase, candidates, failures, ms };
    })
  );

  for (const result of results) {
    const ok = result.failures.length === 0;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${result.id.padEnd(24)} ${result.ms.toFixed(0)}ms`);
    if (!ok) {
      for (const failure of result.failures) console.log(`          ${failure}`);
      console.log(`          why it matters: ${result.why}`);
      for (const candidate of result.candidates) {
        console.log(`          got: [${candidate.type}] ${candidate.content}`);
      }
      if (result.candidates.length === 0) console.log("          got: (nothing)");
    }
  }

  const passed = results.filter((r) => r.failures.length === 0).length;
  console.log(`\n  ${passed}/${results.length} passed\n`);

  mkdirSync(join(process.cwd(), "evals", "results"), { recursive: true });
  const file = join(
    process.cwd(),
    "evals",
    "results",
    `${startedAt.toISOString().replace(/[:.]/g, "-")}-extraction-${tag}.json`
  );
  writeFileSync(
    file,
    JSON.stringify({ startedAt: startedAt.toISOString(), model: activeModel(), passed, total: results.length, results }, null, 2)
  );
  console.log(`  Report     ${file}\n`);

  if (passed < results.length) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error("\n", error);
    process.exit(1);
  }
);
