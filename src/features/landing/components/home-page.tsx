import Link from "next/link";
import { StructuredData } from "@/features/landing/components/structured-data";
import { SiteHeader } from "@/features/landing/components/home/site-header";
import { RecallCard } from "@/features/landing/components/home/recall-card";
import { CopyInstallButton } from "@/features/landing/components/home/copy-install-button";
import { PipelineTabs } from "@/features/landing/components/home/pipeline-tabs";
import { hanken, dmMono, HOME_VARS } from "@/features/landing/lib/home-tokens";
import { GITHUB_URL } from "@/features/landing/lib/lp-theme";

const DECIDES = [
  {
    title: "Is it worth remembering?",
    body: "Most of a conversation isn't. Salience scoring keeps preferences, constraints and durable facts, and drops chatter.",
    bullets: [
      "Kind-aware scoring: preference, fact, constraint, task",
      "Merges restatements instead of storing five versions",
      "Decay for time-bound facts (\"I'm travelling this week\")",
    ],
  },
  {
    title: "Does it contradict something?",
    body: "A new fact that disagrees with an old one is a decision, not an overwrite. MEMORA surfaces both, picks a side, and says why.",
    bullets: [
      "Supersede, keep both, or ask — configurable per kind",
      "Old memory retained with a pointer to what replaced it",
      "Conflicts exposed via webhook for human review",
    ],
  },
  {
    title: "Can it show its work?",
    body: "Every recall returns the sources it rests on, with timestamps and a confidence you can threshold against.",
    bullets: [
      "Evidence quotes, not just IDs",
      "Confidence updates as new signals arrive",
      "Full audit trail per memory: created, superseded, recalled",
    ],
  },
];

