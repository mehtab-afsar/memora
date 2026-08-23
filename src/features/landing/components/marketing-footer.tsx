import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { GITHUB_URL } from "@/features/landing/lib/lp-theme";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "Product", external: false },
      { href: "/how-it-works", label: "How it works", external: false },
    ],
  },
  {
    title: "Resources",
    links: [{ href: GITHUB_URL, label: "GitHub", external: true }],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service", external: false },
      { href: "/legal/privacy", label: "Privacy Policy", external: false },
      { href: "/legal/sub-processors", label: "Sub-processors", external: false },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--lp-border)] px-6 py-16">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <span className="inline-flex items-center gap-1.5 text-[var(--lp-text)]">
              <BrandMark className="size-4" />
              <span className="text-sm font-bold">MEMORA</span>
            </span>
            <p className="mt-2 max-w-[20ch] text-sm text-[var(--lp-text-tertiary)]">
              The trust layer for AI memory.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold tracking-[0.1em] text-[var(--lp-text-tertiary)] uppercase">
                {col.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm text-[var(--lp-text-secondary)]">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.href}>
                      <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-[var(--lp-text)]">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link href={link.href} className="hover:text-[var(--lp-text)]">
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--lp-text-tertiary)]">© {new Date().getFullYear()} MEMORA</p>
      </div>
    </footer>
  );
}
