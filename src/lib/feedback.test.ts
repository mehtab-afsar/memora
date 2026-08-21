import { describe, expect, it } from "vitest";
import { renderExamples, type ExtractionExamples } from "@/lib/feedback";

const example = (content: string, type: string, reason: string) => ({ content, type, reason });

describe("renderExamples", () => {
  it("renders nothing for a project that has learned nothing", () => {
    // Byte-identical to the unlearned prompt matters: it keeps prompt caching
    // working for new projects, and makes a before/after comparison honest.
    expect(renderExamples({ kept: [], discarded: [] })).toBe("");
  });

  it("includes both sides with the evidence for each", () => {
    const examples: ExtractionExamples = {
      kept: [example("Is allergic to peanuts", "fact", "restated by the user 2 more time(s)")],
      discarded: [example("Said the weather was nice", "context", "a person archived this as not worth keeping")],
    };
    const rendered = renderExamples(examples);

    expect(rendered).toContain("Is allergic to peanuts");
    expect(rendered).toContain("restated by the user 2 more time(s)");
    expect(rendered).toContain("Said the weather was nice");
    expect(rendered).toContain("a person archived this");
    expect(rendered).toContain("[fact]");
    expect(rendered).toContain("[context]");
  });

  it("renders one side alone when that is all there is", () => {
    const keptOnly = renderExamples({ kept: [example("Prefers dark mode", "preference", "retrieved 4 time(s) to answer a question")], discarded: [] });
    expect(keptOnly).toContain("Worth keeping");
    expect(keptOnly).not.toContain("Not worth keeping");

    const discardedOnly = renderExamples({ kept: [], discarded: [example("lol", "context", "judged too trivial to persist")] });
    expect(discardedOnly).toContain("Not worth keeping");
    expect(discardedOnly).not.toContain("Worth keeping (");
  });

  it("frames the examples as evidence, not as rules that override the prompt", () => {
    const rendered = renderExamples({ kept: [example("Works at Acme", "fact", "retrieved 1 time(s) to answer a question")], discarded: [] });
    // A tenant's history should steer extraction, never override the safety and
    // quality guidance above it — an application whose users happen to restate
    // trivia must not teach the system that trivia is worth keeping.
    expect(rendered).toContain("where they conflict, the guidance wins");
    expect(rendered).toContain("not rules");
  });

  it("starts with a blank line so it appends cleanly to the system prompt", () => {
    const rendered = renderExamples({ kept: [example("a", "fact", "b")], discarded: [] });
    expect(rendered.startsWith("\n")).toBe(true);
  });
});
