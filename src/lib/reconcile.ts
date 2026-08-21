import { and, eq, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql";
import { db } from "@/db";
import { contradictions, memories, memoryEvidence, reconciliationJobs } from "@/db/schema";
import { decideMemoryAction, type ExistingMemoryForDecision } from "@/lib/anthropic";
import type { MemoryMetadata } from "@/lib/memory-types";
import { embedDocument } from "@/lib/voyage";
import { mapWithConcurrency } from "@/lib/scoring";

/**
 * Reconciliation — the judgement half of remember().
 *
 * Writes are append-only: remember() extracts, embeds and inserts, then queues
 * one job per memory and returns. This module does what the write path used to
 * do inline — ask Claude whether the new memory is an addition, a new version,
 * a merge, a restatement or a contradiction — and then *repairs* the record
 * rather than gating it.
 *
 * The audit trail is unchanged: the same evidence rows, the same stated
 * reasoning, the same contradiction records. What changes is that none of it
 * blocks the caller's response.
 */

const NEAREST_NEIGHBOR_LIMIT = 5;
const MAX_ATTEMPTS = 3;

export type ReconcileResult = {
  memoryId: string;
  decision: "ADD" | "UPDATE" | "MERGE" | "IGNORE" | "FLAG";
  reasoning: string;
};

export async function reconcileMemory(memoryId: string): Promise<ReconcileResult | null> {
  const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1);
  if (!memory) return null;

  // Idempotent: a job retried after a partial failure must not re-apply a
  // decision that already landed.
  if (memory.reconciledAt) return null;

  const distanceExpr = cosineDistance(memories.embedding, memory.embedding ?? []);
  const nearestRows = await db
    .select({
      id: memories.id,
      content: memories.content,
      type: memories.type,
      confidence: memories.confidence,
      createdAt: memories.createdAt,
      lastConfirmedAt: memories.lastConfirmedAt,
      distance: distanceExpr,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, memory.projectId),
        eq(memories.environmentId, memory.environmentId),
        eq(memories.endUserId, memory.endUserId),
        eq(memories.status, "active"),
        ne(memories.id, memory.id),
        // A settled past: rows written before this one, plus any sibling from
        // the same write that has already been reconciled (jobs drain in
        // insertion order, so earlier siblings are done by the time this runs).
        //
        // Not `createdAt <= this.createdAt`: every row in one insert shares a
        // microsecond-precision timestamp, and the JS Date carrying it back
        // truncates to milliseconds — so that comparison silently excluded
        // every sibling, and two facts extracted from the same sentence were
        // never compared to each other.
        or(lt(memories.createdAt, memory.createdAt), isNotNull(memories.reconciledAt))
      )
    )
    .orderBy(distanceExpr)
    .limit(NEAREST_NEIGHBOR_LIMIT);

  const nearestExisting: ExistingMemoryForDecision[] = nearestRows.map((row) => ({
    id: row.id,
    content: row.content,
    type: row.type,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
    lastConfirmedAt: row.lastConfirmedAt.toISOString(),
    similarity: 1 - Number(row.distance),
  }));

  // The extraction rationale is persisted in metadata at write time precisely
  // so the decision below sees the same candidate the old inline path did.
  const metadata = (memory.metadata ?? {}) as MemoryMetadata;

  const decision = await decideMemoryAction(
    {
      content: memory.content,
      type: memory.type,
      confidence: memory.confidence,
      importance: memory.importance,
      rationale: metadata.extractionRationale ?? "",
    },
    nearestExisting
  );

  // A malformed tool response — a truncated or mangled key — would otherwise
  // fall through the switch below and mark the memory reconciled without ever
  // judging it. Throwing puts the job back on the queue instead.
  const DECISIONS = ["ADD", "UPDATE", "MERGE", "IGNORE", "FLAG"] as const;
  if (!DECISIONS.includes(decision.decision)) {
    throw new Error(`Reconciliation got an unusable decision: ${JSON.stringify(decision).slice(0, 200)}`);
  }

  const now = new Date();

  switch (decision.decision) {
    case "ADD":
      // Already written. Nothing to repair.
      break;

    case "UPDATE": {
      if (!decision.target_memory_id) throw new Error("UPDATE decision missing target_memory_id");
      await supersede({
        newMemoryId: memory.id,
        oldMemoryId: decision.target_memory_id,
        reasoning: decision.reasoning,
        sourceType: memory.sourceType,
        sourceId: memory.sourceId,
        excerpt: memory.content,
        now,
      });
      break;
    }

    case "MERGE": {
      if (!decision.target_memory_id || !decision.merged_content) {
        throw new Error("MERGE decision missing target_memory_id or merged_content");
      }
      const [target] = await db
        .select()
        .from(memories)
        .where(eq(memories.id, decision.target_memory_id))
        .limit(1);
      if (!target) throw new Error("MERGE target memory not found");

      // The appended row becomes the merged version, so the id the caller was
      // handed stays valid and keeps its evidence.
      const mergedEmbedding = await embedDocument(decision.merged_content);
      await db
        .update(memories)
        .set({
          content: decision.merged_content,
          embedding: mergedEmbedding,
          confidence: Math.max(target.confidence, memory.confidence),
          importance: Math.max(target.importance, memory.importance),
          updatedAt: now,
        })
        .where(eq(memories.id, memory.id));

      await supersede({
        newMemoryId: memory.id,
        oldMemoryId: target.id,
        reasoning: decision.reasoning,
        sourceType: memory.sourceType,
        sourceId: memory.sourceId,
        excerpt: memory.content,
        now,
      });
      break;
    }

    case "IGNORE": {
      // Two different cases share this verdict, and they mean opposite things.
      //
      // With a target: a restatement of something already known. The appended
      // row is retired rather than deleted, so the id the caller received stays
      // resolvable, and the memory it restates is refreshed and gains the
      // evidence. Deliberately NOT linked with supersedesId — that column means
      // "this version replaced that one" and drives the version chain, and a
      // restatement is not a new version. The link lives in metadata instead.
      //
      // Without a target: the decider judged the candidate too trivial to keep
      // at all. Leaving it active would mean persisting something the system
      // just declared not worth persisting — and would throw away the cleanest
      // negative example extraction ever gets. See src/lib/feedback.ts.
      if (!decision.target_memory_id) {
        await db
          .update(memories)
          .set({
            status: "archived",
            metadata: { ...metadata, discarded: "trivial" },
            updatedAt: now,
          })
          .where(eq(memories.id, memory.id));
        await db.insert(memoryEvidence).values({
          memoryId: memory.id,
          sourceType: memory.sourceType,
          sourceId: memory.sourceId,
          excerpt: memory.content,
          eventType: "updated",
          reasoning: `Discarded as too trivial to persist. ${decision.reasoning}`,
        });
        break;
      }

      {
        await db
          .update(memories)
          .set({
            status: "archived",
            metadata: { ...metadata, discarded: "restatement", restatesMemoryId: decision.target_memory_id },
            updatedAt: now,
          })
          .where(eq(memories.id, memory.id));
        await db
          .update(memories)
          .set({ lastConfirmedAt: now })
          .where(eq(memories.id, decision.target_memory_id));
        await db.insert(memoryEvidence).values({
          memoryId: decision.target_memory_id,
          sourceType: memory.sourceType,
          sourceId: memory.sourceId,
          excerpt: memory.content,
          eventType: "reconfirmed",
          reasoning: decision.reasoning,
        });
      }
      break;
    }

    case "FLAG": {
      await db.update(memories).set({ status: "flagged", updatedAt: now }).where(eq(memories.id, memory.id));
      const conflictingId = decision.contradiction.conflicting_memory_id;
      if (conflictingId) {
        await db.insert(contradictions).values({
          projectId: memory.projectId,
          memoryIdA: memory.id,
          memoryIdB: conflictingId,
          reasoning: decision.reasoning,
        });
        await db.update(memories).set({ status: "flagged", updatedAt: now }).where(eq(memories.id, conflictingId));
      }
      break;
    }
  }

  await db.update(memories).set({ reconciledAt: now }).where(eq(memories.id, memory.id));

  return { memoryId: memory.id, decision: decision.decision, reasoning: decision.reasoning };
}

