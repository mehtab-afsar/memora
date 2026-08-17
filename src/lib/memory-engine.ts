import { and, count, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql";
import { db } from "@/db";
import {
  memories,
  memoryEvidence,
  contradictions,
  type memoryStatusEnum,
  type memoryTypeEnum,
} from "@/db/schema";
import { extractMemories, decideMemoryAction, verifyMemory, type ExistingMemoryForDecision } from "@/lib/anthropic";
import { embedDocument, embedQuery } from "@/lib/voyage";

type Scope = { projectId: string; environmentId: string; endUserId: string };
type ProjectScope = { projectId: string; environmentId: string };

const NEAREST_NEIGHBOR_LIMIT = 5;

// ---------------------------------------------------------------------------
// remember()
// ---------------------------------------------------------------------------

export type RememberOutcome = {
  candidateContent: string;
  decision: "ADD" | "UPDATE" | "MERGE" | "IGNORE" | "FLAG";
  memoryId: string | null;
  reasoning: string;
};

export async function remember(
  scope: Scope & { content: string; sourceType: string; sourceId?: string }
): Promise<{ outcomes: RememberOutcome[] }> {
  const { projectId, environmentId, endUserId, content, sourceType, sourceId } = scope;

  const candidates = await extractMemories(content);
  const outcomes: RememberOutcome[] = [];

  // Processed one candidate at a time (v1 simplification — see plan) so each
  // decision sees any memories written earlier in this same remember() call.
  for (const candidate of candidates) {
    const embedding = await embedDocument(candidate.content);

    const distanceExpr = cosineDistance(memories.embedding, embedding);
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
          eq(memories.projectId, projectId),
          eq(memories.environmentId, environmentId),
          eq(memories.endUserId, endUserId),
          eq(memories.status, "active")
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

    const decision = await decideMemoryAction(candidate, nearestExisting);
    const outcome = await persistDecision({
      scope: { projectId, environmentId, endUserId },
      candidate,
      embedding,
      decision,
      sourceType,
      sourceId,
    });
    outcomes.push(outcome);
  }

  return { outcomes };
}

async function persistDecision(params: {
  scope: Scope;
  candidate: { content: string; type: string; confidence: number; importance: number };
  embedding: number[];
  decision: Awaited<ReturnType<typeof decideMemoryAction>>;
  sourceType: string;
  sourceId?: string;
}): Promise<RememberOutcome> {
  const { scope, candidate, embedding, decision, sourceType, sourceId } = params;

  switch (decision.decision) {
    case "ADD": {
      const [row] = await db
        .insert(memories)
        .values({
          projectId: scope.projectId,
          environmentId: scope.environmentId,
          endUserId: scope.endUserId,
          content: candidate.content,
          type: candidate.type as (typeof memories.$inferInsert)["type"],
          confidence: candidate.confidence,
          importance: candidate.importance,
          sourceType,
          sourceId,
          embedding,
        })
        .returning();
      await insertEvidence(row.id, sourceType, sourceId, candidate.content, "extracted");
      return { candidateContent: candidate.content, decision: "ADD", memoryId: row.id, reasoning: decision.reasoning };
    }

    case "UPDATE": {
      if (!decision.target_memory_id) throw new Error("UPDATE decision missing target_memory_id");
      const newRow = await createNewVersion({
        scope,
        oldMemoryId: decision.target_memory_id,
        content: candidate.content,
        type: candidate.type,
        confidence: candidate.confidence,
        importance: candidate.importance,
        embedding,
        sourceType,
        sourceId,
        reasoning: decision.reasoning,
      });
      return { candidateContent: candidate.content, decision: "UPDATE", memoryId: newRow.id, reasoning: decision.reasoning };
    }

    case "MERGE": {
      if (!decision.target_memory_id || !decision.merged_content) {
        throw new Error("MERGE decision missing target_memory_id or merged_content");
      }
      const [oldMemory] = await db.select().from(memories).where(eq(memories.id, decision.target_memory_id)).limit(1);
      if (!oldMemory) throw new Error("MERGE target memory not found");

      const mergedEmbedding = await embedDocument(decision.merged_content);
      const newRow = await createNewVersion({
        scope,
        oldMemoryId: decision.target_memory_id,
        content: decision.merged_content,
        type: oldMemory.type,
        confidence: Math.max(oldMemory.confidence, candidate.confidence),
        importance: Math.max(oldMemory.importance, candidate.importance),
        embedding: mergedEmbedding,
        sourceType,
        sourceId,
        reasoning: decision.reasoning,
      });
      return {
        candidateContent: candidate.content,
        decision: "MERGE",
        memoryId: newRow.id,
        reasoning: decision.reasoning,
      };
    }

    case "IGNORE": {
      // A redundant restatement of an existing memory is a confirmation signal,
      // not a no-op — refresh its freshness and record the reconfirmation.
      if (decision.target_memory_id) {
        await db
          .update(memories)
          .set({ lastConfirmedAt: new Date() })
          .where(eq(memories.id, decision.target_memory_id));
        await insertEvidence(decision.target_memory_id, sourceType, sourceId, candidate.content, "reconfirmed");
      }
      return {
        candidateContent: candidate.content,
        decision: "IGNORE",
        memoryId: decision.target_memory_id ?? null,
        reasoning: decision.reasoning,
      };
    }

    case "FLAG": {
      const [row] = await db
        .insert(memories)
        .values({
          projectId: scope.projectId,
          environmentId: scope.environmentId,
          endUserId: scope.endUserId,
          content: candidate.content,
          type: candidate.type as (typeof memories.$inferInsert)["type"],
          confidence: candidate.confidence,
          importance: candidate.importance,
          status: "flagged",
          sourceType,
          sourceId,
          embedding,
        })
        .returning();
      await insertEvidence(row.id, sourceType, sourceId, candidate.content, "extracted");
      if (decision.contradiction.conflicting_memory_id) {
        await db.insert(contradictions).values({
          projectId: scope.projectId,
          memoryIdA: row.id,
          memoryIdB: decision.contradiction.conflicting_memory_id,
          reasoning: decision.contradiction.reasoning ?? decision.reasoning,
        });
      }
      return { candidateContent: candidate.content, decision: "FLAG", memoryId: row.id, reasoning: decision.reasoning };
    }
  }
}

async function insertEvidence(
  memoryId: string,
  sourceType: string,
  sourceId: string | undefined,
  excerpt: string,
  eventType: "extracted" | "reconfirmed" | "updated" | "verified",
  reasoning?: string
) {
  await db.insert(memoryEvidence).values({ memoryId, sourceType, sourceId, excerpt, eventType, reasoning });
}

/**
 * The single versioning mechanism: every real content change — whether from
 * remember()'s UPDATE/MERGE decisions or a manual dashboard edit — creates a
 * new row linked via supersedesId rather than overwriting in place, so no
 * prior wording is ever silently lost. Walk the chain with getVersionChain().
 */
async function createNewVersion(params: {
  scope: Scope;
  oldMemoryId: string;
  content: string;
  type: string;
  confidence: number;
  importance: number;
  embedding: number[];
  sourceType: string;
  sourceId?: string;
  reasoning: string;
}) {
  const { scope, oldMemoryId, content, type, confidence, importance, embedding, sourceType, sourceId, reasoning } = params;

  const [newRow] = await db
    .insert(memories)
    .values({
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      endUserId: scope.endUserId,
      content,
      type: type as (typeof memories.$inferInsert)["type"],
      confidence,
      importance,
      sourceType,
      sourceId,
      embedding,
      supersedesId: oldMemoryId,
    })
    .returning();

  await db.update(memories).set({ status: "superseded" }).where(eq(memories.id, oldMemoryId));
  await insertEvidence(newRow.id, sourceType, sourceId, content, "updated", reasoning);

  return newRow;
}

// ---------------------------------------------------------------------------
// recall()
// ---------------------------------------------------------------------------

const RECALL_WEIGHTS = { similarity: 0.6, confidence: 0.25, freshness: 0.15 };
const FRESHNESS_HALF_LIFE_DAYS = 90;

export type RecallResult = {
  memoryId: string;
  content: string;
  type: string;
  similarity: number;
  confidence: number;
  freshness: number;
  relevanceScore: number;
  reason: string;
};

export async function recall(scope: Scope & { query: string; topK?: number }): Promise<RecallResult[]> {
  const { projectId, environmentId, endUserId, query, topK = 10 } = scope;

  const queryEmbedding = await embedQuery(query);
  const distanceExpr = cosineDistance(memories.embedding, queryEmbedding);

  const rows = await db
    .select({
      id: memories.id,
      content: memories.content,
      type: memories.type,
      confidence: memories.confidence,
      lastConfirmedAt: memories.lastConfirmedAt,
      distance: distanceExpr,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, projectId),
        eq(memories.environmentId, environmentId),
        eq(memories.endUserId, endUserId),
        eq(memories.status, "active")
      )
    )
    .orderBy(distanceExpr)
    .limit(topK * 3);

  const now = Date.now();
  const scored = rows.map((row) => {
    const similarity = 1 - Number(row.distance);
    const ageDays = (now - row.lastConfirmedAt.getTime()) / (1000 * 60 * 60 * 24);
    const freshness = Math.exp(-ageDays / FRESHNESS_HALF_LIFE_DAYS);
    const relevanceScore =
      RECALL_WEIGHTS.similarity * similarity +
      RECALL_WEIGHTS.confidence * row.confidence +
      RECALL_WEIGHTS.freshness * freshness;

    const reasonParts: string[] = [];
    if (similarity > 0.8) reasonParts.push(`high semantic match (${similarity.toFixed(2)})`);
    else if (similarity > 0.5) reasonParts.push(`moderate semantic match (${similarity.toFixed(2)})`);
    else reasonParts.push(`weak semantic match (${similarity.toFixed(2)})`);
    if (row.confidence > 0.8) reasonParts.push("high confidence");
    if (freshness > 0.8) reasonParts.push("recently confirmed");
    else if (freshness < 0.3) reasonParts.push("not recently confirmed");

    return {
      memoryId: row.id,
      content: row.content,
      type: row.type,
      similarity,
      confidence: row.confidence,
      freshness,
      relevanceScore,
      reason: reasonParts.join(", "),
    };
  });

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, topK);
}

