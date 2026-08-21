/**
 * Ranking maths for recall, kept pure and database-free so it can be tested
 * without Postgres, Voyage or Claude. The engines own the queries; this file
 * owns the arithmetic and the wording of the reason strings.
 */

// ---------------------------------------------------------------------------
// Memory recall
// ---------------------------------------------------------------------------

export const MEMORY_RECALL_WEIGHTS = { similarity: 0.6, confidence: 0.25, freshness: 0.15 };

/**
 * Time constant, not a half-life — freshness falls to 1/e (0.37) after this
 * many days, so the actual half-life is ln(2) x this, about 62 days. The name
 * matters: earlier comments called 90 days the half-life, which overstates how
 * long a memory keeps its freshness weight.
 */
export const MEMORY_FRESHNESS_DECAY_DAYS = 90;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Exponential decay: 1.0 at age zero, 1/e at one time constant. */
export function decay(ageMs: number, decayDays: number): number {
  const ageDays = ageMs / MS_PER_DAY;
  return Math.exp(-ageDays / decayDays);
}

/** Days until `decay` reaches one half — the figure worth quoting to users. */
export function halfLifeDays(decayDays: number): number {
  return decayDays * Math.LN2;
}

export type MemoryScoreInput = {
  /** Cosine similarity in [0, 1] — i.e. `1 - distance`. */
  similarity: number;
  confidence: number;
  lastConfirmedAt: Date;
  now?: Date;
  /**
   * Where the row placed in each retrieval pass. When present, the fused rank
   * drives the match term instead of raw cosine similarity, so a row found by
   * exact keyword but missed by the embedding still ranks. Omit for a
   * vector-only search.
   */
  ranks?: RankedLists;
};

export type MemoryScore = {
  similarity: number;
  confidence: number;
  freshness: number;
  relevanceScore: number;
  reason: string;
};

export function scoreMemory(input: MemoryScoreInput): MemoryScore {
  const { similarity, confidence, lastConfirmedAt, ranks } = input;
  const now = input.now ?? new Date();

  const freshness = decay(now.getTime() - lastConfirmedAt.getTime(), MEMORY_FRESHNESS_DECAY_DAYS);
  const match = ranks ? fuseRanks(ranks) : similarity;
  const relevanceScore =
    MEMORY_RECALL_WEIGHTS.similarity * match +
    MEMORY_RECALL_WEIGHTS.confidence * confidence +
    MEMORY_RECALL_WEIGHTS.freshness * freshness;

  return {
    similarity,
    confidence,
    freshness,
    relevanceScore,
    reason: explainScore(similarity, confidence, freshness, ranks),
  };
}

