/**
 * Inlined (not <img src>) so `currentColor` and the `--brand-accent` custom
 * property actually theme correctly — an externally-referenced SVG can't
 * inherit page CSS. Source: public/brand/memora-monogram.svg — picked over
 * the other five sketches because it's the only one that stays legible at
 * the sizes this mark actually ships at (20px sidebar/topbar, 16px tight
 * contexts): 2 shapes, no opacity fades to lose at small size, no theme
 * variable dependency beyond the accent dot every mark already uses.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width="64"
      height="64"
      fill="none"
      role="img"
      aria-label="MEMORA"
      className={className}
    >
      <path
        d="M14 47 V23 L32 39 L50 23 V47"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="39" r="5.6" fill="var(--brand-accent, #2A78D6)" />
    </svg>
  );
}
