import { X, Check } from "lucide-react";

const ROWS = [
  {
    label: "What gets stored",
    naive: "Everything, indiscriminately",
    memora: "Filtered at write time — only what's actually worth keeping",
  },
  {
    label: "Updates",
    naive: "Silently overwritten",
    memora: "Versioned — full history, nothing lost, every change has a stated reason",
  },
  {
    label: "Conflicts",
    naive: "Picked arbitrarily, or just duplicated",
    memora: "Flagged for review — never silently guessed",
  },
  {
    label: "Retrieval",
    naive: "“Trust the vector search”",
    memora: "Every result carries similarity, confidence, freshness, and a plain-English reason",
  },
];

export function Differentiation() {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--lp-text)]">
      <div className="grid grid-cols-[1fr_1.4fr_1.4fr] border-b-2 border-[var(--lp-text)] text-sm font-bold">
        <div className="bg-[var(--lp-surface)] px-5 py-4" />
        <div className="bg-[var(--lp-surface)] px-5 py-4 text-[var(--lp-text-tertiary)]">Naive memory APIs</div>
        <div className="bg-[var(--lp-text)] px-5 py-4 text-white">MEMORA</div>
      </div>
      {ROWS.map((row, i) => (
        <div
          key={row.label}
          className={`grid grid-cols-[1fr_1.4fr_1.4fr] text-sm ${
            i < ROWS.length - 1 ? "border-b border-[var(--lp-border)]" : ""
          }`}
        >
          <div className="bg-[var(--lp-bg)] px-5 py-5 font-bold text-[var(--lp-text)]">{row.label}</div>
          <div className="flex items-start gap-2 bg-[var(--lp-bg)] px-5 py-5 text-[var(--lp-text-tertiary)]">
            <X className="mt-0.5 size-4 shrink-0 text-[var(--lp-text-tertiary)]" />
            <span>{row.naive}</span>
          </div>
          <div className="flex items-start gap-2 border-l-2 border-[var(--lp-accent)] bg-[var(--lp-accent-subtle)] px-5 py-5 font-medium text-[var(--lp-text)]">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--lp-accent)]" />
            <span>{row.memora}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
