import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { GITHUB_URL } from "@/features/landing/lib/lp-theme";

const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
];

/** Shared across every page of the marketing site so nav highlighting and links stay in one place, not copy-pasted per page. */
export function MarketingHeader({ active }: { active?: "product" | "how-it-works" }) {
  return (
    <header className="border-b border-[var(--lp-border)]">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[var(--lp-text)]">
          <BrandMark className="size-6" />
          <span className="text-base font-bold tracking-tight">MEMORA</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--lp-text-secondary)] md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === `/${active}`;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? "text-[var(--lp-text)]" : "hover:text-[var(--lp-text)]"}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--lp-text)]">
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-[var(--lp-text-secondary)] hover:text-[var(--lp-text)]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md bg-[var(--lp-text)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
