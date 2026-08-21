import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/session";
import { getMembershipForUser, getFirstProjectForOrg } from "@/lib/org";
import { OrganizationSettingsPage } from "@/features/organization/components/organization-settings-page";

export default async function OrgSettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const user = await requireUser();

  const membership = await getMembershipForUser(user.id, orgId);
  if (!membership) notFound();

  const project = await getFirstProjectForOrg(orgId);

  return (
    <OrganizationSettingsPage
      orgId={orgId}
      orgName={membership.org.name}
      dashboardHref={project ? `/${orgId}/${project.id}/overview` : null}
    />
  );
}
