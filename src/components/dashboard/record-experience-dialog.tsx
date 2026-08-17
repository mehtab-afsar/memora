"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { recordExperienceAction } from "@/app/[org]/[project]/experiences/actions";

export function RecordExperienceDialog({
  orgId,
  projectId,
  environmentId,
}: {
  orgId: string;
  projectId: string;
  environmentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"success" | "failure">("failure");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    const task = String(formData.get("task") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();
    if (!task || !action) {
      toast.error("Task and action are required");
      return;
    }

    startTransition(async () => {
      try {
        await recordExperienceAction(orgId, projectId, environmentId, {
          task,
          action,
          outcome,
          cause: String(formData.get("cause") ?? "").trim() || undefined,
          resolution: String(formData.get("resolution") ?? "").trim() || undefined,
          lesson: String(formData.get("lesson") ?? "").trim() || undefined,
        });
        toast.success("Experience recorded");
        setOpen(false);
      } catch {
        toast.error("Failed to record experience");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-3.5" />
        Record experience
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record an experience</DialogTitle>
            <DialogDescription>
              What was attempted, what happened, and what it means for next time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task">Task</Label>
              <Input id="task" name="task" placeholder="Deploy application" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="action">Action taken</Label>
              <Input id="action" name="action" placeholder="Used Docker configuration A" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as "success" | "failure")}>
                <SelectTrigger size="sm" className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {outcome === "failure" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cause">Cause</Label>
                  <Input id="cause" name="cause" placeholder="Missing DATABASE_URL" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resolution">Resolution (if fixed)</Label>
                  <Input id="resolution" name="resolution" placeholder="Added DATABASE_URL" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lesson">Lesson (optional — generated automatically if left blank)</Label>
              <textarea
                id="lesson"
                name="lesson"
                rows={2}
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
