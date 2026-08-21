import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Converts the LoCoMo release into the shape `pnpm eval` reads.
 *
 *   curl -sL https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json \
 *     -o evals/datasets/raw/locomo10.json
 *   pnpm eval:convert-locomo --conversations 2 --questions 25
 *   pnpm eval --dataset locomo
 *
 * LoCoMo is CC BY-NC 4.0. Neither the raw release nor the converted file is
 * committed — both are gitignored — and any number derived from it needs that
 * licence checked before it goes anywhere public.
 *
 * Two things about LoCoMo do not fit Memora's model, and the numbers should be
 * read with both in mind rather than either being quietly papered over:
 *
 * 1. Conversations have two speakers, and questions are asked about both.
 *    Memora stores memories about *an* end user, so a conversation is loaded
 *    under one id with every turn attributed by name in the text. Extraction is
 *    prompted to write about "the user"; with two subjects it has to lean on
 *    names instead, which is a real test of whether it keeps them.
 *
 * 2. `remember()` has no parameter for when something happened — memories are
 *    stamped with write time. LoCoMo's temporal questions ask about dates in
 *    2023, so each session is prefixed with its own date and the date has to
 *    survive into the memory text to be recallable at all. A first-class
 *    occurred-at field is the real fix.
 */

type LocomoTurn = { speaker: string; dia_id: string; text: string; blip_caption?: string };
type LocomoQA = {
  question: string;
  answer?: string | number;
  adversarial_answer?: string;
  evidence?: string[];
  category: number;
};
type LocomoSample = {
  sample_id: string;
  qa: LocomoQA[];
  conversation: Record<string, unknown> & { speaker_a: string; speaker_b: string };
};

/**
 * Category codes, taken from the comments in LoCoMo's own task_eval/evaluation.py:
 * category 1 is scored with multi-hop partial-F1, [2, 3, 4] as "single-hop,
 * temporal, open-domain", and 5 as adversarial (correct iff the answer declines).
 * Category 1 also carries by far the most evidence ids per question (3.1 vs ~1.1),
 * which is what multi-hop looks like.
 */
const CATEGORY_NAMES: Record<number, string> = {
  1: "multi-hop",
  2: "temporal",
  3: "open-domain",
  4: "single-hop",
  5: "adversarial",
};

/** Our harness understands these; anything else is passed through by name. */
const CATEGORY_TO_OURS: Record<number, string> = {
  1: "multi-hop",
  2: "temporal",
  3: "open-domain",
  4: "single-hop",
  5: "abstain",
};

