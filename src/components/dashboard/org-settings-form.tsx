"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameOrgAction } from "@/app/[org]/settings/actions";

export function OrgSettingsForm({ orgId, name }: { orgId: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    const newName = String(formData.get("name") ?? "").trim();
    if (!newName) return;
    startTransition(async () => {
      try {
        await renameOrgAction(orgId, newName);
        toast.success("Organization renamed");
      } catch {
        toast.error("Failed to rename organization");
      }
    });
  };

  return (
    <form action={handleSubmit} className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" name="name" defaultValue={name} className="max-w-sm" />
      </div>
      <Button type="submit" className="mt-4" disabled={isPending}>
        Save
      </Button>
    </form>
  );
}
