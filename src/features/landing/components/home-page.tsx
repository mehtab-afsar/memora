import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductPreview } from "@/features/landing/components/product-preview";
import { StructuredData } from "@/features/landing/components/structured-data";
import { MarketingShell } from "@/features/landing/components/marketing-shell";
import { MarketingHeader } from "@/features/landing/components/marketing-header";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { Eyebrow, PrimaryButton, GhostButton, GITHUB_URL } from "@/features/landing/lib/lp-theme";

const EXPLORE = [
  {
    href: "/product",
    eyebrow: "Product",
    title: "A decision engine, not a bigger vector database",
    description: "What gets stored, how conflicts get flagged, and why Memory and Experience are two different things.",
  },
  {
    href: "/how-it-works",
    eyebrow: "How it works",
    title: "Four steps, every time",
    description: "Remember, decide, store, recall — with a real code example for each one.",
  },
];

export function HomePage() {
  return (
    <MarketingShell>
      <StructuredData />
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1120px] px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-7">
              <Eyebrow>The trust layer for AI memory</Eyebrow>
              <h1 className="text-6xl leading-[0.98] font-bold tracking-tighter text-[var(--lp-text)] md:text-7xl">
                Memory your agents can actually{" "}
                <span className="text-[var(--lp-accent)]">trust.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-[var(--lp-text-secondary)]">
                Storing facts is commodity. MEMORA decides what&apos;s worth remembering, catches contradictions
                before they cause a bad response, and shows its work on every single recall.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <PrimaryButton href="/signup">Start building — free</PrimaryButton>
                <GhostButton href={GITHUB_URL}>Read the docs</GhostButton>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Bold statement band */}
        <section className="bg-[var(--lp-text)] px-6 py-24">
          <div className="mx-auto max-w-[900px] text-center">
            <p className="text-3xl leading-[1.15] font-bold tracking-tight text-white md:text-5xl">
              Most memory layers store everything and hope.
              <br />
              MEMORA decides.
            </p>
          </div>
        </section>

        {/* Explore deeper */}
        <section className="border-b border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>Go deeper</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-4xl">
              Two pages, if you want the details.
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              {EXPLORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col gap-3 rounded-lg border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] p-7 transition-colors hover:border-[var(--lp-text)]"
                >
                  <Eyebrow>{item.eyebrow}</Eyebrow>
                  <h3 className="text-xl font-bold text-[var(--lp-text)]">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--lp-text-secondary)]">{item.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--lp-accent)]">
                    Read more
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-28 text-center">
          <h2 className="mx-auto max-w-2xl text-4xl leading-[1.05] font-bold tracking-tight text-[var(--lp-text)] md:text-6xl">
            Give your agents memory that gets more reliable over time.
          </h2>
          <p className="mt-4 text-base text-[var(--lp-text-secondary)]">
            MEMORA — the memory intelligence layer for AI agents.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton href="/signup">Start building — free</PrimaryButton>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
