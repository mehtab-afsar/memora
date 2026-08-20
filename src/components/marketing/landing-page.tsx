import Link from "next/link";
import { Brain, Sparkles, Lightbulb, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: "Memory intelligence",
    description:
      "Filters what's actually worth keeping, resolves duplicates and updates, and flags contradictions instead of silently guessing.",
  },
  {
    icon: Lightbulb,
    title: "Experience memory",
    description:
      "Agents remember what happened when they tried something before — and get grounded recommendations, never a hallucinated guess.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable, always",
    description:
      "Every memory carries its evidence and confidence. Every recall tells you exactly why it ranked where it did.",
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-6 md:px-10">
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-primary" strokeWidth={2.25} />
          <span className="text-sm font-semibold tracking-tight text-foreground">MEMORA</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button size="sm" render={<Link href="/signup" />}>
            Start building free
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center md:py-28">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Give your AI agents memory they can trust
          </h1>
          <p className="max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            MEMORA decides what&apos;s worth remembering, resolves contradictions instead of guessing, and explains
            why every memory exists — so your agents get more reliable over time, not noisier.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" render={<Link href="/signup" />}>
              Start building free
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/login" />}>
              Log in
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-20">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-foreground">
              <code>{`memory.remember(
  user_id="alice",
  content="I prefer concise answers"
)

memory.recall(
  user_id="alice",
  query="How should I respond?"
)
# -> ranked memories, each with a reason`}</code>
            </pre>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title} className="rounded-lg border border-border bg-card p-5">
                <prop.icon className="size-5 text-primary" strokeWidth={2} />
                <h2 className="mt-3 text-sm font-semibold text-foreground">{prop.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{prop.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground md:px-10">
        <span className="inline-flex items-center gap-1.5">
          <Brain className="size-3.5" />
          MEMORA
        </span>
        <span className="mx-2">·</span>
        The memory intelligence layer for AI agents.
      </footer>
    </div>
  );
}
