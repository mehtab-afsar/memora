import { MarketingShell } from "@/features/landing/components/marketing-shell";
import { MarketingHeader } from "@/features/landing/components/marketing-header";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { Eyebrow, PrimaryButton } from "@/features/landing/lib/lp-theme";

const STEPS = [
  { step: "1", title: "Remember", description: "Raw text in — a triviality rubric decides what's actually worth keeping." },
  { step: "2", title: "Decide", description: "New, an update, a merge, redundant, or a contradiction — never a silent guess." },
  { step: "3", title: "Store", description: "Confidence, evidence, and full version history — nothing overwritten in place." },
  { step: "4", title: "Recall", description: "Ranked results, each with a plain-English reason it was retrieved." },
];

export function HowItWorksPage() {
  return (
    <MarketingShell>
      <MarketingHeader active="how-it-works" />

      <main>
        {/* Page hero */}
        <section className="mx-auto max-w-[1120px] px-6 pt-20 pb-16 md:pt-24">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-5xl leading-[1.02] font-bold tracking-tighter text-[var(--lp-text)] md:text-6xl">
            Four steps, every time.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--lp-text-secondary)]">
            No hidden ranking, no silent overwrite. Every write and every recall goes through the same four
            steps, and every step is inspectable.
          </p>
        </section>

        {/* Steps */}
        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-20">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-4">
            {STEPS.map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <span
                  className="text-6xl font-bold text-[var(--lp-accent)]"
                  style={{ fontFamily: "var(--font-lp-mono)" }}
                >
                  {item.step}
                </span>
                <h3 className="text-lg font-bold text-[var(--lp-text)]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--lp-text-secondary)]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Code */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>In practice</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              Two calls cover most of what you&apos;ll do.
            </h2>

            <div className="mt-12 overflow-hidden rounded-lg border border-[#2A2A28] shadow-xl">
              <div className="flex items-center gap-1.5 border-b border-[#2A2A28] bg-[#111110] px-4 py-3">
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span
                  className="ml-2 text-xs text-[#8A8A85]"
                  style={{ fontFamily: "var(--font-lp-mono)" }}
                >
                  example.ts
                </span>
              </div>
              <pre
                className="overflow-x-auto bg-[#0A0A0A] p-6 text-sm leading-relaxed text-[#F5F5F3]"
                style={{ fontFamily: "var(--font-lp-mono)" }}
              >
                <code>{`import { Memora } from "@memora/client";

const memora = new Memora({ apiKey: process.env.MEMORA_API_KEY! });

await memora.remember({ userId: "alice", content: "I prefer concise answers" });

const { results } = await memora.recall({ userId: "alice", query: "How should I respond?" });
// -> ranked memories, each with a reason

await memora.experiences.recommend("Deploy the app to production");
// -> grounded recommendation, or nothing at all`}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24 text-center">
          <h2 className="mx-auto max-w-xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-4xl">
            Give your agents memory that gets more reliable over time.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton href="/signup">Start building — free</PrimaryButton>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
