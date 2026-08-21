"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail, MoreHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  type ActionResult,
} from "@/features/team/actions/team-actions";
import type { Role } from "@/lib/team";

type Member = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  joinedAt: Date;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
  sentCount: number;
  invitedByEmail: string | null;
};

const ROLE_BLURB: Record<Role, string> = {
  owner: "Full access, including billing and deleting the organization.",
  admin: "Manages the team and projects. No access to billing.",
  member: "Uses the product. Cannot change the team.",
};

function RoleBadge({ role }: { role: Role }) {
  const tone =
    role === "owner"
      ? "border-primary/30 bg-primary/10 text-primary"
      : role === "admin"
        ? "border-border bg-muted text-foreground"
        : "border-border bg-transparent text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${tone}`}>{role}</span>
  );
}

/**
 * Shown when an invitation was created but could not be emailed, which is the
 * normal case until an email provider is configured. The invitation is real and
 * the link works — this is how it gets to the person.
 */
function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{link}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function TeamPage({
  orgId,
  currentUserId,
  currentRole,
  members,
  invitations,
  emailConfigured,
}: {
  orgId: string;
  currentUserId: string;
  currentRole: Role;
  members: Member[];
  invitations: Invitation[];
  emailConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});

  const canInvite = currentRole === "owner" || currentRole === "admin";
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const outcome = await fn();
      setResult(outcome);
      if (outcome.error) toast.error(outcome.error);
      else if (outcome.notice && !outcome.inviteLink) toast.success(outcome.notice);
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who can reach this organization&apos;s projects, memories and API keys.
        </p>
      </div>

      {canInvite && (
        <form
          action={(formData) => run(() => inviteMemberAction(orgId, undefined, formData))}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="invite-email">Invite by email</Label>
              <Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="member"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                {currentRole === "owner" && <option value="owner">Owner</option>}
              </select>
            </div>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <UserPlus className="size-3.5" />
              Send invite
            </Button>
          </div>

          {!emailConfigured && (
            <p className="mt-3 text-xs text-muted-foreground">
              No email provider is configured, so invitations aren&apos;t sent automatically — you&apos;ll
              get a link to pass on. Set <code className="font-mono">RESEND_API_KEY</code> and{" "}
              <code className="font-mono">EMAIL_FROM</code> to send them directly.
            </p>
          )}
          {result.inviteLink && <InviteLink link={result.inviteLink} />}
          {result.notice && result.inviteLink && (
            <p className="mt-2 text-xs text-muted-foreground">{result.notice}</p>
          )}
        </form>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">
            Members <span className="text-muted-foreground">({members.length})</span>
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isLastOwner = member.role === "owner" && ownerCount === 1;
            const mayManage =
              (currentRole === "owner" || (currentRole === "admin" && member.role !== "owner")) &&
              !isLastOwner;

            return (
              <li key={member.membershipId} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {member.name ?? member.email}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">you</span>}
                  </p>
                  {member.name && (
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                <RoleBadge role={member.role} />
                {mayManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="sm" disabled={isPending} />}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["owner", "admin", "member"] as Role[])
                        .filter((role) => role !== member.role)
                        .filter((role) => role !== "owner" || currentRole === "owner")
                        .map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => run(() => changeRoleAction(orgId, member.membershipId, role))}
                          >
                            Make {role}
                          </DropdownMenuItem>
                        ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => run(() => removeMemberAction(orgId, member.membershipId))}
                      >
                        {isSelf ? "Leave organization" : "Remove from organization"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {ROLE_BLURB.owner} Admins manage the team; members use the product.
        </p>
      </div>

      {invitations.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium text-foreground">
              Pending invitations <span className="text-muted-foreground">({invitations.length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-5 py-3">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{invitation.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Expires {invitation.expiresAt.toLocaleDateString()}
                    {invitation.sentCount > 1 && ` · sent ${invitation.sentCount} times`}
                  </p>
                </div>
                <RoleBadge role={invitation.role} />
                {canInvite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="sm" disabled={isPending} />}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => run(() => resendInvitationAction(orgId, invitation.id))}
                      >
                        Resend
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => run(() => revokeInvitationAction(orgId, invitation.id))}
                      >
                        Revoke
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
