/**
 * The page's one signature visual — a real UI card, not stock art. Pure CSS
 * animation (no client JS) for the confidence bar, disabled under
 * prefers-reduced-motion. Rotated slightly and given a heavier shadow so it
 * reads as a floating object with real weight, not a flat inline panel.
 */
export function ProductPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-2xl bg-[var(--lp-accent-subtle)]"
        style={{ transform: "rotate(-2deg)" }}
      />
      <div
        className="w-full rounded-xl border-2 border-[var(--lp-text)] bg-[var(--lp-bg)] p-6"
        style={{ boxShadow: "8px 8px 0 0 var(--lp-text)" }}
      >
        <style>{`
          @keyframes memora-confidence-grow {
            from { width: 0%; }
            to { width: 96%; }
          }
          .memora-confidence-fill {
            animation: memora-confidence-grow 900ms ease-out 200ms both;
          }
          @media (prefers-reduced-motion: reduce) {
            .memora-confidence-fill {
              animation: none;
              width: 96%;
            }
          }
        `}</style>

        <div className="flex items-center justify-between">
          <span
            className="text-xs text-[var(--lp-text-tertiary)]"
            style={{ fontFamily: "var(--font-lp-mono)" }}
          >
            memory_8291
          </span>
          <span className="rounded-full bg-[var(--lp-accent-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--lp-accent)]">
            Active
          </span>
        </div>

        <p className="mt-4 text-lg leading-relaxed font-medium text-[var(--lp-text)]">
          Prefers concise, technical answers over long explanations
        </p>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-xs text-[var(--lp-text-tertiary)]">Confidence</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--lp-surface)]">
            <div className="memora-confidence-fill h-full rounded-full bg-[var(--lp-accent)]" style={{ width: "96%" }} />
          </div>
          <span
            className="text-xs font-bold tabular-nums text-[var(--lp-text-tertiary)]"
            style={{ fontFamily: "var(--font-lp-mono)" }}
          >
            96%
          </span>
        </div>

        <details className="mt-5 border-t border-[var(--lp-border)] pt-4">
          <summary className="cursor-pointer text-sm font-bold text-[var(--lp-text)] select-none">
            Why this exists
          </summary>
          <p className="mt-2 text-sm text-[var(--lp-text-secondary)]">
            Explicit user statement, confirmed 3 times, never contradicted. Last confirmed 2 days ago.
          </p>
        </details>
      </div>
    </div>
  );
}
