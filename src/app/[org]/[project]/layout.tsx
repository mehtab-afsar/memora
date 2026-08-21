import { cookies } from "next/headers";
import { assertProjectAccess } from "@/lib/dashboard-auth";
import { getProjectsForOrg, getEnvironmentsForProject } from "@/lib/org";
import { DashboardSidebar, MobileSidebar } from "@/components/dashboard/sidebar";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import { DashboardTopbar } from "@/components/dashboard/topbar";

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
  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value === "1";

  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar org={org} project={project} projects={projects} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar
            environments={environments}
            mobileNav={<MobileSidebar org={org} project={project} projects={projects} user={user} />}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
