import { and, count, desc, eq } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql";
import { db } from "@/db";
import { experiences } from "@/db/schema";
import { generateLesson, synthesizeRecommendation, type ExperienceForRecommendation } from "@/lib/anthropic";
import { embedDocument, embedQuery } from "@/lib/voyage";

type ProjectScope = { projectId: string; environmentId: string };

// ---------------------------------------------------------------------------
// recordExperience()
// ---------------------------------------------------------------------------

export type RecordExperienceInput = {
  task: string;
  action: string;
  context?: string;
  outcome: "success" | "failure";
  cause?: string;
  resolution?: string;
  lesson?: string;
  sourceType: string;
  sourceId?: string;
};

export async function recordExperience(scope: ProjectScope, input: RecordExperienceInput) {
  const lesson =
    input.lesson ??
    (await generateLesson({
      task: input.task,
      action: input.action,
      outcome: input.outcome,
      cause: input.cause,
      resolution: input.resolution,
    }));

  const embeddingText = [input.task, input.action, input.outcome, lesson].join(". ");
  const embedding = await embedDocument(embeddingText);

  const [row] = await db
    .insert(experiences)
    .values({
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      task: input.task,
      action: input.action,
      context: input.context,
      outcome: input.outcome,
      cause: input.cause,
      resolution: input.resolution,
      lesson,
      embedding,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })
    .returning();

  return row;
}

// ---------------------------------------------------------------------------
// recallExperiences()
// ---------------------------------------------------------------------------

export type ExperienceRecallResult = {
  experienceId: string;
  task: string;
  action: string;
  outcome: "success" | "failure";
  cause: string | null;
  resolution: string | null;
  lesson: string;
  similarity: number;
  relevanceScore: number;
  createdAt: Date;
};

const RECALL_WEIGHTS = { similarity: 0.75, recency: 0.25 };
// Longer half-life than memory freshness (90d, src/lib/memory-engine.ts) — infra/process
// lessons stay valid longer than user preferences typically do.
const RECENCY_HALF_LIFE_DAYS = 180;

function scoreAndRank<T extends { distance: unknown; createdAt: Date }>(
  rows: T[]
): (T & { similarity: number; relevanceScore: number })[] {
  const now = Date.now();
  const scored = rows.map((row) => {
    const similarity = 1 - Number(row.distance);
    const ageDays = (now - row.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
    const relevanceScore = RECALL_WEIGHTS.similarity * similarity + RECALL_WEIGHTS.recency * recency;
    return { ...row, similarity, relevanceScore };
  });
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function searchExperiences(scope: ProjectScope, query: string, limit: number) {
  const queryEmbedding = await embedQuery(query);
  const distanceExpr = cosineDistance(experiences.embedding, queryEmbedding);

  const rows = await db
    .select({
      id: experiences.id,
      task: experiences.task,
      action: experiences.action,
      outcome: experiences.outcome,
      cause: experiences.cause,
      resolution: experiences.resolution,
      lesson: experiences.lesson,
      createdAt: experiences.createdAt,
      distance: distanceExpr,
    })
    .from(experiences)
    .where(and(eq(experiences.projectId, scope.projectId), eq(experiences.environmentId, scope.environmentId)))
    .orderBy(distanceExpr)
    // Over-fetch since the final order is by relevanceScore (similarity + recency), not raw distance.
    .limit(limit * 3);

  return scoreAndRank(rows);
}

export async function recallExperiences(
  scope: ProjectScope,
  query: string,
  topK = 10
): Promise<ExperienceRecallResult[]> {
  const ranked = await searchExperiences(scope, query, topK);

  return ranked.slice(0, topK).map((row) => ({
    experienceId: row.id,
    task: row.task,
    action: row.action,
    outcome: row.outcome,
    cause: row.cause,
    resolution: row.resolution,
    lesson: row.lesson,
    similarity: row.similarity,
    relevanceScore: row.relevanceScore,
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// recommendForTask() — synthesize an actionable recommendation from the most
// relevant past experiences. Returns no recommendation when there's nothing
// relevant enough to ground one in — never a guess dressed up as advice.
// ---------------------------------------------------------------------------

const RECOMMENDATION_SIMILARITY_FLOOR = 0.3;
const RECOMMENDATION_CANDIDATE_LIMIT = 5;

export type RecommendationResult = {
  recommendation: string;
  confidence: number;
  reasoning: string;
  supportingExperiences: ExperienceRecallResult[];
} | null;

export async function recommendForTask(scope: ProjectScope, task: string): Promise<RecommendationResult> {
  const ranked = await searchExperiences(scope, task, RECOMMENDATION_CANDIDATE_LIMIT);
  const candidates = ranked.filter((r) => r.similarity >= RECOMMENDATION_SIMILARITY_FLOOR);

  if (candidates.length === 0) return null;

  const forRecommendation: ExperienceForRecommendation[] = candidates.map((c) => ({
    id: c.id,
    task: c.task,
    action: c.action,
    outcome: c.outcome,
    cause: c.cause,
    resolution: c.resolution,
    lesson: c.lesson,
  }));

  const result = await synthesizeRecommendation(task, forRecommendation);

  const supportingExperiences = candidates
    .filter((c) => result.supporting_experience_ids.includes(c.id))
    .map((c) => ({
      experienceId: c.id,
      task: c.task,
      action: c.action,
      outcome: c.outcome,
      cause: c.cause,
      resolution: c.resolution,
      lesson: c.lesson,
      similarity: c.similarity,
      relevanceScore: c.relevanceScore,
      createdAt: c.createdAt,
    }));

  return {
    recommendation: result.recommendation,
    confidence: result.confidence,
    reasoning: result.reasoning,
    supportingExperiences,
  };
}

// ---------------------------------------------------------------------------
// listExperiences()
// ---------------------------------------------------------------------------

export type ExperienceFilters = { limit?: number; offset?: number };

export async function listExperiences(scope: ProjectScope, filters: ExperienceFilters = {}) {
  const { limit = 50, offset = 0 } = filters;
  const whereClause = and(eq(experiences.projectId, scope.projectId), eq(experiences.environmentId, scope.environmentId));

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(experiences)
      .where(whereClause)
      .orderBy(desc(experiences.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(experiences).where(whereClause),
  ]);

  return { experiences: rows, total, limit, offset };
}