/**
 * Project-scoped (not environment-scoped) lookup for the dashboard: a memory
 * detail page is reached by ID and needs to discover its own environmentId
 * before it can call the environment-scoped engine functions below. The API
 * surface never uses this — API keys are already environment-scoped, so
 * `explain()`/`verify()`/etc are called directly with both ids known.
 */
export async function getMemoryInProject(memoryId: string, projectId: string) {
  const [memory] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.projectId, projectId)))
    .limit(1);
  return memory ?? null;
}

// ---------------------------------------------------------------------------
// explain()
// ---------------------------------------------------------------------------

export async function explain(memoryId: string, projectScope: { projectId: string; environmentId: string }) {
  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .limit(1);
  if (!memory) return null;

  const evidence = await db
    .select()
    .from(memoryEvidence)
    .where(eq(memoryEvidence.memoryId, memoryId))
    .orderBy(memoryEvidence.createdAt);

  const relatedContradictions = await db
    .select()
    .from(contradictions)
    .where(sql`${contradictions.memoryIdA} = ${memoryId} OR ${contradictions.memoryIdB} = ${memoryId}`);

  const versionChain = await getVersionChain(memoryId, projectScope);

  return {
    memory,
    evidence,
    contradictions: relatedContradictions,
    versions: versionChain?.versions ?? [{ ...memory, changeReasoning: null }],
    versionIndex: versionChain?.currentIndex ?? 0,
  };
}

