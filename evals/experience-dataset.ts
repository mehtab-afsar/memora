import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ExperienceEvalCase = {
  id: string;
  /** What actually happened, recorded via recordExperience() before laterTask is asked about. */
  prior: {
    task: string;
    action: string;
    outcome: "success" | "failure";
    lesson: string;
  };
  /** Asked via recommendForTask() after the prior experience is recorded. */
  laterTask: string;
  /**
   * true: laterTask is a real recurrence of `prior.task` — the recorded
   * experience should surface as supporting evidence.
   * false: laterTask is unrelated — a control case. The experience surfacing
   * here anyway is a false reuse, not a hit, however similar the wording
   * looks; without these, a reuse rate can be gamed by an over-eager match.
   */
  expectReuse: boolean;
};

export type ExperienceEvalDataset = { name: string; description: string; cases: ExperienceEvalCase[] };

const DATASETS_DIR = join(process.cwd(), "evals", "datasets");

/**
 * Hand-built, same situation `golden.json` is in on the memory side — there
 * is no published benchmark for "does a recorded experience get reused,"
 * so this is written by hand rather than converted from a release.
 */
export function loadExperienceDataset(name: string): ExperienceEvalDataset {
  const path = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Experience dataset "${name}" not found at ${path}.\n` +
        `Bundled datasets: experience-golden.`
    );
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as ExperienceEvalDataset;
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`Experience dataset "${name}" contains no cases.`);
  }
  return parsed;
}
