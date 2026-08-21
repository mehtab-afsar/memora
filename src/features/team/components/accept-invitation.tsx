"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/features/team/actions/team-actions";

/**
 * A form, not a link. Accepting is a state change, so it happens on POST —
 * which is also what keeps email security scanners from consuming the
 * invitation before its recipient sees it.
 */
export function AcceptInvitation({ token, orgName }: { token: string; orgName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-5"
      action={() =>
        startTransition(async () => {
          // On success this redirects and never returns; only a failure comes
          // back with something to display.
          const result = await acceptInvitationAction(token);
          if (result?.error) setError(result.error);
        })
      }
    >
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Joining…" : `Join ${orgName}`}
      </Button>
      {error && <p className="mt-3 text-sm text-status-critical">{error}</p>}
    </form>
  );
}
