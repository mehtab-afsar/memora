"use client";

import { useState, useTransition } from "react";
import { Layers, Pencil, Plus, Trash2, Check, X } from "lucide-react";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createEnvironmentAction,
  deleteEnvironmentAction,
  renameEnvironmentAction,
} from "@/features/environments/actions/environments-actions";
import { formatRelativeTime } from "@/lib/format";

type Environment = { id: string; name: string; createdAt: Date };

export function EnvironmentsManager({
  orgId,
  projectId,
  environments,
  apiKeyCounts,
}: {
  orgId: string;
  projectId: string;
  environments: Environment[];
  apiKeyCounts: Record<string, number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Environment | null>(null);

  const handleCreate = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createEnvironmentAction(orgId, projectId, name);
        toast.success(`Environment "${name}" created`);
        setCreateOpen(false);
      } catch {
        toast.error("Failed to create environment");
      }
    });
  };

  const handleRename = (environmentId: string, name: string) => {
    if (!name.trim()) return setEditingId(null);
    startTransition(async () => {
      const result = await renameEnvironmentAction(orgId, projectId, environmentId, name.trim());
      if (result.error) toast.error(result.error);
      setEditingId(null);
    });
  };

  const handleDelete = (environmentId: string) => {
    startTransition(async () => {
      const result = await deleteEnvironmentAction(orgId, projectId, environmentId);
      if (result.error) toast.error(result.error);
      else toast.success("Environment deleted");
      setPendingDelete(null);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Environments</span>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Plus className="size-3.5" />
            New environment
          </DialogTrigger>
          <DialogContent>
            <form action={handleCreate}>
              <DialogHeader>
                <DialogTitle>New environment</DialogTitle>
                <DialogDescription>Memories are scoped per environment, e.g. development vs. production.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="env-name">Name</Label>
                <Input id="env-name" name="name" placeholder="production" className="mt-1.5" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  Create environment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="divide-y divide-border">
        {environments.map((env) => {
          const keyCount = apiKeyCounts[env.id] ?? 0;
          const isOnlyEnvironment = environments.length <= 1;

          return (
            <li key={env.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Layers className="size-3.5 text-muted-foreground" />
              </span>

              {editingId === env.id ? (
                <EnvironmentRenameForm
                  initialName={env.name}
                  onSave={(name) => handleRename(env.id, name)}
                  onCancel={() => setEditingId(null)}
                  isPending={isPending}
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-foreground">{env.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatRelativeTime(env.createdAt)} · {keyCount} {keyCount === 1 ? "key" : "keys"}
                  </p>
                </div>
              )}

              {editingId !== env.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(env.id)} disabled={isPending}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(env)}
                    disabled={isPending || isOnlyEnvironment}
                    title={isOnlyEnvironment ? "A project needs at least one environment" : undefined}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete environment?"
        description={
          pendingDelete
            ? `This deletes "${pendingDelete.name}" and revokes its ${apiKeyCounts[pendingDelete.id] ?? 0} API ${
                (apiKeyCounts[pendingDelete.id] ?? 0) === 1 ? "key" : "keys"
              }. Memories in this environment are also removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete environment"
        isPending={isPending}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
      />
    </div>
  );
}

function EnvironmentRenameForm({
  initialName,
  onSave,
  onCancel,
  isPending,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 flex-1 font-mono text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(name);
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button variant="ghost" size="icon-sm" onClick={() => onSave(name)} disabled={isPending}>
        <Check className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onCancel} disabled={isPending}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