export function HomePage() {
  return (
    <div
      className={`${hanken.variable} ${dmMono.variable} min-h-screen bg-white text-[var(--ink)]`}
      style={{ ...HOME_VARS, fontFamily: "var(--font-home-sans)", fontSize: "17px", lineHeight: 1.55 }}
    >
      <StructuredData />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1120px] px-7 pt-20 pb-[72px]">
          <div className="grid grid-cols-1 items-center gap-11 md:grid-cols-2 md:gap-16">
            <div>
              <h1
                className="max-w-[12ch] text-[clamp(38px,5vw,62px)] font-medium tracking-[-0.035em]"
                style={{ lineHeight: 1.02 }}
              >
                Memory your agents can actually trust.
              </h1>
              <p className="mt-6 max-w-[46ch] text-[19px] text-[var(--ink-2)]">
                Storing facts is commodity. MEMORA decides what&apos;s worth remembering, catches contradictions
                before they cause a bad response, and shows its work on every recall.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--ink)] px-6 py-[15px] text-base font-medium text-white transition-colors hover:bg-[#0f0f14]"
                >
                  Start building — free
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] px-6 py-[15px] text-base font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-2)]"
                >
                  Read the docs
                </a>
              </div>
              <CopyInstallButton command="npm install @memora/client" />
            </div>
            <RecallCard />
          </div>
        </section>

        {/* Statement band */}
        <div className="border-t border-b border-[var(--line)] py-[72px]">
          <div className="mx-auto max-w-[1120px] px-7">
            <p
              className="max-w-[22ch] text-[clamp(24px,3vw,36px)] font-medium tracking-[-0.025em]"
              style={{ lineHeight: 1.2 }}
            >
              Most memory layers store everything and hope.{" "}
              <span className="text-[var(--muted)]">MEMORA decides.</span>
            </p>
          </div>
        </div>

        {/* Four steps */}
        <section id="how" className="bg-[var(--paper-2)] py-26">
          <div className="mx-auto max-w-[1120px] px-7">
            <h2
              className="max-w-[20ch] text-[clamp(30px,3.6vw,44px)] font-medium tracking-[-0.03em]"
              style={{ lineHeight: 1.08 }}
            >
              Four steps, every time.
            </h2>
            <p className="mt-4 max-w-[50ch] text-lg text-[var(--ink-2)]">
              Every message goes through the same pipeline. Nothing gets stored without a decision, and nothing
              gets recalled without a reason.
            </p>
            <PipelineTabs />
          </div>
        </section>

        {/* What "decides" means */}
        <section id="decides" className="py-26">
          <div className="mx-auto max-w-[1120px] px-7">
            <h2
              className="max-w-[20ch] text-[clamp(30px,3.6vw,44px)] font-medium tracking-[-0.03em]"
              style={{ lineHeight: 1.08 }}
            >
              What &quot;decides&quot; actually means.
            </h2>
            <p className="mt-4 max-w-[50ch] text-lg text-[var(--ink-2)]">
              Three questions, asked of every candidate fact, before anything is stored or returned.
            </p>
            <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
              {DECIDES.map((d, i) => (
                <div
                  key={d.title}
                  className={`border-t border-[var(--ink)] pr-0 md:pr-8 ${
                    i > 0 ? "md:border-l md:border-l-[var(--line)] md:pl-8" : ""
                  }`}
                >
                  <h3 className="mt-5 text-[21px] font-medium tracking-[-0.015em]">{d.title}</h3>
                  <p className="mt-2 text-base text-[var(--ink-2)]">{d.body}</p>
                  <ul className="mt-[18px] flex flex-col gap-2.5 text-[15px] text-[var(--ink-2)]">
                    {d.bullets.map((b) => (
                      <li key={b} className="relative pl-4">
                        <span className="absolute top-[10px] left-0 h-px w-[7px] bg-[var(--indigo)]" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Memory vs Experience */}
        <section className="bg-[var(--paper-2)] py-26">
          <div className="mx-auto max-w-[1120px] px-7">
            <h2
              className="max-w-[20ch] text-[clamp(30px,3.6vw,44px)] font-medium tracking-[-0.03em]"
              style={{ lineHeight: 1.08 }}
            >
              Memory and Experience are two different things.
            </h2>
            <p className="mt-4 max-w-[50ch] text-lg text-[var(--ink-2)]">
              Most layers blur them. MEMORA keeps them apart, because they answer different questions.
            </p>
            <div className="mt-14 grid grid-cols-1 gap-9 md:grid-cols-2 md:gap-16">
              <div className="border-t border-[var(--ink)] pt-5">
                <h3 className="text-[21px] font-medium tracking-[-0.015em]">Memory</h3>
                <p className="mt-2 text-base text-[var(--ink-2)]">
                  What is true about the user and the world. &quot;Prefers concise answers.&quot; &quot;Uses
                  Postgres.&quot; &quot;Deadline is Friday.&quot; Recalled to shape the next response.
                </p>
                <code className="mt-4 block rounded-lg border border-[var(--line)] bg-white px-3.5 py-3 font-[family-name:var(--font-home-mono)] text-[13px] whitespace-pre text-[var(--ink-2)]">
                  memora.recall({"{ userId, query }"})
                </code>
              </div>
              <div className="border-t border-[var(--ink)] pt-5">
                <h3 className="text-[21px] font-medium tracking-[-0.015em]">Experience</h3>
                <p className="mt-2 text-base text-[var(--ink-2)]">
                  What the agent did and how it went. &quot;Suggested a migration; user rejected it.&quot;
                  &quot;Retry with smaller batch succeeded.&quot; Recalled to shape the next action.
                </p>
                <code className="mt-4 block rounded-lg border border-[var(--line)] bg-white px-3.5 py-3 font-[family-name:var(--font-home-mono)] text-[13px] whitespace-pre text-[var(--ink-2)]">
                  memora.experiences.recommend(task)
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="border-t border-[var(--line)] py-26">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 px-7 md:grid-cols-[1fr_auto]">
            <div>
              <h2
                className="max-w-[20ch] text-[clamp(30px,3.6vw,44px)] font-medium tracking-[-0.03em]"
                style={{ lineHeight: 1.08 }}
              >
                Give your agents memory that gets more reliable over time.
              </h2>
              <p className="mt-3 max-w-[42ch] text-[var(--ink-2)]">
                Free for development. Source available on GitHub. Add it to an existing agent in an afternoon.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--ink)] px-6 py-[15px] text-base font-medium text-white transition-colors hover:bg-[#0f0f14]"
            >
              Start building — free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] pt-12 pb-8 text-sm text-[var(--muted)]">
        <div className="mx-auto max-w-[1120px] px-7">
          <div className="grid grid-cols-2 gap-10 border-b border-[var(--line)] pb-9 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <span className="block text-[17px] font-semibold tracking-[0.08em] text-[var(--ink)]">MEMORA</span>
              <p className="mt-2.5 max-w-[26ch]">The trust layer for AI memory.</p>
            </div>
            <div>
              <b className="mb-3 block font-medium text-[var(--ink)]">Product</b>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link href="/product" className="hover:text-[var(--ink)]">
                    Product
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-[var(--ink)]">
                    How it works
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <b className="mb-3 block font-medium text-[var(--ink)]">Resources</b>
              <ul className="flex flex-col gap-2">
                <li>
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--ink)]">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <b className="mb-3 block font-medium text-[var(--ink)]">Legal</b>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link href="/legal/terms" className="hover:text-[var(--ink)]">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy" className="hover:text-[var(--ink)]">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/sub-processors" className="hover:text-[var(--ink)]">
                    Sub-processors
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-[22px]">© {new Date().getFullYear()} MEMORA</div>
        </div>
      </footer>
    </div>
  );
}
