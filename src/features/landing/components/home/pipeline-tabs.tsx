"use client";

import { useRef, useState } from "react";

type Step = {
  id: "remember" | "decide" | "store" | "recall";
  n: string;
  name: string;
  oneLiner: string;
  prose: string[];
  code: React.ReactNode;
};

// Code samples use the real @memora/client surface (packages/sdk/src/index.ts)
// — there is no public decide() or store() method, both happen server-side
// inside remember(). The "Decide" and "Store" panels show the real fields
// that carry those steps' results (RememberOutcome, explain()) rather than
// inventing calls that don't exist.
const STEPS: Step[] = [
  {
    id: "remember",
    n: "1",
    name: "Remember",
    oneLiner: "Extract candidate facts",
    prose: [
      "Pass in the turn. MEMORA extracts candidate facts about the user, the task and the world, each tagged with what kind of thing it is.",
      "Nothing is written until it's judged. Candidates are cheap; storage is not.",
    ],
    code: (
      <>
        <span className="text-[var(--indigo)]">const</span> {"{ outcomes }"} = <span className="text-[var(--indigo)]">await</span> memora.remember({"{"}
        {"\n  "}userId: <span className="text-[#1F5F3F]">&quot;user_4f2&quot;</span>,
        {"\n  "}content: <span className="text-[#1F5F3F]">&quot;Skip the intro, just give me the diff&quot;</span>,
        {"\n"}
        {"}"});{"\n"}
        <span className="text-[var(--muted)]">{"// candidates are extracted and judged before this resolves"}</span>
      </>
    ),
  },
  {
    id: "decide",
    n: "2",
    name: "Decide",
    oneLiner: "Score, dedupe, check conflicts",
    prose: [
      "Each candidate is scored for salience and checked against what's already known. Duplicates merge. Contradictions are flagged with both sides and a proposed resolution.",
      "You can accept the decision or override it with update() — the override is itself remembered.",
    ],
    code: (
      <>
        <span className="text-[var(--muted)]">{"// the outcomes array above already carries the decision"}</span>
        {"\n"}outcomes[0];{"\n"}
        <span className="text-[var(--muted)]">{"// → {"}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   candidateContent: \"Prefers concise answers\","}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   decision: \"UPDATE\","}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   memoryId: \"memory_8291\","}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   reasoning: \"3 newer signals disagree with the prior walkthrough preference\""}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"// }"}</span>
      </>
    ),
  },
  {
    id: "store",
    n: "3",
    name: "Store",
    oneLiner: "Write with provenance",
    prose: [
      "Only accepted decisions are written. Every memory carries its sources, timestamps and the decision that created it, so nothing is ever a bare string in a table.",
      "Superseded memories stay in history. They're just not recalled.",
    ],
    code: (
      <>
        <span className="text-[var(--indigo)]">const</span> provenance = <span className="text-[var(--indigo)]">await</span> memora.explain(outcomes[0].memoryId);{"\n"}
        <span className="text-[var(--muted)]">{"// → memory_8291's full evidence trail:"}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   sources, timestamps, the decision that wrote it"}</span>
      </>
    ),
  },
  {
    id: "recall",
    n: "4",
    name: "Recall",
    oneLiner: "Return facts with evidence",
    prose: [
      "Ask a question, get facts back with confidence and a reason attached. Put the reason in your prompt, log it, or show it to the user.",
      "Low-confidence memories come back marked, not silently, so your agent can hedge instead of guess.",
    ],
    code: (
      <>
        <span className="text-[var(--indigo)]">const</span> {"{ results }"} = <span className="text-[var(--indigo)]">await</span> memora.recall({"{"}
        {"\n  "}userId: <span className="text-[#1F5F3F]">&quot;user_4f2&quot;</span>,
        {"\n  "}query: <span className="text-[#1F5F3F]">&quot;how should I format this answer?&quot;</span>,
        {"\n"}
        {"}"});{"\n"}
        <span className="text-[var(--muted)]">{"// results[0] → {"}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   content: \"Prefers concise, technical answers\","}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   confidence: 0.96,"}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   reason: \"...\","}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"//   history: [ { content, supersededAt } ]"}</span>
        {"\n"}
        <span className="text-[var(--muted)]">{"// }"}</span>
      </>
    ),
  },
];

export function PipelineTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const next = (index + STEPS.length) % STEPS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(active - 1);
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Pipeline steps" className="mt-12 grid grid-cols-2 border-t border-[var(--line)] md:grid-cols-4">
        {STEPS.map((step, i) => (
          <button
            key={step.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${step.id}`}
            aria-selected={active === i}
            aria-controls={`panel-${step.id}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
            className={`-mt-px border-t-2 px-0 py-[18px] pr-5 text-left ${
              active === i ? "border-[var(--ink)] text-[var(--ink)]" : "border-transparent text-[var(--ink-2)]"
            }`}
          >
            <span className="mb-1 block font-[family-name:var(--font-home-mono)] text-[13px] tabular-nums text-[var(--muted)]">
              {step.n}
            </span>
            <b className="block text-[17px] font-medium">{step.name}</b>
            <span className="mt-1 block text-sm text-[var(--muted)]">{step.oneLiner}</span>
          </button>
        ))}
      </div>

      {STEPS.map((step, i) =>
        active === i ? (
          <div
            key={step.id}
            id={`panel-${step.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${step.id}`}
            className="mt-8 grid grid-cols-1 items-start gap-6 md:grid-cols-[0.8fr_1.2fr] md:gap-12"
          >
            <div className="flex flex-col gap-3 text-[var(--ink-2)]">
              {step.prose.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
            <pre className="overflow-x-auto rounded-[10px] border border-[var(--line)] bg-white p-5 text-[13.5px] leading-[1.6] whitespace-pre text-[var(--ink)] font-[family-name:var(--font-home-mono)]">
              <code>{step.code}</code>
            </pre>
          </div>
        ) : null
      )}
    </>
  );
}
