"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-center px-6">
        <div className="flex items-center gap-2">
          <BrandMark className="size-6 text-primary" />
          <span className="text-base font-light tracking-wider text-foreground">Memora</span>
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
              n === current ? "w-6 bg-primary" : "w-1.5 bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
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
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
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

      <Button onClick={onNext} className="w-full gap-1.5">
        Continue
        <ArrowRight className="size-3.5" />
      </Button>
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
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
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

      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
        <code className="flex-1 overflow-x-auto font-mono text-xs text-foreground">{apiKey}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy API key"
          onClick={() => {
            void navigator.clipboard.writeText(apiKey);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 gap-1.5">
          Continue
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

function QuickStartStep({
  playgroundHref,
  onBack,
  onFinish,
}: {
  playgroundHref: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <>
      <StepHeading icon={Terminal} title="You're ready" description="Two calls cover most of what you'll do." />

      <div className="overflow-hidden rounded-lg border border-border">
        <pre className="overflow-x-auto bg-muted px-4 py-3 font-mono text-xs leading-relaxed text-foreground">
          <code>{`memory.remember(user_id="alice", content="prefers concise answers")

memory.recall(user_id="alice", query="how should I respond?")
# -> ranked memories, each with a reason`}</code>
        </pre>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <Button onClick={onFinish} className="flex-1">
          Go to dashboard
        </Button>
      </div>

      <Button
        variant="link"
        nativeButton={false}
        render={<a href={playgroundHref} />}
        className="mx-auto text-muted-foreground"
      >
        Or try the Playground first
      </Button>
    </>
  );
}
