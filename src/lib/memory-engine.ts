import { and, count, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql";
import { db } from "@/db";
import {
  memories,
  memoryEvidence,
  contradictions,
  reconciliationJobs,
  memoryTypeEnum,
  memoryStatusEnum,
} from "@/db/schema";
import { extractMemories, verifyMemory } from "@/lib/anthropic";
import { embedDocument, embedDocuments, embedQuery } from "@/lib/voyage";
import { collapseDuplicates, matchKind, scoreMemory } from "@/lib/scoring";
import type { MemoryMetadata } from "@/lib/memory-types";
import { extractionExamples, recordRecallHits, renderExamples } from "@/lib/feedback";

type Scope = { projectId: string; environmentId: string; endUserId: string };
type WriteScope = Scope & { agentId?: string; sessionId?: string };
type ProjectScope = { projectId: string; environmentId: string };

// ---------------------------------------------------------------------------
// remember()
// ---------------------------------------------------------------------------

export type RememberOutcome = {
  candidateContent: string;
  decision: "ADD" | "UPDATE" | "MERGE" | "IGNORE" | "FLAG";
  memoryId: string | null;
  reasoning: string;
  /**
   * Every write starts as an ADD and is judged afterwards. "pending" means the
   * reconciliation job for this memory has not run yet, so its final decision
   * (and any version link or contradiction flag) is still to come.
   */
  reconciliation?: "pending" | "done";
};

export async function remember(
  scope: WriteScope & { content: string; sourceType: string; sourceId?: string }
): Promise<{ outcomes: RememberOutcome[] }> {
  const { projectId, environmentId, endUserId, agentId, sessionId, content, sourceType, sourceId } = scope;

  // Append-only write path. One extraction call, one batched embedding call,
  // then every candidate is inserted and queued. Whether a candidate is really
  // a new fact, a new version of an old one, a restatement or a contradiction
  // is decided afterwards by src/lib/reconcile.ts — see PLAN.md phase 1 for why
  // that judgement no longer sits between the caller and their response.
  // What this project has learned about its own users is part of how it reads
  // the next message. One indexed query, alongside a model call that costs
  // three orders of magnitude more.
  const learned = renderExamples(await extractionExamples(projectId));
  const candidates = await extractMemories(content, learned);
  if (candidates.length === 0) return { outcomes: [] };

  const embeddings = await embedDocuments(candidates.map((candidate) => candidate.content));

  const inserted = await db
    .insert(memories)
    .values(
      candidates.map((candidate, i) => ({
        projectId,
        environmentId,
        endUserId,
        agentId,
        sessionId,
        content: candidate.content,
        type: candidate.type as (typeof memories.$inferInsert)["type"],
        confidence: candidate.confidence,
        importance: candidate.importance,
        sourceType,
        sourceId,
        embedding: embeddings[i],
        // Carried so reconciliation can put the same candidate to Claude that
        // the old inline decision saw.
        metadata: { extractionRationale: candidate.rationale },
      }))
    )
    .returning({ id: memories.id, content: memories.content });

  await db.insert(memoryEvidence).values(
    inserted.map((row) => ({
      memoryId: row.id,
      sourceType,
      sourceId,
      excerpt: row.content,
      eventType: "extracted" as const,
    }))
  );

  await db.insert(reconciliationJobs).values(
    inserted.map((row) => ({
      memoryId: row.id,
      projectId,
      environmentId,
      endUserId,
    }))
  );

  return {
    outcomes: inserted.map((row) => ({
      candidateContent: row.content,
      decision: "ADD" as const,
      memoryId: row.id,
      reasoning: "Written as a new memory; reconciliation against existing memories is queued.",
      reconciliation: "pending" as const,
    })),
  };
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

// Weights, decay and reason wording live in src/lib/scoring.ts so they can be
// tested without a database.

export type RecallResult = {
  memoryId: string;
  content: string;
  type: string;
  similarity: number;
  confidence: number;
  freshness: number;
  relevanceScore: number;
  /** `flagged` means this memory contradicts another one and neither is settled. */
  status: (typeof memoryStatusEnum.enumValues)[number];
  /**
   * Earlier versions of this same fact, newest first. Present so a caller can
   * answer a question about the past ("did they ever work at X?") without the
   * superseded rows competing for a slot in the ranking.
   */
  history: { content: string; supersededAt: Date }[];
  /** Which retrieval pass found this memory: semantic, keyword, or both. */
  matchedOn: "both" | "meaning" | "keyword";
  reason: string;
};

export type RecallFilters = {
  types?: (typeof memoryTypeEnum.enumValues)[number][];
  minConfidence?: number;
  since?: Date;
  until?: Date;
  agentId?: string;
  sessionId?: string;
};

export async function recall(
  scope: Scope & { query: string; topK?: number } & RecallFilters
): Promise<RecallResult[]> {
  const {
    projectId, environmentId, endUserId, query, topK = 10,
    types, minConfidence, since, until, agentId, sessionId,
  } = scope;

  const conditions = [
    eq(memories.projectId, projectId),
    eq(memories.environmentId, environmentId),
    eq(memories.endUserId, endUserId),
    // Flagged memories are returned, not hidden. Filtering to `active` alone
    // meant that detecting a contradiction silently removed both sides from
    // every answer — the opposite of surfacing it. They come back labelled so
    // the caller can show the conflict instead of guessing past it.
    inArray(memories.status, ["active", "flagged"]),
  ];
  if (types?.length) conditions.push(inArray(memories.type, types));
  if (minConfidence !== undefined) conditions.push(gte(memories.confidence, minConfidence));
  if (since) conditions.push(gte(memories.createdAt, since));
  if (until) conditions.push(lte(memories.createdAt, until));
  if (agentId) conditions.push(eq(memories.agentId, agentId));
  if (sessionId) conditions.push(eq(memories.sessionId, sessionId));

  const scopeFilter = and(...conditions);

  // Over-fetch from both passes: the final order is by relevance, not by either
  // raw ranking, and collapsing duplicates removes rows.
  const candidateLimit = topK * 3;

  const queryEmbedding = await embedQuery(query);
  const distanceExpr = cosineDistance(memories.embedding, queryEmbedding);

  const columns = {
    id: memories.id,
    content: memories.content,
    type: memories.type,
    confidence: memories.confidence,
    status: memories.status,
    lastConfirmedAt: memories.lastConfirmedAt,
    createdAt: memories.createdAt,
    supersedesId: memories.supersedesId,
    embedding: memories.embedding,
    distance: distanceExpr,
  };

  // Two passes, fused below. Embeddings find meaning; the full-text index finds
  // the exact strings — names, ids, channel handles — that embeddings blur.
  const [vectorRows, keywordRows] = await Promise.all([
    db.select(columns).from(memories).where(scopeFilter).orderBy(distanceExpr).limit(candidateLimit),
    db
      .select(columns)
      .from(memories)
      .where(and(scopeFilter, sql`${memories.contentTsv} @@ websearch_to_tsquery('english', ${query})`))
      .orderBy(desc(sql`ts_rank(${memories.contentTsv}, websearch_to_tsquery('english', ${query}))`))
      .limit(candidateLimit),
  ]);

  const vectorRank = new Map(vectorRows.map((row, i) => [row.id, i + 1]));
  const keywordRank = new Map(keywordRows.map((row, i) => [row.id, i + 1]));

  const merged = new Map<string, (typeof vectorRows)[number]>();
  for (const row of [...vectorRows, ...keywordRows]) merged.set(row.id, row);

  const now = new Date();
  const scored = [...merged.values()].map((row) => {
    const ranks = {
      vectorRank: vectorRank.get(row.id) ?? null,
      keywordRank: keywordRank.get(row.id) ?? null,
    };
    const score = scoreMemory({
      // A keyword-only hit still carries a real cosine distance — it was just
      // outside the vector top-N — so the similarity we report stays honest.
      similarity: 1 - Number(row.distance),
      confidence: row.confidence,
      lastConfirmedAt: row.lastConfirmedAt,
      now,
      ranks,
    });

    return {
      memoryId: row.id,
      content: row.content,
      type: row.type,
      status: row.status,
      chainRootId: row.supersedesId ?? row.id,
      embedding: row.embedding,
      createdAt: row.createdAt,
      matchedOn: matchKind(ranks),
      ...score,
      reason:
        row.status === "flagged"
          ? `${score.reason} — flagged: contradicts another memory, unresolved`
          : score.reason,
    };
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Between an append-only write and its reconciliation a fact and its
  // reworded twin can both be active, so results are collapsed before slicing.
  const top = collapseDuplicates(scored).slice(0, topK);
  const history = await priorVersions(top.filter((row) => row.chainRootId !== row.memoryId).map((row) => row.memoryId));

  // Which memories actually got used is the usefulness signal the feedback loop
  // reads back (src/lib/feedback.ts). Fire-and-forget: a read must never fail
  // because a counter did.
  void recordRecallHits(top.map((row) => row.memoryId)).catch(() => undefined);

  return top
    .map((row) => ({
      memoryId: row.memoryId,
      content: row.content,
      type: row.type,
      status: row.status,
      similarity: row.similarity,
      confidence: row.confidence,
      freshness: row.freshness,
      relevanceScore: row.relevanceScore,
      matchedOn: row.matchedOn,
      history: history.get(row.memoryId) ?? [],
      reason: row.reason,
    }));
}

/** How far back a result reports its own history. Chains are short in practice. */
const HISTORY_DEPTH = 5;

/**
 * Walks the supersedes chain backwards for the given memories in one query.
 * Superseded rows are deliberately kept out of the ranking — an old job title
 * should not compete with the current one for a slot — but they are the answer
 * to any question about what used to be true, so they travel with their
 * successor instead of being dropped.
 */
async function priorVersions(memoryIds: string[]): Promise<Map<string, { content: string; supersededAt: Date }[]>> {
  const byMemory = new Map<string, { content: string; supersededAt: Date }[]>();
  if (memoryIds.length === 0) return byMemory;

  const rows = await db.execute<{ head_id: string; content: string; updated_at: Date; depth: number }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id AS head_id, id, supersedes_id, content, updated_at, 1 AS depth
        FROM memories
       WHERE id IN (${sql.join(memoryIds.map((id) => sql`${id}::uuid`), sql`, `)})
      UNION ALL
      SELECT c.head_id, m.id, m.supersedes_id, m.content, m.updated_at, c.depth + 1
        FROM memories m
        JOIN chain c ON m.id = c.supersedes_id
       WHERE c.depth < ${HISTORY_DEPTH}
    )
    SELECT head_id, content, updated_at, depth FROM chain WHERE depth > 1 ORDER BY head_id, depth
  `);

  for (const row of rows.rows) {
    const list = byMemory.get(row.head_id) ?? [];
    list.push({ content: row.content, supersededAt: new Date(row.updated_at) });
    byMemory.set(row.head_id, list);
  }
  return byMemory;
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

  // Writes are append-only, so a memory can be returned by recall() before it
  // has been judged against its neighbours. Say so explicitly rather than
  // presenting an unreconciled row as a settled one.
  const [job] = await db
    .select({ status: reconciliationJobs.status, attempts: reconciliationJobs.attempts, lastError: reconciliationJobs.lastError })
    .from(reconciliationJobs)
    .where(eq(reconciliationJobs.memoryId, memoryId))
    .limit(1);

  return {
    memory,
    reconciliation: {
      reconciledAt: memory.reconciledAt,
      status: memory.reconciledAt ? "done" : job?.status ?? "unqueued",
      attempts: job?.attempts ?? 0,
      lastError: job?.lastError ?? null,
    },
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
    // Ordered so a chain is stable if more than one row ever points here.
    const [next] = await db
      .select()
      .from(memories)
      .where(eq(memories.supersedesId, current.id))
      .orderBy(memories.createdAt)
      .limit(1);
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
  const [existing] = await db.select({ metadata: memories.metadata }).from(memories).where(eq(memories.id, memoryId)).limit(1);

  const [updated] = await db
    .update(memories)
    // Recorded as a human decision rather than a bare archive: someone looking
    // at this memory decided it should not have been kept, which is the
    // strongest negative example extraction ever receives.
    .set({
      status: "archived",
      metadata: { ...((existing?.metadata ?? {}) as MemoryMetadata), discarded: "human" },
      updatedAt: new Date(),
    })
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
        reconciledAt: memories.reconciledAt,
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
