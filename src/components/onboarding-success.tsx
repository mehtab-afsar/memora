"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingSuccess({
  orgId,
  projectId,
  apiKey,
}: {
  orgId: string;
  projectId: string;
  apiKey: string;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">You&apos;re set up</h1>
        <p className="text-sm text-muted-foreground">Your workspace is ready.</p>
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

      <Button className="gap-1.5" render={<Link href={`/${orgId}/${projectId}/overview`} />}>
        Continue to dashboard
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}
