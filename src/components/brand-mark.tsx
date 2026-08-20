/**
 * Inlined (not <img src>) so `currentColor` and the `--brand-accent` custom
 * property actually theme correctly — an externally-referenced SVG can't
 * inherit page CSS. Source: public/brand/memora-recall.svg.
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
      <circle cx="32.0" cy="10.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="51.05" cy="21.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="54.0" cy="32.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="51.05" cy="43.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="43.0" cy="51.05" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="32.0" cy="54.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="21.0" cy="51.05" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="12.95" cy="43.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="10.0" cy="32.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="12.95" cy="21.0" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="21.0" cy="12.95" r="2.1" fill="currentColor" opacity="0.55" />
      <circle cx="32.0" cy="32.0" r="3.4" fill="currentColor" />
      <path d="M35.7 25.59 L39.7 18.66" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="43.0" cy="12.95" r="4.6" fill="var(--brand-accent, #2A78D6)" />
    </svg>
  );
}
