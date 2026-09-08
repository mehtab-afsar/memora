/**
 * The page's one memorable visual — a UI mockup of what MEMORA surfaces, not
 * a literal API response dump (recall() alone returns a `reason` string, not
 * a list of dated quotes — this card illustrates the product experience the
 * way product-preview.tsx already does on the other marketing pages).
 * Confidence bar is pure CSS, no client JS, disabled under reduced-motion.
 */
export function RecallCard() {
  return (
    <div
      aria-label="Example recall with confidence and sources"
      className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-white text-sm"
      style={{ boxShadow: "0 30px 60px -45px rgba(32,32,40,.35)" }}
    >
      <style>{`
        @keyframes home-confidence-grow { from { width: 0%; } to { width: 96%; } }
        .home-confidence-fill { animation: home-confidence-grow 1s cubic-bezier(.2,.7,.2,1) .4s both; }
        @media (prefers-reduced-motion: reduce) {
          .home-confidence-fill { animation: none; width: 96%; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-[var(--line)] px-[18px] py-[14px] text-[13px] text-[var(--muted)]">
        <code className="font-[family-name:var(--font-home-mono)] text-[var(--ink)]">recall(&quot;answer style&quot;)</code>
        <span>
          user_4f2 · <code className="font-[family-name:var(--font-home-mono)]">memory_8291</code>
        </span>
      </div>

      <div className="px-[18px] py-5">
        <p className="text-lg leading-[1.35] tracking-[-0.01em] text-[var(--ink)]">
          Prefers concise, technical answers over long explanations.
        </p>

        <div className="mt-3.5 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-[13px] text-[var(--muted)]">
          <span>Confidence</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]">
            <div className="home-confidence-fill h-full rounded-full bg-[var(--indigo)]" style={{ width: "96%" }} />
          </div>
          <b className="font-medium text-[var(--ink)]">96%</b>
        </div>

        <div className="mt-[18px] border-t border-[var(--line)] pt-3.5">
          <h4 className="mb-2 text-xs font-medium text-[var(--muted)]">Why MEMORA believes this</h4>
          <ul className="flex flex-col gap-2">
            <li className="grid grid-cols-[1fr_auto] gap-3 text-[var(--ink-2)]">
              <span>&quot;Skip the intro, just give me the diff&quot;</span>
              <span className="text-xs whitespace-nowrap text-[var(--muted)]">3 days ago</span>
            </li>
            <li className="grid grid-cols-[1fr_auto] gap-3 text-[var(--ink-2)]">
              <span>Rated a 4-paragraph reply 👎, a 6-line reply 👍</span>
              <span className="text-xs whitespace-nowrap text-[var(--muted)]">8 days ago</span>
            </li>
            <li className="grid grid-cols-[1fr_auto] gap-3 text-[var(--ink-2)]">
              <span>Asked for &quot;the short version&quot; twice in one session</span>
              <span className="text-xs whitespace-nowrap text-[var(--muted)]">21 days ago</span>
            </li>
          </ul>
        </div>

        <div className="mt-3.5 grid grid-cols-[auto_1fr] gap-2.5 rounded-lg bg-[var(--amber-2)] px-3.5 py-3 text-[13px] leading-[1.45] text-[var(--amber)]">
          <b className="font-semibold">Superseded</b>
          <span className="text-[#6E4A20]">
            &quot;Wants detailed step-by-step walkthroughs&quot; (41 days ago) — contradicted by 3 newer signals. Kept in
            history, not in recall.
          </span>
        </div>
      </div>
    </div>
  );
}
