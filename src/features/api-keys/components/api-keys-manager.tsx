"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus, Copy, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions/api-keys-actions";
import { formatRelativeTime } from "@/lib/format";
import type { ApiKeyScope } from "@/lib/org";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  requestsThisPeriod: number;
};

type EnvironmentWithKeys = { id: string; name: string; keys: ApiKey[] };

export function ApiKeysManager({
  orgId,
  projectId,
  environments,
}: {
  orgId: string;
  projectId: string;
  environments: EnvironmentWithKeys[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {environments.map((env) => (
        <EnvironmentKeysCard key={env.id} orgId={orgId} projectId={projectId} environment={env} />
      ))}
    </div>
  );
}

function EnvironmentKeysCard({
  orgId,
  projectId,
  environment,
}: {
  orgId: string;
  projectId: string;
  environment: EnvironmentWithKeys;
}) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);

  const handleCreate = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    const scopes = formData.getAll("scopes") as ApiKeyScope[];
    startTransition(async () => {
      try {
        const fullKey = await createApiKeyAction(orgId, projectId, environment.id, name, scopes);
        setRevealedKey(fullKey);
        setCopied(false);
      } catch {
        toast.error("Failed to create key");
      }
    });
  };

  const handleRevoke = (apiKeyId: string) => {
    startTransition(async () => {
      try {
        await revokeApiKeyAction(orgId, projectId, environment.id, apiKeyId);
        toast.success("Key revoked");
      } catch {
        toast.error("Failed to revoke key");
      } finally {
        setPendingRevoke(null);
      }
    });
  };

  const closeCreateDialog = (open: boolean) => {
    setCreateOpen(open);
    if (!open) setRevealedKey(null);
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="font-mono">{environment.name}</CardTitle>
        <CardAction>
        <Dialog open={createOpen} onOpenChange={closeCreateDialog}>
          <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Plus className="size-3.5" />
            New key
          </DialogTrigger>
          <DialogContent>
            {revealedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Key created</DialogTitle>
                  <DialogDescription>Copy it now — it won&apos;t be shown again.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                  <code className="flex-1 overflow-x-auto font-mono text-xs text-foreground">{revealedKey}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(revealedKey);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={() => closeCreateDialog(false)}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <form action={handleCreate}>
                <DialogHeader>
                  <DialogTitle>New API key</DialogTitle>
                  <DialogDescription>Scoped to the {environment.name} environment.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div>
                    <Label htmlFor="key-name">Name</Label>
                    <Input id="key-name" name="name" placeholder="e.g. Production backend" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Permissions</Label>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" name="scopes" value="read" defaultChecked className="size-3.5" />
                        Read — recall and list memories
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" name="scopes" value="write" defaultChecked className="size-3.5" />
                        Write — remember and record experiences
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    Create key
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        {environment.keys.length === 0 ? (
          <EmptyState icon={KeyRound} title="No keys in this environment yet." className="border-none py-10" />
        ) : (
          <ul className="divide-y divide-border">
            {environment.keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{key.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {key.keyPrefix}…
                    </code>
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full border border-border bg-transparent px-2 py-0.5 text-xs capitalize text-muted-foreground"
                      >
                        {scope}
                      </span>
                    ))}
                    {key.revokedAt && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {key.lastUsedAt ? `Last used ${formatRelativeTime(key.lastUsedAt)}` : "Never used"}
                    {" · "}
                    {key.requestsThisPeriod.toLocaleString()} requests this period
                  </p>
                </div>
                {!key.revokedAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingRevoke(key)}
                    disabled={isPending}
                  >
                    <Ban className="size-3.5" />
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke API key?"
        description={`Any request using "${pendingRevoke?.name}" will start failing immediately. This cannot be undone.`}
        confirmLabel="Revoke key"
        isPending={isPending}
        onConfirm={() => pendingRevoke && handleRevoke(pendingRevoke.id)}
      />
    </Card>
  );
}
