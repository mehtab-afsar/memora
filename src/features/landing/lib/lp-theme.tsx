import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";

export const GITHUB_URL = "https://github.com/mehtab-afsar/memora";

// Shared by every marketing-site page (landing, login, signup) — next/font
// requires the loader call to sit in one module-scope const.
export const lpSans = Inter({ subsets: ["latin"], variable: "--font-lp-sans" });
export const lpMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-lp-mono" });

// Fixed light-only palette, deliberately independent of the app's themed
// design tokens (which support dark mode) — the whole marketing site opts
// out of theming entirely, per the original spec. Scoped via inline custom
// properties, not the shared :root/.dark blocks in globals.css.
export const LP_VARS = {
  "--lp-bg": "#FFFFFF",
  "--lp-surface": "#FAFAF9",
  "--lp-border": "#E7E5E1",
  "--lp-text": "#0A0A0A",
  "--lp-text-secondary": "#5B5B57",
  "--lp-text-tertiary": "#8A8A85",
  "--lp-accent": "#1A56DB",
  "--lp-accent-subtle": "#EEF3FC",
  "--brand-accent": "#1A56DB",
} as React.CSSProperties;

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-[var(--lp-accent)] px-6 py-3.5 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
    >
      {children}
    </Link>
  );
}

export function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md border-2 border-[var(--lp-text)] bg-transparent px-6 py-3.5 text-base font-semibold text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-text)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
    >
      {children}
    </Link>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-xs font-bold tracking-[0.15em] text-[var(--lp-accent)] uppercase"
      style={{ fontFamily: "var(--font-lp-mono)" }}
    >
      {children}
    </span>
  );
}
