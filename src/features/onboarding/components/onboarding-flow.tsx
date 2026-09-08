"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Lightbulb,
  KeyRound,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { hanken, dmMono, HOME_VARS } from "@/features/landing/lib/home-tokens";
import { PrimaryButton, GhostButton } from "@/features/landing/components/home/buttons";

const STEP_COUNT = 3;

export function OnboardingFlow({
  userName,
  orgId,
  projectId,
  environmentName,
  apiKey,
}: {
  userName: string | null | undefined;
  orgId: string;
  projectId: string;
  environmentName: string;
  apiKey: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const dashboardHref = `/${orgId}/${projectId}/overview`;
  const playgroundHref = `/${orgId}/${projectId}/playground`;

  return (
    <div
      className={`${hanken.variable} ${dmMono.variable} flex min-h-screen flex-col bg-white text-[var(--ink)]`}
      style={{ ...HOME_VARS, fontFamily: "var(--font-home-sans)" }}
    >
      <header className="flex h-16 items-center justify-center px-6">
        <div className="flex items-center gap-2">
          <BrandMark className="size-6 text-[var(--indigo)]" />
          <span className="text-[17px] font-semibold tracking-[0.08em] text-[var(--ink)]">MEMORA</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 pb-24">
        <StepIndicator current={step} total={STEP_COUNT} />

        <div key={step} className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {step === 1 && <WelcomeStep userName={userName} onNext={() => setStep(2)} />}
          {step === 2 && (
            <ApiKeyStep
              environmentName={environmentName}
              apiKey={apiKey}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <QuickStartStep
              apiKey={apiKey}
              environmentName={environmentName}
              playgroundHref={playgroundHref}
              onBack={() => setStep(2)}
              onFinish={() => router.push(dashboardHref)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              n === current ? "w-6 bg-[var(--indigo)]" : "w-1.5 bg-[var(--line)]"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--muted)]">
        Step {current} of {total}
      </span>
    </div>
  );
}

function StepHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--indigo-2)] text-[var(--indigo)]">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-medium tracking-[-0.015em] text-[var(--ink)]">{title}</h1>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

function WelcomeStep({ userName, onNext }: { userName: string | null | undefined; onNext: () => void }) {
  return (
    <>
      <StepHeading
        icon={BrandMark}
        title={userName ? `Welcome, ${userName}` : "Welcome to Memora"}
        description="Your workspace is ready. Here's what makes it different from a plain vector store."
      />

      <div className="flex flex-col gap-4">
        <ConceptRow
          icon={Database}
          title="Memory"
          description="What the agent knows — facts, preferences, and goals, deduplicated and versioned."
        />
        <ConceptRow
          icon={Lightbulb}
          title="Experience"
          description="What the agent has learned from doing things — grounded recommendations, never a guess."
        />
      </div>

      <PrimaryButton onClick={onNext} className="w-full">
        Continue
        <ArrowRight className="size-3.5" />
      </PrimaryButton>
    </>
  );
}

function ConceptRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--paper-2)] text-[var(--ink)]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
        <p className="text-sm text-[var(--ink-2)]">{description}</p>
      </div>
    </div>
  );
}

function ApiKeyStep({
  environmentName,
  apiKey,
  onBack,
  onNext,
}: {
  environmentName: string;
  apiKey: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <StepHeading
        icon={KeyRound}
        title="Your first API key"
        description={`Authenticates requests to your ${environmentName} environment. Copy it now — it won't be shown again.`}
      />

      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2.5">
        <code className="flex-1 overflow-x-auto font-[family-name:var(--font-home-mono)] text-xs text-[var(--ink)]">
          {apiKey}
        </code>
        <button
          type="button"
          aria-label="Copy API key"
          className="text-[var(--indigo)]"
          onClick={() => {
            void navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      <div className="flex gap-2">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Back
        </GhostButton>
        <PrimaryButton onClick={onNext} className="flex-1">
          Continue
          <ArrowRight className="size-3.5" />
        </PrimaryButton>
      </div>
    </>
  );
}

function QuickStartStep({
  apiKey,
  environmentName,
  playgroundHref,
  onBack,
  onFinish,
}: {
  apiKey: string;
  environmentName: string;
  playgroundHref: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState<"sdk" | "mcp">("sdk");

  const sdkSnippet = `import { Memora } from "@memora/client";

const memora = new Memora({ apiKey: "${apiKey}" });

await memora.remember({ userId: "alice", content: "prefers concise answers" });

const { results } = await memora.recall({ userId: "alice", query: "how should I respond?" });
// -> ranked memories, each with a reason`;

  const mcpSnippet = `{
  "mcpServers": {
    "memora": {
      "command": "npx",
      "args": ["-y", "@memora/mcp"],
      "env": {
        "MEMORA_API_KEY": "${apiKey}",
        "MEMORA_USER_ID": "you@example.com"
      }
    }
  }
}`;

  return (
    <>
      <StepHeading
        icon={Terminal}
        title="You're ready"
        description={`Real code for your ${environmentName} environment — the key is already dropped in.`}
      />

      <div>
        <div role="tablist" className="flex gap-5 border-b border-[var(--line)]">
          {(["sdk", "mcp"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-sm font-medium",
                tab === id ? "border-[var(--ink)] text-[var(--ink)]" : "border-transparent text-[var(--muted)]"
              )}
            >
              {id === "sdk" ? "SDK" : "MCP"}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)]">
          <pre className="overflow-x-auto bg-[var(--paper-2)] px-4 py-3 font-[family-name:var(--font-home-mono)] text-xs leading-relaxed text-[var(--ink)]">
            <code>{tab === "sdk" ? sdkSnippet : mcpSnippet}</code>
          </pre>
        </div>
        {tab === "mcp" && <p className="mt-2 text-xs text-[var(--muted)]">For Claude Code, Cursor, or any MCP client.</p>}
      </div>

      <div className="flex gap-2">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Back
        </GhostButton>
        <PrimaryButton onClick={onFinish} className="flex-1">
          Go to dashboard
        </PrimaryButton>
      </div>

      <Link href={playgroundHref} className="mx-auto text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
        Or try the Playground first
      </Link>
    </>
  );
}
