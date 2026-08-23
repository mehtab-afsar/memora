"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptOrgClaimAction } from "@/features/onboarding/actions/claim-actions";

/**
 * A form, not a link — same reasoning as `AcceptInvitation`: accepting is a
 * state change, so it happens on POST, not on the GET that renders this page.
 */
export function AcceptOrgClaim({ token, orgName }: { token: string; orgName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-5"
      action={() =>
        startTransition(async () => {
          // On success this redirects and never returns; only a failure comes back.
          const result = await acceptOrgClaimAction(token);
          if (result?.error) setError(result.error);
        })
      }
    >
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Claiming…" : `Claim ${orgName}`}
      </Button>
      {error && <p className="mt-3 text-sm text-status-critical">{error}</p>}
    </form>
  );
}
