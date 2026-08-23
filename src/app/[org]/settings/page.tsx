import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { listMembers } from "@/lib/team";
import { limitsFor } from "@/lib/plans";
import { OrganizationSettingsPage } from "@/features/organization/components/organization-settings-page";

export default async function OrgSettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const { org, role } = await assertOrgAccess(orgId);

  const members = await listMembers(orgId);

  return (
    <OrganizationSettingsPage
      orgId={orgId}
      orgName={org.name}
      createdAt={org.createdAt}
      memberCount={members.length}
      planLabel={limitsFor(org.plan).label}
      currentRole={role}
    />
  );
}