function explainScore(
  similarity: number,
  confidence: number,
  freshness: number,
  ranks?: RankedLists
): string {
  const parts: string[] = [];
  if (ranks && ranks.vectorRank === null) {
    parts.push(`exact keyword match (rank ${ranks.keywordRank})`);
  } else if (similarity > 0.8) parts.push(`high semantic match (${similarity.toFixed(2)})`);
  else if (similarity > 0.5) parts.push(`moderate semantic match (${similarity.toFixed(2)})`);
  else parts.push(`weak semantic match (${similarity.toFixed(2)})`);
  if (ranks && ranks.vectorRank !== null && ranks.keywordRank !== null) {
    parts.push("keyword match too");
  }
  if (confidence > 0.8) parts.push("high confidence");
  if (freshness > 0.8) parts.push("recently confirmed");
  else if (freshness < 0.3) parts.push("not recently confirmed");
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Experience recall
// ---------------------------------------------------------------------------

export const EXPERIENCE_RECALL_WEIGHTS = { similarity: 0.75, recency: 0.25 };
// Twice the memory time constant (half-life ~125 days) — infra and process
// lessons stay valid longer than user preferences typically do.
export const EXPERIENCE_RECENCY_DECAY_DAYS = 180;

export type ExperienceScore = { similarity: number; recency: number; relevanceScore: number };

export function scoreExperience(input: { similarity: number; createdAt: Date; now?: Date }): ExperienceScore {
  const { similarity, createdAt } = input;
  const now = input.now ?? new Date();

  const recency = decay(now.getTime() - createdAt.getTime(), EXPERIENCE_RECENCY_DECAY_DAYS);
  const relevanceScore =
    EXPERIENCE_RECALL_WEIGHTS.similarity * similarity + EXPERIENCE_RECALL_WEIGHTS.recency * recency;

  return { similarity, recency, relevanceScore };
}

// ---------------------------------------------------------------------------
// Rank fusion
// ---------------------------------------------------------------------------

/**
 * Reciprocal rank fusion constant. 60 is the value from the original RRF paper
 * and the usual default: large enough that the top few ranks are close
 * together, small enough that deep results stop contributing.
 */
export const RRF_K = 60;

export type RankedLists = {
  /** 1-based rank in the vector search, or null if the row was not in it. */
  vectorRank: number | null;
  /** 1-based rank in the full-text search, or null if the row was not in it. */
  keywordRank: number | null;
};

/**
 * Fuses two rankings into a score in (0, 1]: a row in both lists always beats
 * one that is only in either, and 1.0 means first place in both. Normalising
 * against the best possible score keeps this on the same scale as the cosine
 * similarity it replaces in the weighted total.
 */
export function fuseRanks({ vectorRank, keywordRank }: RankedLists): number {
  const raw =
    (vectorRank === null ? 0 : 1 / (RRF_K + vectorRank)) +
    (keywordRank === null ? 0 : 1 / (RRF_K + keywordRank));
  const best = 2 / (RRF_K + 1);
  return raw / best;
}

export function matchKind({ vectorRank, keywordRank }: RankedLists): "both" | "meaning" | "keyword" {
  if (vectorRank !== null && keywordRank !== null) return "both";
  return vectorRank !== null ? "meaning" : "keyword";
}

// ---------------------------------------------------------------------------
// Read-time resolution
// ---------------------------------------------------------------------------

/**
 * Above this cosine similarity two memories are treated as restatements of the
 * same fact rather than two facts. Used to collapse the window between an
 * append-only write and its reconciliation, when a fact and its slightly
 * reworded twin can both be active.
 */
export const NEAR_DUPLICATE_SIMILARITY = 0.97;

export type CollapsibleRow = {
  memoryId: string;
  /** Root of the supersedes chain — the id of the oldest version of this fact. */
  chainRootId: string;
  embedding: number[] | null;
  relevanceScore: number;
  createdAt: Date;
};

/**
 * Collapses a ranked result set so each underlying fact appears once:
 * rows sharing a supersedes chain keep their best-scoring member, and rows
 * whose embeddings are near-identical keep the newest.
 *
 * Input must already be sorted by descending relevanceScore.
 */
export function collapseDuplicates<T extends CollapsibleRow>(rows: T[]): T[] {
  const kept: T[] = [];
  const seenChains = new Set<string>();

  for (const row of rows) {
    if (seenChains.has(row.chainRootId)) continue;

    const duplicateIndex = kept.findIndex(
      (k) => k.embedding && row.embedding && cosineSimilarity(k.embedding, row.embedding) >= NEAR_DUPLICATE_SIMILARITY
    );

    if (duplicateIndex !== -1) {
      // Same fact, different row: the newer wording wins, but it inherits the
      // better of the two scores so collapsing never demotes a result.
      const existing = kept[duplicateIndex];
      if (row.createdAt.getTime() > existing.createdAt.getTime()) {
        kept[duplicateIndex] = { ...row, relevanceScore: existing.relevanceScore };
        seenChains.add(row.chainRootId);
      }
      continue;
    }

    seenChains.add(row.chainRootId);
    kept.push(row);
  }

  return kept;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
