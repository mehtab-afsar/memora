"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail, MoreHorizontal, Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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

function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
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
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [query, setQuery] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null);

  const canInvite = currentRole === "owner" || currentRole === "admin";
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.email.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const outcome = await fn();
      setResult(outcome);
      if (outcome.error) toast.error(outcome.error);
      else if (outcome.notice && !outcome.inviteLink) toast.success(outcome.notice);
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="Team"
        description="Who can reach this organization's projects, memories and API keys."
      />

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
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
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
          <p className="mt-2 text-xs text-muted-foreground">{ROLE_BLURB[inviteRole]}</p>

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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">
            Members <span className="text-muted-foreground">({members.length})</span>
          </h2>
          {members.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="h-8 w-56 pl-8 text-xs"
              />
            </div>
          )}
        </div>
        <ul className="divide-y divide-border">
          {filteredMembers.map((member) => {
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
                  <p className="truncate text-xs text-muted-foreground">
                    {member.name && `${member.email} · `}Joined {relativeTime(member.joinedAt)}
                  </p>
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
                        onClick={() => setPendingRemoval(member)}
                      >
                        {isSelf ? "Leave organization" : "Remove from organization"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
          {filteredMembers.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">No members match &quot;{query}&quot;.</li>
          )}
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
                        onClick={() => setPendingRevoke(invitation)}
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

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title={pendingRemoval?.userId === currentUserId ? "Leave organization?" : "Remove member?"}
        description={
          pendingRemoval?.userId === currentUserId
            ? "You will immediately lose access to this organization's projects, memories and API keys."
            : `${pendingRemoval?.name ?? pendingRemoval?.email} will immediately lose access to this organization.`
        }
        confirmLabel={pendingRemoval?.userId === currentUserId ? "Leave organization" : "Remove member"}
        isPending={isPending}
        onConfirm={() => {
          if (!pendingRemoval) return;
          run(() => removeMemberAction(orgId, pendingRemoval.membershipId));
          setPendingRemoval(null);
        }}
      />

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke invitation?"
        description={`The invitation link sent to ${pendingRevoke?.email} will stop working. You can invite them again later.`}
        confirmLabel="Revoke invitation"
        isPending={isPending}
        onConfirm={() => {
          if (!pendingRevoke) return;
          run(() => revokeInvitationAction(orgId, pendingRevoke.id));
          setPendingRevoke(null);
        }}
      />
    </div>
  );
}
