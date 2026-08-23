import { Differentiation } from "@/features/landing/components/differentiation";
import { MarketingShell } from "@/features/landing/components/marketing-shell";
import { MarketingHeader } from "@/features/landing/components/marketing-header";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { Eyebrow, PrimaryButton } from "@/features/landing/lib/lp-theme";

const PROBLEMS = [
  {
    title: "Memory pollution",
    description: "Every passing remark gets stored forever, drowning out what actually matters.",
  },
  {
    title: "Silent staleness",
    description: "Facts that stopped being true stick around with nothing to say they've changed.",
  },
  {
    title: "Black-box retrieval",
    description: "A vector search returns something — there's no way to know why, or whether to trust it.",
  },
];

export function ProductPage() {
  return (
    <MarketingShell>
      <MarketingHeader active="product" />

      <main>
        {/* Page hero */}
        <section className="mx-auto max-w-[1120px] px-6 pt-20 pb-16 md:pt-24">
          <Eyebrow>Product</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.02] font-bold tracking-tighter text-[var(--lp-text)] md:text-6xl">
            A decision engine that sits in front of one.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--lp-text-secondary)]">
            Storing facts is commodity. Knowing what&apos;s true, what matters, what changed, and when to recall it
            — that&apos;s the part every naive memory layer skips.
          </p>
        </section>

        {/* Problem */}
        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>Storage isn&apos;t the hard part</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              Three ways naive memory layers fail.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-lg border-2 border-[var(--lp-border)] bg-[var(--lp-bg)] p-6">
                  <h3 className="text-lg font-bold text-[var(--lp-text)]">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-text-secondary)]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Differentiation */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>Not a bigger vector database</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              Every decision, made on purpose.
            </h2>
            <div className="mt-12">
              <Differentiation />
            </div>
          </div>
        </section>

        {/* Two kinds of memory */}
        <section className="border-t border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>Two kinds of memory</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              What the agent knows, and what it&apos;s learned.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-lg border-2 border-[var(--lp-text)] bg-[var(--lp-bg)] p-8">
                <h3 className="text-2xl font-bold text-[var(--lp-text)]">Memory</h3>
                <p className="mt-1.5 text-sm text-[var(--lp-text-secondary)]">What do I know about this person?</p>
                <ul className="mt-5 flex flex-col gap-3 text-sm font-medium text-[var(--lp-text)]">
                  <li>Preferences, facts, goals, relationships</li>
                  <li>Deduplicated, versioned, contradiction-aware</li>
                  <li>Confidence and freshness on every entry</li>
                </ul>
              </div>
              <div className="rounded-lg border-2 border-[var(--lp-accent)] bg-[var(--lp-bg)] p-8">
                <h3 className="text-2xl font-bold text-[var(--lp-accent)]">Experience</h3>
                <p className="mt-1.5 text-sm text-[var(--lp-text-secondary)]">What have I learned from doing things?</p>
                <ul className="mt-5 flex flex-col gap-3 text-sm font-medium text-[var(--lp-text)]">
                  <li>Task attempts, outcomes, causes, resolutions</li>
                  <li>Grounded recommendations — never a hallucinated guess</li>
                  <li>No relevant history means no recommendation, not a bluff</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--lp-border)] px-6 py-24 text-center">
          <h2 className="mx-auto max-w-xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-4xl">
            See exactly how it works, step by step.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton href="/how-it-works">How it works</PrimaryButton>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
