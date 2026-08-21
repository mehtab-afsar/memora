import { describe, expect, it } from "vitest";
import {
  memoryPatchSchema,
  recallBodySchema,
  recallExperiencesBodySchema,
  recommendBodySchema,
  recordExperienceBodySchema,
  rememberBodySchema,
} from "@/lib/api-schemas";

describe("rememberBodySchema", () => {
  it("accepts the documented minimal body", () => {
    const parsed = rememberBodySchema.parse({ user_id: "user_123", content: "I prefer dark mode." });
    expect(parsed.source).toBeUndefined();
  });

  it("accepts an optional source", () => {
    const parsed = rememberBodySchema.parse({
      user_id: "user_123",
      content: "I prefer dark mode.",
      source: { type: "chat", id: "msg_1" },
    });
    expect(parsed.source).toEqual({ type: "chat", id: "msg_1" });
  });

  it("rejects empty strings and missing fields", () => {
    expect(rememberBodySchema.safeParse({ user_id: "", content: "x" }).success).toBe(false);
    expect(rememberBodySchema.safeParse({ user_id: "u", content: "" }).success).toBe(false);
    expect(rememberBodySchema.safeParse({ content: "x" }).success).toBe(false);
    expect(rememberBodySchema.safeParse(null).success).toBe(false);
  });

  it("accepts optional agent and session scoping", () => {
    const parsed = rememberBodySchema.parse({
      user_id: "u",
      content: "c",
      agent_id: "support-bot",
      session_id: "conv_42",
    });
    expect(parsed.agent_id).toBe("support-bot");
    expect(parsed.session_id).toBe("conv_42");
    expect(rememberBodySchema.safeParse({ user_id: "u", content: "c", agent_id: "" }).success).toBe(false);
  });

  it("rejects a source without a type", () => {
    expect(
      rememberBodySchema.safeParse({ user_id: "u", content: "c", source: { id: "1" } }).success
    ).toBe(false);
  });
});

describe("recallBodySchema", () => {
  it("bounds top_k to 1..50 integers", () => {
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: 1 }).success).toBe(true);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: 50 }).success).toBe(true);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: 0 }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: 51 }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: 2.5 }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", top_k: "5" }).success).toBe(false);
  });

  it("requires a non-empty query", () => {
    expect(recallBodySchema.safeParse({ user_id: "u", query: "" }).success).toBe(false);
  });

  it("accepts type, confidence and time filters", () => {
    const parsed = recallBodySchema.parse({
      user_id: "u",
      query: "q",
      type: ["preference", "instruction"],
      min_confidence: 0.7,
      since: "2026-01-01T00:00:00Z",
    });
    expect(parsed.type).toEqual(["preference", "instruction"]);
    expect(parsed.min_confidence).toBe(0.7);
    expect(parsed.since).toBeInstanceOf(Date);
    expect(parsed.since?.getUTCFullYear()).toBe(2026);
  });

  it("rejects unknown types, out-of-range confidence and unparseable dates", () => {
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", type: ["vibes"] }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", type: [] }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", min_confidence: 1.2 }).success).toBe(false);
    expect(recallBodySchema.safeParse({ user_id: "u", query: "q", since: "last tuesday" }).success).toBe(false);
  });
});

describe("memoryPatchSchema", () => {
  it("clamps confidence and importance to 0..1", () => {
    expect(memoryPatchSchema.safeParse({ confidence: 0 }).success).toBe(true);
    expect(memoryPatchSchema.safeParse({ confidence: 1 }).success).toBe(true);
    expect(memoryPatchSchema.safeParse({ confidence: 1.01 }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ importance: -0.1 }).success).toBe(false);
  });

  it("allows a partial patch but not empty content", () => {
    expect(memoryPatchSchema.safeParse({}).success).toBe(true);
    expect(memoryPatchSchema.safeParse({ content: "" }).success).toBe(false);
  });
});

describe("recordExperienceBodySchema", () => {
  it("requires task, action and a known outcome", () => {
    expect(
      recordExperienceBodySchema.safeParse({ task: "t", action: "a", outcome: "success" }).success
    ).toBe(true);
    expect(
      recordExperienceBodySchema.safeParse({ task: "t", action: "a", outcome: "partial" }).success
    ).toBe(false);
    expect(recordExperienceBodySchema.safeParse({ task: "t", outcome: "failure" }).success).toBe(false);
  });

  it("treats the lesson as optional — the engine generates one when absent", () => {
    const parsed = recordExperienceBodySchema.parse({ task: "t", action: "a", outcome: "failure" });
    expect(parsed.lesson).toBeUndefined();
  });
});

describe("experience query schemas", () => {
  it("requires a query and a task respectively", () => {
    expect(recallExperiencesBodySchema.safeParse({ query: "q" }).success).toBe(true);
    expect(recallExperiencesBodySchema.safeParse({}).success).toBe(false);
    expect(recommendBodySchema.safeParse({ task: "deploy" }).success).toBe(true);
    expect(recommendBodySchema.safeParse({ task: "" }).success).toBe(false);
  });
});
