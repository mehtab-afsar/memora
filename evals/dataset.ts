import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type QuestionCategory =
  | "single-hop"
  | "multi-hop"
  | "temporal"
  | "exact-string"
  | "contradiction"
  | "abstain";

export type EvalQuestion = { q: string; gold: string; category: QuestionCategory };

export type EvalCase = {
  id: string;
  /** Opaque end-user id; each case gets its own so cases never contaminate one another. */
  userId: string;
  /** Conversation turns, replayed through remember() in order. */
  sessions: string[];
  questions: EvalQuestion[];
};

export type EvalDataset = { name: string; description: string; cases: EvalCase[] };

const DATASETS_DIR = join(process.cwd(), "evals", "datasets");

/**
 * `golden` ships with the repo. LoCoMo and LongMemEval are not redistributed
 * here — download them into evals/datasets/ and convert them to this shape
 * before running, and check their licence terms before publishing any number
 * derived from them.
 */
export function loadDataset(name: string): EvalDataset {
  const path = join(DATASETS_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Dataset "${name}" not found at ${path}.\n` +
        `Bundled datasets: golden.\n` +
        `For locomo/longmemeval, convert the source release into this file's shape ` +
        `({ name, description, cases: [{ id, userId, sessions, questions }] }) and drop it in evals/datasets/.`
    );
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as EvalDataset;
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`Dataset "${name}" contains no cases.`);
  }
  return parsed;
}

export function countQuestions(dataset: EvalDataset): number {
  return dataset.cases.reduce((sum, c) => sum + c.questions.length, 0);
}