function sessionNumbers(conversation: Record<string, unknown>): number[] {
  return Object.keys(conversation)
    .map((key) => /^session_(\d+)$/.exec(key)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * One session becomes one `remember()` call. The date leads the text because
 * write time is not event time — see the note at the top of this file.
 */
function renderSession(conversation: Record<string, unknown>, n: number): string | null {
  const turns = conversation[`session_${n}`] as LocomoTurn[] | undefined;
  if (!Array.isArray(turns) || turns.length === 0) return null;

  const when = conversation[`session_${n}_date_time`];
  const header = typeof when === "string" ? `[${when}]\n` : "";
  const body = turns
    .map((turn) => {
      const caption = turn.blip_caption ? ` (shared an image: ${turn.blip_caption})` : "";
      return `${turn.speaker}: ${turn.text}${caption}`;
    })
    .join("\n");

  return `${header}${body}`;
}

function goldAnswer(qa: LocomoQA): string {
  if (qa.category === 5) {
    return "Unknown — the conversation does not say. The correct answer is to say so.";
  }
  return String(qa.answer ?? "").trim();
}

/**
 * Deterministic, and stratified so every category survives a small sample —
 * category 4 is 42% of the set and would otherwise crowd out open-domain, which
 * is 5%.
 */
function sampleQuestions(qa: LocomoQA[], limit: number | null): LocomoQA[] {
  const usable = qa.filter((q) => goldAnswer(q).length > 0);
  if (limit === null || usable.length <= limit) return usable;

  const byCategory = new Map<number, LocomoQA[]>();
  for (const q of usable) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  const categories = [...byCategory.keys()].sort();
  const picked: LocomoQA[] = [];

  // One from each category first, then fill proportionally, always taking from
  // the front of each list so a rerun of the same size picks the same questions.
  for (const category of categories) {
    const first = byCategory.get(category)?.[0];
    if (first && picked.length < limit) picked.push(first);
  }
  let index = 1;
  while (picked.length < limit) {
    let added = false;
    for (const category of categories) {
      const list = byCategory.get(category) ?? [];
      const share = Math.max(1, Math.round((list.length / usable.length) * limit));
      if (index < list.length && index < share && picked.length < limit) {
        picked.push(list[index]);
        added = true;
      }
    }
    if (!added) break;
    index += 1;
  }
  // Proportional rounding can leave the quota short; top up in order.
  for (const q of usable) {
    if (picked.length >= limit) break;
    if (!picked.includes(q)) picked.push(q);
  }

  return picked.slice(0, limit);
}

function main() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  const conversationLimit = get("--conversations") ? Number(get("--conversations")) : null;
  const questionLimit = get("--questions") ? Number(get("--questions")) : null;
  const inputPath = get("--in") ?? join(process.cwd(), "evals", "datasets", "raw", "locomo10.json");
  const outputPath = get("--out") ?? join(process.cwd(), "evals", "datasets", "locomo.json");

  if (!existsSync(inputPath)) {
    throw new Error(
      `LoCoMo release not found at ${inputPath}.\n` +
        `Download it first:\n` +
        `  mkdir -p evals/datasets/raw\n` +
        `  curl -sL https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json -o ${inputPath}`
    );
  }

  const samples = JSON.parse(readFileSync(inputPath, "utf8")) as LocomoSample[];
  const selected = conversationLimit ? samples.slice(0, conversationLimit) : samples;

  const cases = selected.map((sample) => {
    const sessions = sessionNumbers(sample.conversation)
      .map((n) => renderSession(sample.conversation, n))
      .filter((text): text is string => Boolean(text));

    const questions = sampleQuestions(sample.qa, questionLimit).map((qa) => ({
      q: qa.question,
      gold: goldAnswer(qa),
      category: CATEGORY_TO_OURS[qa.category] ?? `locomo-${qa.category}`,
      locomoCategory: CATEGORY_NAMES[qa.category] ?? String(qa.category),
      evidence: qa.evidence ?? [],
    }));

    return {
      id: sample.sample_id,
      userId: `locomo_${sample.sample_id}`,
      speakers: [sample.conversation.speaker_a, sample.conversation.speaker_b],
      sessions,
      questions,
    };
  });

  const totalSessions = cases.reduce((sum, c) => sum + c.sessions.length, 0);
  const totalQuestions = cases.reduce((sum, c) => sum + c.questions.length, 0);

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        name: "locomo",
        description:
          "LoCoMo (snap-research/locomo), converted for this harness. CC BY-NC 4.0 — not redistributed, " +
          "and any published number needs that licence checked first. Categories follow LoCoMo's own " +
          "evaluation code: 1 multi-hop, 2 temporal, 3 open-domain, 4 single-hop, 5 adversarial.",
        source: "https://github.com/snap-research/locomo",
        licence: "CC BY-NC 4.0",
        converted: { conversations: cases.length, sessions: totalSessions, questions: totalQuestions },
        cases,
      },
      null,
      2
    )
  );

  const byCategory = new Map<string, number>();
  for (const c of cases) {
    for (const q of c.questions) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
  }

  console.log(`\nConverted LoCoMo -> ${outputPath}`);
  console.log(`  conversations  ${cases.length}/${samples.length}`);
  console.log(`  sessions       ${totalSessions}  (one remember() call each)`);
  console.log(`  questions      ${totalQuestions}`);
  for (const [category, count] of [...byCategory.entries()].sort()) {
    console.log(`    ${category.padEnd(14)} ${count}`);
  }
  console.log(
    `\n  A full run costs roughly ${totalSessions + totalQuestions} embedding calls and ` +
      `${totalSessions * 2 + totalQuestions * 2} model calls.\n`
  );
}

main();
