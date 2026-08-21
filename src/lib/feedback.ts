import { and, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { memories, memoryEvidence } from "@/db/schema";

/**
 * The feedback loop.
 *
 * Every reconciliation verdict is a graded example of extraction's work, and
 * we already store all of them. A memory that was reconfirmed three times was
 * clearly worth keeping; one the decider called too trivial to persist, or that
 * a human archived by hand, clearly was not. Nothing in the system used any of
 * that until now — the same prompt ran for a customer on day 1 and day 400.
 *
 * This module reads those outcomes back and turns them into two things:
 *
 *   1. Few-shot examples, scoped to one project, injected into the extraction
 *      prompt — so the system learns what *this* customer considers worth
 *      remembering. A legal SaaS and a fitness app disagree profoundly about
 *      that, and until now they got identical instructions.
 *   2. A survival rate: what fraction of extracted memories are still active
 *      after a month. It is the closest thing to a precision metric we can
 *      compute without asking a human to label anything.
 *
 * Nothing here is trained or fine-tuned. It is retrieval over our own history,
 * which is cheaper, immediately reversible, and inspectable — a customer can be
 * shown exactly which examples shaped a decision.
 */

export type ExtractionExample = { content: string; type: string; reason: string };

export type ExtractionExamples = {
  /** Memories this project's own history shows were worth keeping. */
  kept: ExtractionExample[];
  /** Candidates that should not have been extracted at all. */
  discarded: ExtractionExample[];
};

const EXAMPLES_PER_SIDE = 5;

/**
 * A memory is strong evidence of a *good* extraction when it has been
 * independently reconfirmed — the user said the same thing again, which is the
 * clearest signal a fact mattered — or when it has actually been retrieved.
 * A memory that merely still exists proves nothing; nobody looked at it.
 */
async function keptExamples(projectId: string): Promise<ExtractionExample[]> {
  const rows = await db
    .select({
      content: memories.content,
      type: memories.type,
      recallCount: memories.recallCount,
      confirmations: sql<number>`count(${memoryEvidence.id}) filter (where ${memoryEvidence.eventType} = 'reconfirmed')`,
    })
    .from(memories)
    .leftJoin(memoryEvidence, eq(memoryEvidence.memoryId, memories.id))
    .where(and(eq(memories.projectId, projectId), eq(memories.status, "active")))
    .groupBy(memories.id, memories.content, memories.type, memories.recallCount)
    .having(sql`count(${memoryEvidence.id}) filter (where ${memoryEvidence.eventType} = 'reconfirmed') > 0 or ${memories.recallCount} > 0`)
    .orderBy(desc(memories.recallCount), desc(memories.lastConfirmedAt))
    .limit(EXAMPLES_PER_SIDE);

  return rows.map((row) => ({
    content: row.content,
    type: row.type,
    reason:
      Number(row.confirmations) > 0
        ? `restated by the user ${Number(row.confirmations)} more time(s)`
        : `retrieved ${row.recallCount} time(s) to answer a question`,
  }));
}

/**
 * The negative side. Ordered so a human's judgement outranks the system's own:
 * someone looking at a memory and archiving it is the strongest signal we ever
 * get that it should not have been extracted.
 */
async function discardedExamples(projectId: string): Promise<ExtractionExample[]> {
  const rows = await db
    .select({ content: memories.content, type: memories.type, metadata: memories.metadata })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, projectId),
        eq(memories.status, "archived"),
        // `restatement` is excluded on purpose. A user repeating themselves is
        // not an extraction error — extraction was right to pick it up both
        // times, and reconciliation was right to retire the duplicate.
        sql`${memories.metadata}->>'discarded' in ('human', 'trivial')`
      )
    )
    .orderBy(sql`case when ${memories.metadata}->>'discarded' = 'human' then 0 else 1 end`, desc(memories.updatedAt))
    .limit(EXAMPLES_PER_SIDE);

  return rows.map((row) => {
    const discarded = (row.metadata as { discarded?: string } | null)?.discarded;
    return {
      content: row.content,
      type: row.type,
      reason: discarded === "human" ? "a person archived this as not worth keeping" : "judged too trivial to persist",
    };
  });
}

