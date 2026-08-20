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
    <div className="overflow-hidden rounded-lg border border-[var(--lp-border)]">
      <div className="grid grid-cols-[1fr_1.4fr_1.4fr] border-b border-[var(--lp-border)] text-sm font-medium">
        <div className="bg-[var(--lp-surface)] px-5 py-3" />
        <div className="bg-[var(--lp-surface)] px-5 py-3 text-[var(--lp-text-tertiary)]">Naive memory APIs</div>
        <div className="bg-[var(--lp-accent-subtle)] px-5 py-3 text-[var(--lp-accent)]">MEMORA</div>
      </div>
      {ROWS.map((row, i) => (
        <div
          key={row.label}
          className={`grid grid-cols-[1fr_1.4fr_1.4fr] text-sm ${
            i < ROWS.length - 1 ? "border-b border-[var(--lp-border)]" : ""
          }`}
        >
          <div className="bg-[var(--lp-bg)] px-5 py-4 font-medium text-[var(--lp-text)]">{row.label}</div>
          <div className="bg-[var(--lp-bg)] px-5 py-4 text-[var(--lp-text-secondary)]">{row.naive}</div>
          <div className="border-l border-[var(--lp-accent)] bg-[var(--lp-accent-subtle)] px-5 py-4 text-[var(--lp-text)]">
            {row.memora}
          </div>
        </div>
      ))}
    </div>
  );
}