/**
 * Walks the full supersedesId chain for a memory — backward to the root
 * (oldest version), then forward to the tip (newest) — so the dashboard can
 * render a complete v1..vN timeline rather than a single hop in each
 * direction. Every version in the chain shares the same lineage regardless
 * of which one `memoryId` points at.
 */
export async function getVersionChain(memoryId: string, projectScope: { projectId: string; environmentId: string }) {
  const [start] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .limit(1);
  if (!start) return null;

  let root = start;
  while (root.supersedesId) {
    const [prev] = await db.select().from(memories).where(eq(memories.id, root.supersedesId)).limit(1);
    if (!prev) break;
    root = prev;
  }

  const versions = [root];
  let current = root;
  while (true) {
    const [next] = await db.select().from(memories).where(eq(memories.supersedesId, current.id)).limit(1);
    if (!next) break;
    versions.push(next);
    current = next;
  }

  // Each version gets exactly one "extracted"/"updated" evidence row at the
  // moment it's created — that row's reasoning is why *this* version replaced
  // the last one. Fetch them all in one query rather than N+1 per version.
  const creationEvidence = await db
    .select({
      memoryId: memoryEvidence.memoryId,
      reasoning: memoryEvidence.reasoning,
      createdAt: memoryEvidence.createdAt,
    })
    .from(memoryEvidence)
    .where(
      and(
        inArray(
          memoryEvidence.memoryId,
          versions.map((v) => v.id)
        ),
        inArray(memoryEvidence.eventType, ["extracted", "updated"])
      )
    )
    .orderBy(memoryEvidence.createdAt);

  const reasoningByMemoryId = new Map(creationEvidence.map((e) => [e.memoryId, e.reasoning]));

  return {
    versions: versions.map((v) => ({ ...v, changeReasoning: reasoningByMemoryId.get(v.id) ?? null })),
    currentIndex: versions.findIndex((m) => m.id === memoryId),
  };
}

