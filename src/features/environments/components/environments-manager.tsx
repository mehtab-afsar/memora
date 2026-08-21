"use client";

import { useState, useTransition } from "react";
import { Layers, Plus } from "lucide-react";
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
import { createEnvironmentAction } from "@/features/environments/actions/environments-actions";
import { formatRelativeTime } from "@/lib/format";

type Environment = { id: string; name: string; createdAt: Date };

export function EnvironmentsManager({
  orgId,
  projectId,
  environments,
}: {
  orgId: string;
  projectId: string;
  environments: Environment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleCreate = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createEnvironmentAction(orgId, projectId, name);
        toast.success(`Environment "${name}" created`);
        setOpen(false);
      } catch {
        toast.error("Failed to create environment");
      }
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Environments</span>
        <Dialog open={open} onOpenChange={setOpen}>
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
        {environments.map((env) => (
          <li key={env.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted">
              <Layers className="size-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-mono text-sm text-foreground">{env.name}</p>
              <p className="text-xs text-muted-foreground">Created {formatRelativeTime(env.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
