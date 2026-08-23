import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { assertOrgAccess } from "@/features/auth/lib/dashboard-auth";
import { getProjectsForOrg } from "@/lib/org";
import { DashboardShell } from "@/shell/dashboard-shell";

export default async function OrgSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: orgId } = await params;
  const { user, org } = await assertOrgAccess(orgId);

  const [projects, cookieStore] = await Promise.all([getProjectsForOrg(orgId), cookies()]);
  // Team/Billing/Organization are org-scoped, not project-scoped, but the
  // shared sidebar's project switcher and "General" nav links still need a
  // project to point at — every org has at least one (no delete-project flow
  // exists), so the first is a safe, stable default.
  const project = projects[0];
  if (!project) notFound();

  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value !== "0";

  return (
    <DashboardShell
      org={org}
      project={project}
      projects={projects}
      user={user}
      environments={[]}
      defaultCollapsed={defaultCollapsed}
    >
      {children}
    </DashboardShell>
  );
}