// ---------------------------------------------------------------------------
// verify()
// ---------------------------------------------------------------------------

export async function verify(memoryId: string, projectScope: { projectId: string; environmentId: string }) {
  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .limit(1);
  if (!memory) return null;

  const evidenceCount = (await db.select().from(memoryEvidence).where(eq(memoryEvidence.memoryId, memoryId))).length;

  const result = await verifyMemory({
    content: memory.content,
    type: memory.type,
    currentConfidence: memory.confidence,
    createdAt: memory.createdAt.toISOString(),
    lastConfirmedAt: memory.lastConfirmedAt.toISOString(),
    evidenceCount,
  });

  const [updated] = await db
    .update(memories)
    .set({
      confidence: result.confidence,
      status: result.status,
      lastConfirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(memories.id, memoryId))
    .returning();

  if (!updated) return null;
  await insertEvidence(memoryId, "verification", undefined, result.reasoning, "verified");

  return { memory: updated, reasoning: result.reasoning };
}

// ---------------------------------------------------------------------------
// update() / forget()
// ---------------------------------------------------------------------------

export async function updateMemory(
  memoryId: string,
  projectScope: { projectId: string; environmentId: string },
  patch: { content?: string; confidence?: number; importance?: number }
) {
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .limit(1);
  if (!existing) return null;

  // A real content change gets versioned (new row, chain via supersedesId);
  // a pure confidence/importance tweak updates in place — not a new version.
  const contentChanged = patch.content !== undefined && patch.content !== existing.content;

  if (contentChanged) {
    const embedding = await embedDocument(patch.content!);
    return createNewVersion({
      scope: { projectId: existing.projectId, environmentId: existing.environmentId, endUserId: existing.endUserId },
      oldMemoryId: existing.id,
      content: patch.content!,
      type: existing.type,
      confidence: patch.confidence ?? existing.confidence,
      importance: patch.importance ?? existing.importance,
      embedding,
      sourceType: "manual_correction",
      reasoning: "Manually edited via the dashboard.",
    });
  }

  const values: Partial<typeof memories.$inferInsert> = { updatedAt: new Date(), lastConfirmedAt: new Date() };
  if (patch.confidence !== undefined) values.confidence = patch.confidence;
  if (patch.importance !== undefined) values.importance = patch.importance;

  const [updated] = await db.update(memories).set(values).where(eq(memories.id, memoryId)).returning();
  if (updated) {
    await insertEvidence(memoryId, "manual_correction", undefined, "Confidence/importance adjusted manually.", "updated");
  }
  return updated ?? null;
}

/** Soft-delete: archives rather than hard-deletes, preserving the evidence trail. */
export async function forgetMemory(memoryId: string, projectScope: { projectId: string; environmentId: string }) {
  const [updated] = await db
    .update(memories)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.projectId, projectScope.projectId),
        eq(memories.environmentId, projectScope.environmentId)
      )
    )
    .returning();
  return updated ?? null;
}

