"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A single reusable gate for every destructive action in the dashboard —
 * removing a member, revoking an invitation, deleting an environment,
 * deleting an organization. Nothing in the app confirmed destructive actions
 * before this; every caller opts into it explicitly rather than firing on
 * click.
 *
 * `confirmText`, when set, requires the exact string to be typed before the
 * confirm button enables — for the handful of actions (org deletion) where a
 * plain click is too easy to fire by accident.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  confirmText,
  isPending,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactElement;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  /** If set, the confirm button stays disabled until the user types this exact string. */
  confirmText?: string;
  isPending?: boolean;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const locked = confirmText !== undefined && typed !== confirmText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange?.(next);
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {confirmText !== undefined && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-dialog-input">
              Type <span className="font-mono font-medium text-foreground">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-dialog-input"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="destructive"
            disabled={locked || isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
