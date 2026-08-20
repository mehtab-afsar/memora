"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { onboardingAction, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";

const initialState: OnboardingState = {};

function OnboardingHeader() {
  return (
    <header className="flex h-16 items-center px-6">
      <Link href="/" className="flex items-center gap-2">
        <BrandMark className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight text-foreground">MEMORA</span>
      </Link>
    </header>
  );
}

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(onboardingAction, initialState);
  const [copied, setCopied] = useState(false);

  if (state.result) {
    const { apiKey, orgName, projectName, environmentName } = state.result;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <OnboardingHeader />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 pb-24">
          <div>
            <h1 className="text-xl font-semibold text-foreground">You&apos;re set up</h1>
            <p className="text-sm text-muted-foreground">
              Org <strong className="text-foreground">{orgName}</strong>, project{" "}
              <strong className="text-foreground">{projectName}</strong>, environment{" "}
              <strong className="text-foreground">{environmentName}</strong>.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Your API key (shown once — store it now)</p>
            <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground">
              {apiKey}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => {
                void navigator.clipboard.writeText(apiKey);
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">Try it</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              {`curl -H "Authorization: Bearer ${apiKey}" ${origin}/api/v1/whoami`}
            </pre>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 pb-24">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Set up your workspace</h1>
          <p className="text-sm text-muted-foreground">Create an organization and your first project.</p>
        </div>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" name="orgName" type="text" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectName">Project name</Label>
            <Input id="projectName" name="projectName" type="text" required defaultValue="Default project" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-1">
            {pending ? "Creating..." : "Create workspace"}
          </Button>
        </form>
      </main>
    </div>
  );
}