// ---------------------------------------------------------------------------
// listMemories() — shared by the /api/v1/memories route and the dashboard Explorer
// ---------------------------------------------------------------------------

export type MemoryFilters = {
  endUserId?: string;
  status?: (typeof memoryStatusEnum.enumValues)[number];
  type?: (typeof memoryTypeEnum.enumValues)[number];
  search?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
};

export async function listMemories(scope: ProjectScope, filters: MemoryFilters = {}) {
  const { endUserId, status, type, search, minConfidence, limit = 50, offset = 0 } = filters;

  const conditions = [eq(memories.projectId, scope.projectId), eq(memories.environmentId, scope.environmentId)];
  if (endUserId) conditions.push(eq(memories.endUserId, endUserId));
  if (status) conditions.push(eq(memories.status, status));
  if (type) conditions.push(eq(memories.type, type));
  if (minConfidence !== undefined) conditions.push(gte(memories.confidence, minConfidence));
  if (search) conditions.push(ilike(memories.content, `%${search}%`));

  const whereClause = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: memories.id,
        endUserId: memories.endUserId,
        content: memories.content,
        type: memories.type,
        status: memories.status,
        confidence: memories.confidence,
        importance: memories.importance,
        createdAt: memories.createdAt,
        lastConfirmedAt: memories.lastConfirmedAt,
      })
      .from(memories)
      .where(whereClause)
      .orderBy(desc(memories.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(memories).where(whereClause),
  ]);

  return { memories: rows, total, limit, offset };
}

// ---------------------------------------------------------------------------
// getOverviewStats() — dashboard Overview page
// ---------------------------------------------------------------------------

export async function getOverviewStats(projectId: string, environmentId: string) {
  const scopeCondition = and(eq(memories.projectId, projectId), eq(memories.environmentId, environmentId));

  const [byStatus, byType, [avgConfidenceRow], [openContradictionsRow], growth, recentActivity] = await Promise.all([
    db
      .select({ status: memories.status, count: count() })
      .from(memories)
      .where(scopeCondition)
      .groupBy(memories.status),
    db
      .select({ type: memories.type, count: count() })
      .from(memories)
      .where(and(scopeCondition, eq(memories.status, "active")))
      .groupBy(memories.type)
      .orderBy(desc(count())),
    db
      .select({ avg: sql<number>`coalesce(avg(${memories.confidence}), 0)` })
      .from(memories)
      .where(and(scopeCondition, eq(memories.status, "active"))),
    db
      .select({ count: count() })
      .from(contradictions)
      .where(and(eq(contradictions.projectId, projectId), eq(contradictions.status, "detected"))),
    db
      .select({
        day: sql<string>`date_trunc('day', ${memories.createdAt})::date`,
        count: count(),
      })
      .from(memories)
      .where(and(scopeCondition, gte(memories.createdAt, sql`now() - interval '30 days'`)))
      .groupBy(sql`date_trunc('day', ${memories.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${memories.createdAt})::date`),
    db
      .select({
        id: memoryEvidence.id,
        eventType: memoryEvidence.eventType,
        excerpt: memoryEvidence.excerpt,
        createdAt: memoryEvidence.createdAt,
        memoryId: memories.id,
        memoryContent: memories.content,
      })
      .from(memoryEvidence)
      .innerJoin(memories, eq(memoryEvidence.memoryId, memories.id))
      .where(scopeCondition)
      .orderBy(desc(memoryEvidence.createdAt))
      .limit(12),
  ]);

  return {
    byStatus,
    byType,
    avgConfidence: Number(avgConfidenceRow?.avg ?? 0),
    openContradictions: openContradictionsRow?.count ?? 0,
    growth,
    recentActivity,
  };
}

export async function forgetUser(scope: Scope) {
  const result = await db
    .update(memories)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(memories.projectId, scope.projectId),
        eq(memories.environmentId, scope.environmentId),
        eq(memories.endUserId, scope.endUserId),
        eq(memories.status, "active")
      )
    )
    .returning({ id: memories.id });
  return result.length;
}
