import Link from "next/link";
import { TriangleAlert } from "lucide-react";

const PAGES = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/sub-processors", label: "Sub-processors" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      {/*
        This banner is load-bearing, not decoration. These documents were
        drafted from what the system actually does, which makes the technical
        substance accurate — but they have not been reviewed by a lawyer, name
        no legal entity, and pick no governing jurisdiction. Publishing them as
        they stand would be presenting unreviewed text as a binding agreement.
      */}
      <div className="mb-10 flex gap-3 rounded-lg border border-status-warning/40 bg-status-warning/10 p-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Draft — not legal advice, not yet in force</p>
          <p className="mt-1 text-muted-foreground">
            Written from how the product actually works, so the descriptions of data handling are
            accurate. They have not been reviewed by a lawyer, and the bracketed placeholders must be
            completed before this can be shown to a customer.
          </p>
        </div>
      </div>

      <nav className="mb-10 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm">
        {PAGES.map((page) => (
          <Link key={page.href} href={page.href} className="text-muted-foreground hover:text-foreground">
            {page.label}
          </Link>
        ))}
      </nav>

      <article className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_strong]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </article>
    </div>
  );
}
