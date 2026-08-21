import { describe, expect, it } from "vitest";
import {
  collapseDuplicates,
  cosineSimilarity,
  decay,
  EXPERIENCE_RECALL_WEIGHTS,
  fuseRanks,
  matchKind,
  halfLifeDays,
  MEMORY_FRESHNESS_DECAY_DAYS,
  MEMORY_RECALL_WEIGHTS,
  scoreExperience,
  scoreMemory,
} from "@/lib/scoring";

const DAY = 1000 * 60 * 60 * 24;
const NOW = new Date("2026-08-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

describe("decay", () => {
  it("is 1 at age zero and 1/e at one time constant", () => {
    expect(decay(0, 90)).toBe(1);
    expect(decay(90 * DAY, 90)).toBeCloseTo(Math.exp(-1), 10);
  });

  it("reaches one half at ln(2) time constants — ~62 days, not 90", () => {
    expect(decay(halfLifeDays(90) * DAY, 90)).toBeCloseTo(0.5, 10);
    expect(halfLifeDays(90)).toBeCloseTo(62.38, 2);
  });

  it("never reaches zero, so an old memory is demoted but not erased", () => {
    expect(decay(3650 * DAY, 90)).toBeGreaterThan(0);
  });
});

describe("scoreMemory", () => {
  it("weights similarity, confidence and freshness 60/25/15", () => {
    const { relevanceScore } = scoreMemory({
      similarity: 1,
      confidence: 1,
      lastConfirmedAt: NOW,
      now: NOW,
    });
    expect(relevanceScore).toBeCloseTo(1, 10);

    const { relevanceScore: similarityOnly } = scoreMemory({
      similarity: 1,
      confidence: 0,
      lastConfirmedAt: daysAgo(10_000),
      now: NOW,
    });
    expect(similarityOnly).toBeCloseTo(MEMORY_RECALL_WEIGHTS.similarity, 4);
  });

  it("decays freshness on the 90-day time constant", () => {
    const { freshness } = scoreMemory({
      similarity: 0.5,
      confidence: 0.5,
      lastConfirmedAt: daysAgo(MEMORY_FRESHNESS_DECAY_DAYS),
      now: NOW,
    });
    expect(freshness).toBeCloseTo(Math.exp(-1), 10);

    const halved = scoreMemory({
      similarity: 0.5,
      confidence: 0.5,
      lastConfirmedAt: daysAgo(halfLifeDays(MEMORY_FRESHNESS_DECAY_DAYS)),
      now: NOW,
    });
    // 8 places, not 10: daysAgo() rounds through millisecond Date arithmetic.
    expect(halved.freshness).toBeCloseTo(0.5, 8);
  });

  it("ranks a confident stale memory below a confident fresh one at equal similarity", () => {
    const fresh = scoreMemory({ similarity: 0.7, confidence: 0.9, lastConfirmedAt: daysAgo(1), now: NOW });
    const stale = scoreMemory({ similarity: 0.7, confidence: 0.9, lastConfirmedAt: daysAgo(400), now: NOW });
    expect(fresh.relevanceScore).toBeGreaterThan(stale.relevanceScore);
  });

  it("explains itself in the reason string", () => {
    const strong = scoreMemory({ similarity: 0.91, confidence: 0.95, lastConfirmedAt: daysAgo(1), now: NOW });
    expect(strong.reason).toBe("high semantic match (0.91), high confidence, recently confirmed");

    const weak = scoreMemory({ similarity: 0.31, confidence: 0.4, lastConfirmedAt: daysAgo(365), now: NOW });
    expect(weak.reason).toBe("weak semantic match (0.31), not recently confirmed");
  });
});

describe("scoreExperience", () => {
  it("weights similarity and recency 75/25 on a 180-day time constant", () => {
    const { relevanceScore } = scoreExperience({ similarity: 1, createdAt: NOW, now: NOW });
    expect(relevanceScore).toBeCloseTo(1, 10);

    const { recency } = scoreExperience({ similarity: 1, createdAt: daysAgo(180), now: NOW });
    expect(recency).toBeCloseTo(Math.exp(-1), 10);
  });

  it("holds its value longer than memory freshness does", () => {
    const experience = scoreExperience({ similarity: 0.8, createdAt: daysAgo(180), now: NOW });
    const memory = scoreMemory({ similarity: 0.8, confidence: 0, lastConfirmedAt: daysAgo(180), now: NOW });
    expect(experience.recency).toBeGreaterThan(memory.freshness);
    expect(EXPERIENCE_RECALL_WEIGHTS.similarity + EXPERIENCE_RECALL_WEIGHTS.recency).toBe(1);
  });
});

describe("fuseRanks", () => {
  it("is 1 for first place in both passes", () => {
    expect(fuseRanks({ vectorRank: 1, keywordRank: 1 })).toBeCloseTo(1, 10);
  });

  it("ranks a row found by both passes above one found by either alone", () => {
    const both = fuseRanks({ vectorRank: 3, keywordRank: 3 });
    const vectorOnly = fuseRanks({ vectorRank: 1, keywordRank: null });
    const keywordOnly = fuseRanks({ vectorRank: null, keywordRank: 1 });
    expect(both).toBeGreaterThan(vectorOnly);
    expect(both).toBeGreaterThan(keywordOnly);
  });

  it("treats the two passes symmetrically", () => {
    expect(fuseRanks({ vectorRank: 4, keywordRank: null })).toBeCloseTo(
      fuseRanks({ vectorRank: null, keywordRank: 4 }),
      10
    );
  });

  it("decays with rank but stays positive", () => {
    const first = fuseRanks({ vectorRank: 1, keywordRank: null });
    const tenth = fuseRanks({ vectorRank: 10, keywordRank: null });
    expect(first).toBeGreaterThan(tenth);
    expect(tenth).toBeGreaterThan(0);
  });
});

describe("scoreMemory with rank fusion", () => {
  it("lets an exact keyword hit outrank a closer embedding match", () => {
    // The identifier query: the embedding buries the exact row, the keyword
    // index puts it first. Before fusion, the wrong row won.
    const keywordHit = scoreMemory({
      similarity: 0.42,
      confidence: 0.9,
      lastConfirmedAt: NOW,
      now: NOW,
      ranks: { vectorRank: null, keywordRank: 1 },
    });
    const semanticNeighbour = scoreMemory({
      similarity: 0.71,
      confidence: 0.9,
      lastConfirmedAt: NOW,
      now: NOW,
      ranks: { vectorRank: 1, keywordRank: null },
    });
    expect(keywordHit.relevanceScore).toBeCloseTo(semanticNeighbour.relevanceScore, 10);
    expect(keywordHit.reason).toContain("exact keyword match");
  });

  it("says so when both passes agree", () => {
    const score = scoreMemory({
      similarity: 0.88,
      confidence: 0.9,
      lastConfirmedAt: NOW,
      now: NOW,
      ranks: { vectorRank: 1, keywordRank: 2 },
    });
    expect(score.reason).toContain("keyword match too");
  });

  it("falls back to plain cosine similarity when no ranks are supplied", () => {
    const withRanks = scoreMemory({
      similarity: 0.5,
      confidence: 0,
      lastConfirmedAt: NOW,
      now: NOW,
      ranks: { vectorRank: 1, keywordRank: 1 },
    });
    const without = scoreMemory({ similarity: 0.5, confidence: 0, lastConfirmedAt: NOW, now: NOW });
    expect(withRanks.relevanceScore).not.toBeCloseTo(without.relevanceScore, 4);
    expect(without.relevanceScore).toBeCloseTo(0.6 * 0.5 + 0.15, 10);
  });
});

describe("matchKind", () => {
  it("names which pass found the row", () => {
    expect(matchKind({ vectorRank: 1, keywordRank: 2 })).toBe("both");
    expect(matchKind({ vectorRank: 1, keywordRank: null })).toBe("meaning");
    expect(matchKind({ vectorRank: null, keywordRank: 1 })).toBe("keyword");
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("is scale invariant", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it("returns 0 rather than NaN for zero or mismatched vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("collapseDuplicates", () => {
  const row = (
    id: string,
    chainRootId: string,
    embedding: number[] | null,
    relevanceScore: number,
    createdAt: Date
  ) => ({ memoryId: id, chainRootId, embedding, relevanceScore, createdAt });

  it("keeps unrelated memories", () => {
    const rows = [
      row("a", "a", [1, 0], 0.9, daysAgo(1)),
      row("b", "b", [0, 1], 0.8, daysAgo(1)),
    ];
    expect(collapseDuplicates(rows).map((r) => r.memoryId)).toEqual(["a", "b"]);
  });

  it("keeps only the best-scoring member of a supersedes chain", () => {
    const rows = [
      row("v2", "v1", [1, 0], 0.9, daysAgo(1)),
      row("v1", "v1", [0, 1], 0.8, daysAgo(30)),
    ];
    expect(collapseDuplicates(rows).map((r) => r.memoryId)).toEqual(["v2"]);
  });

  it("collapses a near-duplicate written before reconciliation, preferring the newer wording", () => {
    // Two independent rows (no chain yet — reconciliation has not run) whose
    // embeddings are effectively the same fact.
    const older = row("old", "old", [1, 0, 0], 0.9, daysAgo(30));
    const newer = row("new", "new", [0.999, 0.01, 0], 0.85, daysAgo(1));

    const collapsed = collapseDuplicates([older, newer]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].memoryId).toBe("new");
    // The kept row inherits the better score so collapsing never demotes a hit.
    expect(collapsed[0].relevanceScore).toBe(0.9);
  });

  it("does not collapse merely similar memories below the duplicate threshold", () => {
    const a = row("a", "a", [1, 0, 0], 0.9, daysAgo(1));
    const b = row("b", "b", [0.8, 0.6, 0], 0.8, daysAgo(1)); // cosine 0.8
    expect(collapseDuplicates([a, b])).toHaveLength(2);
  });

  it("passes rows through untouched when embeddings are missing", () => {
    const rows = [row("a", "a", null, 0.9, daysAgo(1)), row("b", "b", null, 0.8, daysAgo(1))];
    expect(collapseDuplicates(rows)).toHaveLength(2);
  });
});