/**
 * Reads this project's own history. Returns empty lists for a new project,
 * which is correct — with nothing learned yet, extraction should behave exactly
 * as it does today rather than being steered by another tenant's taste.
 */
export async function extractionExamples(projectId: string): Promise<ExtractionExamples> {
  const [kept, discarded] = await Promise.all([keptExamples(projectId), discardedExamples(projectId)]);
  return { kept, discarded };
}

/**
 * Renders examples for the extraction prompt. Returns an empty string when
 * there is nothing to teach, so the prompt is byte-identical to the unlearned
 * one — which keeps prompt caching effective for new projects and makes the
 * "did the examples change anything?" comparison clean.
 */
export function renderExamples({ kept, discarded }: ExtractionExamples): string {
  if (kept.length === 0 && discarded.length === 0) return "";

  const lines: string[] = [
    "",
    "Learned from this specific application's own history. These are not rules — they are evidence of what has proven worth remembering here, and what has not. Weigh them against the guidance above; where they conflict, the guidance wins.",
  ];

  if (kept.length > 0) {
    lines.push("", "Worth keeping (this application's own memories that proved useful):");
    for (const e of kept) lines.push(`- [${e.type}] ${e.content}  — ${e.reason}`);
  }
  if (discarded.length > 0) {
    lines.push("", "Not worth keeping (extracted here before, then discarded):");
    for (const e of discarded) lines.push(`- [${e.type}] ${e.content}  — ${e.reason}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Survival rate
// ---------------------------------------------------------------------------

export type SurvivalRate = {
  /** Memories written before the cutoff that were old enough to be judged. */
  cohort: number;
  /** How many of them are still active. */
  surviving: number;
  /** surviving / cohort, or null when the cohort is too small to mean anything. */
  rate: number | null;
  /** Breakdown of what happened to the rest. */
  discardedBy: { trivial: number; restatement: number; human: number; superseded: number };
};

const MIN_COHORT = 20;

/**
 * What fraction of what we extracted turned out to be worth keeping.
 *
 * Only counts memories old enough to have been judged and had a chance to be
 * restated or archived — a memory written five minutes ago has survived
 * nothing. Superseded memories count as survivors: being replaced by a newer
 * version means the fact was real and tracked, not that extraction erred.
 */
export async function survivalRate(projectId: string, windowDays = 30): Promise<SurvivalRate> {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000);

  const rows = await db
    .select({
      status: memories.status,
      discarded: sql<string | null>`${memories.metadata}->>'discarded'`,
      total: sql<number>`count(*)`,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, projectId),
        lt(memories.createdAt, cutoff),
        isNotNull(memories.reconciledAt)
      )
    )
    .groupBy(memories.status, sql`${memories.metadata}->>'discarded'`);

  const discardedBy = { trivial: 0, restatement: 0, human: 0, superseded: 0 };
  let cohort = 0;
  let surviving = 0;

  for (const row of rows) {
    const n = Number(row.total);
    cohort += n;
    if (row.status === "active" || row.status === "flagged") surviving += n;
    else if (row.status === "superseded") {
      surviving += n;
      discardedBy.superseded += n;
    } else if (row.discarded && row.discarded in discardedBy) {
      discardedBy[row.discarded as keyof typeof discardedBy] += n;
    }
  }

  return {
    cohort,
    surviving,
    rate: cohort >= MIN_COHORT ? surviving / cohort : null,
    discardedBy,
  };
}

/**
 * Records that these memories were actually used to answer something. Called
 * fire-and-forget from recall: one indexed statement, and a failure here must
 * never fail a read.
 */
export async function recordRecallHits(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  await db
    .update(memories)
    .set({ recallCount: sql`${memories.recallCount} + 1`, lastRecalledAt: new Date() })
    .where(sql`${memories.id} in (${sql.join(memoryIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
}
