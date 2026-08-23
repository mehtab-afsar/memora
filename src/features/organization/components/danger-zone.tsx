"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteOrgAction } from "@/features/organization/actions/organization-actions";

export function DangerZone({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () =>
    startTransition(async () => {
      const result = await deleteOrgAction(orgId);
      // A successful delete redirects server-side and never returns here.
      if (result?.error) toast.error(result.error);
    });

  return (
    <div className="rounded-lg border border-destructive/30 bg-card p-5">
      <h2 className="text-sm font-medium text-foreground">Danger zone</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-foreground">Delete this organization</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently deletes every project, environment, API key and membership. Cancels any
            active subscription first. This cannot be undone.
          </p>
        </div>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive" size="sm" className="gap-1.5" disabled={isPending}>
              <Trash2 className="size-3.5" />
              Delete organization
            </Button>
          }
          title="Delete organization"
          description={`This permanently deletes "${orgName}" and everything in it — projects, environments, API keys and memberships. Any active subscription is cancelled first. This cannot be undone.`}
          confirmLabel="Delete organization"
          confirmText={orgName}
          isPending={isPending}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