async function supersede(params: {
  newMemoryId: string;
  oldMemoryId: string;
  reasoning: string;
  sourceType: string;
  sourceId: string | null;
  excerpt: string;
  now: Date;
}) {
  const { newMemoryId, oldMemoryId, reasoning, sourceType, sourceId, excerpt, now } = params;

  await db
    .update(memories)
    .set({ supersedesId: oldMemoryId, updatedAt: now })
    .where(eq(memories.id, newMemoryId));

  await db
    .update(memories)
    .set({ status: "superseded", updatedAt: now })
    .where(eq(memories.id, oldMemoryId));

  await db.insert(memoryEvidence).values({
    memoryId: newMemoryId,
    sourceType,
    sourceId,
    excerpt,
    eventType: "updated",
    reasoning,
  });
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export type JobScope = { projectId: string; environmentId: string; endUserId?: string };

type ClaimedJob = { id: string; memory_id: string; attempts: number; end_user_id: string };

/**
 * How many end users are reconciled at once. Each in-flight job holds a model
 * call and a database connection, so this is bounded by the smaller of the two
 * — the default pg pool is 10.
 */
const USER_CONCURRENCY = Number(process.env.RECONCILE_CONCURRENCY ?? 5);

/**
 * Claims up to `limit` pending jobs and runs them. `FOR UPDATE SKIP LOCKED`
 * means the request-time drain and a background worker can run concurrently
 * without doing each other's work twice.
 *
 * Returns the number of jobs that completed successfully.
 */
export async function drainPendingJobs(scope: JobScope | null, limit = 25): Promise<number> {
  const scopeFilter = scope
    ? sql`AND project_id = ${scope.projectId} AND environment_id = ${scope.environmentId} ${
        scope.endUserId ? sql`AND end_user_id = ${scope.endUserId}` : sql``
      }`
    : sql``;

  const claimed = await db.execute<ClaimedJob>(sql`
    UPDATE reconciliation_jobs
       SET status = 'running', attempts = attempts + 1, started_at = now()
     WHERE id IN (
       SELECT id FROM reconciliation_jobs
        WHERE status = 'pending' ${scopeFilter}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, memory_id, attempts, end_user_id
  `);

  // Jobs are grouped by end user and the groups run in parallel, because a
  // memory is only ever compared against others belonging to the same end user
  // — the neighbour query filters on it. Two users can never influence each
  // other's verdicts, so there is nothing to serialise between them.
  //
  // Within a user, order still matters and the group stays sequential: sibling
  // candidates from one write see each other only once the earlier one has been
  // reconciled. Judging them concurrently would make each blind to the other
  // and let a duplicate through that should have been merged.
  const byUser = new Map<string, ClaimedJob[]>();
  for (const job of claimed.rows) {
    const group = byUser.get(job.end_user_id) ?? [];
    group.push(job);
    byUser.set(job.end_user_id, group);
  }

  const runOne = async (job: ClaimedJob): Promise<boolean> => {
    try {
      await reconcileMemory(job.memory_id);
      await db
        .update(reconciliationJobs)
        .set({ status: "done", finishedAt: new Date(), lastError: null })
        .where(eq(reconciliationJobs.id, job.id));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      await db
        .update(reconciliationJobs)
        .set({
          // Back to pending for another pass; failed once the attempts are spent,
          // where it stays visible rather than disappearing.
          status: exhausted ? "failed" : "pending",
          lastError: message,
          finishedAt: exhausted ? new Date() : null,
        })
        .where(eq(reconciliationJobs.id, job.id));
      return false;
    }
  };

  const perUser = await mapWithConcurrency([...byUser.values()], USER_CONCURRENCY, async (group) => {
    let done = 0;
    for (const job of group) if (await runOne(job)) done += 1;
    return done;
  });

  return perUser.reduce((sum, n) => sum + n, 0);
}

export async function pendingJobCount(scope: JobScope | null = null): Promise<number> {
  const rows = scope
    ? await db
        .select({ id: reconciliationJobs.id })
        .from(reconciliationJobs)
        .where(
          and(
            eq(reconciliationJobs.status, "pending"),
            eq(reconciliationJobs.projectId, scope.projectId),
            eq(reconciliationJobs.environmentId, scope.environmentId)
          )
        )
    : await db.select({ id: reconciliationJobs.id }).from(reconciliationJobs).where(eq(reconciliationJobs.status, "pending"));
  return rows.length;
}
