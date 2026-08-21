import { describe, expect, it } from "vitest";
import { needsConsolidation } from "@/lib/consolidate";

const NOW = new Date("2026-08-21T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("needsConsolidation", () => {
  it("does nothing for a user with only a handful of memories", () => {
    // Below the threshold the memories already are the profile; summarising
    // seven facts into a paragraph costs a model call and adds nothing.
    expect(needsConsolidation({ currentMemoryCount: 7, existing: null, now: NOW })).toBe(false);
    expect(needsConsolidation({ currentMemoryCount: 0, existing: null, now: NOW })).toBe(false);
  });

  it("builds the first profile once there is enough to summarise", () => {
    expect(needsConsolidation({ currentMemoryCount: 8, existing: null, now: NOW })).toBe(true);
    expect(needsConsolidation({ currentMemoryCount: 200, existing: null, now: NOW })).toBe(true);
  });

  it("rebuilds once enough has changed", () => {
    const existing = { memoryCount: 40, generatedAt: daysAgo(1) };
    expect(needsConsolidation({ currentMemoryCount: 49, existing, now: NOW })).toBe(false);
    expect(needsConsolidation({ currentMemoryCount: 50, existing, now: NOW })).toBe(true);
  });

  it("rebuilds when memories were removed, not just added", () => {
    // Ten archived memories change the picture as much as ten new ones.
    const existing = { memoryCount: 40, generatedAt: daysAgo(1) };
    expect(needsConsolidation({ currentMemoryCount: 30, existing, now: NOW })).toBe(true);
  });

  it("does not rebuild an old profile that has not changed", () => {
    // Age alone is not a reason: regenerating an unchanged profile costs a
    // model call and produces the same paragraph.
    const untouched = { memoryCount: 40, generatedAt: daysAgo(365) };
    expect(needsConsolidation({ currentMemoryCount: 40, existing: untouched, now: NOW })).toBe(false);
  });

  it("does rebuild an old profile that has drifted a little", () => {
    // A slow-moving user never trips the drift threshold, so their profile
    // would otherwise never reflect the last year of small changes.
    const stale = { memoryCount: 40, generatedAt: daysAgo(31) };
    expect(needsConsolidation({ currentMemoryCount: 43, existing: stale, now: NOW })).toBe(true);

    const notYetStale = { memoryCount: 40, generatedAt: daysAgo(29) };
    expect(needsConsolidation({ currentMemoryCount: 43, existing: notYetStale, now: NOW })).toBe(false);
  });

  it("never rebuilds for a user who has dropped below the minimum", () => {
    // Someone whose memories were mostly archived should not get a fresh
    // profile built from the two that remain.
    const existing = { memoryCount: 40, generatedAt: daysAgo(60) };
    expect(needsConsolidation({ currentMemoryCount: 3, existing, now: NOW })).toBe(false);
  });
});
