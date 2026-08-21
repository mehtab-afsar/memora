import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { BrandMark } from "@/components/brand-mark";
import { ProductPreview } from "@/features/landing/components/product-preview";
import { Differentiation } from "@/features/landing/components/differentiation";
import { StructuredData } from "@/features/landing/components/structured-data";

const inter = Inter({ subsets: ["latin"], variable: "--font-lp-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-lp-mono" });

const GITHUB_URL = "https://github.com/mehtab-afsar/memora";

// Fixed light-only palette, deliberately independent of the app's themed
// design tokens (which support dark mode) — this page opts out of theming
// entirely, per spec. Scoped via inline custom properties on the root, not
// the shared :root/.dark blocks in globals.css. The one dark section further
// down (BoldStatement) is a fixed decorative choice, not a dark-mode toggle —
// it never changes with the visitor's OS preference, same as everything else.
const LP_VARS = {
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

const HOW_IT_WORKS = [
  { step: "1", title: "Remember", description: "Raw text in — a triviality rubric decides what's actually worth keeping." },
  { step: "2", title: "Decide", description: "New, an update, a merge, redundant, or a contradiction — never a silent guess." },
  { step: "3", title: "Store", description: "Confidence, evidence, and full version history — nothing overwritten in place." },
  { step: "4", title: "Recall", description: "Ranked results, each with a plain-English reason it was retrieved." },
];

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-[var(--lp-accent)] px-6 py-3.5 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
    >
      {children}
    </Link>
  );
}

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md border-2 border-[var(--lp-text)] bg-transparent px-6 py-3.5 text-base font-semibold text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-text)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
    >
      {children}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-xs font-bold tracking-[0.15em] text-[var(--lp-accent)] uppercase"
      style={{ fontFamily: "var(--font-lp-mono)" }}
    >
      {children}
    </span>
  );
}

export function LandingPage() {
  return (
    <div
      className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-[var(--lp-bg)]`}
      style={{ ...LP_VARS, fontFamily: "var(--font-lp-sans)" }}
    >
      <StructuredData />

      <header className="border-b border-[var(--lp-border)]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-[var(--lp-text)]">
            <BrandMark className="size-6" />
            <span className="text-base font-bold tracking-tight">MEMORA</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--lp-text-secondary)] md:flex">
            <a href="#product" className="hover:text-[var(--lp-text)]">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-[var(--lp-text)]">
              How it works
            </a>
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

      <main>
        {/* Hero */}
        <section id="product" className="mx-auto max-w-[1120px] px-6 pt-20 pb-24 md:pt-28 md:pb-32">
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

        {/* Problem */}
        <section className="border-b border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>Storage isn&apos;t the hard part</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              Knowing what&apos;s true, what matters, what changed, and when to recall it.
            </h2>
            <p className="mt-4 max-w-xl text-base text-[var(--lp-text-secondary)]">
              That&apos;s the part every naive memory layer skips.
            </p>
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
              A decision engine that sits in front of one.
            </h2>
            <div className="mt-12">
              <Differentiation />
            </div>
          </div>
        </section>

        {/* Two kinds of memory */}
        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-24">
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

        {/* How it works + code */}
        <section id="how-it-works" className="px-6 py-24">
          <div className="mx-auto max-w-[1120px]">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-[var(--lp-text)] md:text-5xl">
              Four steps, every time.
            </h2>

            <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="flex flex-col gap-3">
                  <span
                    className="text-5xl font-bold text-[var(--lp-accent)]"
                    style={{ fontFamily: "var(--font-lp-mono)" }}
                  >
                    {item.step}
                  </span>
                  <h3 className="text-base font-bold text-[var(--lp-text)]">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--lp-text-secondary)]">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 overflow-hidden rounded-lg border border-[#2A2A28] shadow-xl">
              <div className="flex items-center gap-1.5 border-b border-[#2A2A28] bg-[#111110] px-4 py-3">
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span className="size-2.5 rounded-full bg-[#E7E5E1]/20" />
                <span
                  className="ml-2 text-xs text-[#8A8A85]"
                  style={{ fontFamily: "var(--font-lp-mono)" }}
                >
                  example.py
                </span>
              </div>
              <pre
                className="overflow-x-auto bg-[#0A0A0A] p-6 text-sm leading-relaxed text-[#F5F5F3]"
                style={{ fontFamily: "var(--font-lp-mono)" }}
              >
                <code>{`memory.remember(user_id="alice", content="I prefer concise answers")

memory.recall(user_id="alice", query="How should I respond?")
# -> ranked memories, each with a reason

experience.recall(task="Deploy the app to production")
# -> grounded recommendation, or nothing at all`}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-28 text-center">
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

      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-4 text-sm text-[var(--lp-text-tertiary)] md:flex-row">
          <span className="inline-flex items-center gap-1.5 text-[var(--lp-text)]">
            <BrandMark className="size-3.5" />
            MEMORA
          </span>
          <nav className="flex items-center gap-6">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--lp-text)]">
              GitHub
            </a>
          </nav>
          <span>© {new Date().getFullYear()} MEMORA</span>
        </div>
      </footer>
    </div>
  );
}
