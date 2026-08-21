import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { emailEnabled } from "@/lib/email";
import { listMembers, listPendingInvitations, type Role } from "@/lib/team";
import { TeamPage } from "@/features/team/components/team-page";

export default async function OrgTeamPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const { user, role } = await assertOrgAccess(orgId);

  const [members, invitations] = await Promise.all([
    listMembers(orgId),
    // Only someone who can invite has any use for the pending list, and it
    // contains addresses of people who have not joined — no reason to show it
    // to a member.
    role === "member" ? Promise.resolve([]) : listPendingInvitations(orgId),
  ]);

  return (
    <TeamPage
      orgId={orgId}
      currentUserId={user.id}
      currentRole={role}
      members={members.map((m) => ({ ...m, role: m.role as Role }))}
      invitations={invitations.map((i) => ({ ...i, role: i.role as Role }))}
      emailConfigured={emailEnabled}
    />
  );
}
