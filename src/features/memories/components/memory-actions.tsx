"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { verifyMemoryAction, updateMemoryAction, forgetMemoryAction } from "@/features/memories/actions/memory-detail-actions";

export function MemoryActions({
  orgId,
  projectId,
  memoryId,
  content,
  confidence,
  importance,
}: {
  orgId: string;
  projectId: string;
  memoryId: string;
  content: string;
  confidence: number;
  importance: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);

  const handleVerify = () => {
    startTransition(async () => {
      try {
        const result = await verifyMemoryAction(orgId, projectId, memoryId);
        if (result) {
          toast.success(`Re-verified — confidence now ${Math.round(result.memory.confidence * 100)}%`, {
            description: result.reasoning,
          });
        }
      } catch {
        toast.error("Verify failed");
      }
    });
  };

  const handleEditSubmit = (formData: FormData) => {
    startTransition(async () => {
      const newContent = String(formData.get("content") ?? content);
      const newConfidence = Number(formData.get("confidence") ?? confidence);
      const newImportance = Number(formData.get("importance") ?? importance);
      try {
        await updateMemoryAction(orgId, projectId, memoryId, {
          content: newContent !== content ? newContent : undefined,
          confidence: newConfidence,
          importance: newImportance,
        });
        toast.success("Memory updated");
        setEditOpen(false);
      } catch {
        toast.error("Update failed");
      }
    });
  };

  const handleForget = () => {
    startTransition(async () => {
      try {
        await forgetMemoryAction(orgId, projectId, memoryId);
      } catch {
        toast.error("Forget failed");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleVerify} disabled={isPending}>
        <ShieldCheck className="size-3.5" />
        Verify
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <Pencil className="size-3.5" />
          Edit
        </DialogTrigger>
        <DialogContent>
          <form action={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit memory</DialogTitle>
              <DialogDescription>Manual corrections are recorded as evidence.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content">Content</Label>
                <textarea
                  id="content"
                  name="content"
                  defaultValue={content}
                  rows={3}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confidence">Confidence</Label>
                  <Input id="confidence" name="confidence" type="number" min={0} max={1} step={0.01} defaultValue={confidence} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="importance">Importance</Label>
                  <Input id="importance" name="importance" type="number" min={0} max={1} step={0.01} defaultValue={importance} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={forgetOpen} onOpenChange={setForgetOpen}>
        <DialogTrigger render={<Button variant="destructive" size="sm" className="gap-1.5" />}>
          <Trash2 className="size-3.5" />
          Forget
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forget this memory?</DialogTitle>
            <DialogDescription>
              This archives the memory — it stops appearing in recall results but its evidence trail is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleForget} disabled={isPending}>
              Forget memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
