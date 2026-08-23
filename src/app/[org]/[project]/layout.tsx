import { cookies } from "next/headers";
import { assertProjectAccess } from "@/features/auth/lib/dashboard-auth";
import { getProjectsForOrg, getEnvironmentsForProject } from "@/lib/org";
import { DashboardShell } from "@/shell/dashboard-shell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgId, project: projectId } = await params;
  const { user, org, project } = await assertProjectAccess(orgId, projectId);

  const [projects, environments, cookieStore] = await Promise.all([
    getProjectsForOrg(orgId),
    getEnvironmentsForProject(project.id),
    cookies(),
  ]);
  // Collapsed by default — a pin toggle (Cmd/Ctrl+B) is what opts a user into
  // the persisted, fully-expanded state, not the other way around.
  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value !== "0";

  return (
    <DashboardShell
      org={org}
      project={project}
      projects={projects}
      user={user}
      environments={environments}
      defaultCollapsed={defaultCollapsed}
    >
      {children}
    </DashboardShell>
  );
}
