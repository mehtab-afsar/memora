"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus, Copy, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/[org]/[project]/settings/api-keys/actions";
import { formatRelativeTime } from "@/lib/format";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
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

  const handleCreate = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    startTransition(async () => {
      try {
        const fullKey = await createApiKeyAction(orgId, projectId, environment.id, name);
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
      }
    });
  };

  const closeCreateDialog = (open: boolean) => {
    setCreateOpen(open);
    if (!open) setRevealedKey(null);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-mono text-sm font-medium text-foreground">{environment.name}</span>
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
                <div className="py-4">
                  <Label htmlFor="key-name">Name</Label>
                  <Input id="key-name" name="name" placeholder="e.g. Production backend" className="mt-1.5" />
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
      </div>

      {environment.keys.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <KeyRound className="size-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No keys in this environment yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {environment.keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{key.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}…
                  </code>
                  {key.revokedAt && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Revoked
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Created {formatRelativeTime(key.createdAt)}
                  {key.lastUsedAt && <> · Last used {formatRelativeTime(key.lastUsedAt)}</>}
                </p>
              </div>
              {!key.revokedAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevoke(key.id)}
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
    </div>
  );
}
