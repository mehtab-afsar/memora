import { DashboardSidebar, MobileSidebar } from "@/shell/sidebar";
import { SidebarProvider } from "@/shell/sidebar-provider";
import { DashboardTopbar } from "@/shell/topbar";

type Org = { id: string; name: string };
type Project = { id: string; name: string };
type SessionUser = { id: string; email?: string | null; name?: string | null };
type Environment = { id: string; name: string };

/**
 * The sidebar/topbar chrome shared by every `/[org]/...` dashboard route,
 * project-scoped or org-scoped. Kept as one component so the two layouts
 * that mount it can never drift into visibly different shells.
 */
export function DashboardShell({
  org,
  project,
  projects,
  user,
  environments,
  defaultCollapsed,
  children,
}: {
  org: Org;
  project: Project;
  projects: Project[];
  user: SessionUser;
  environments: Environment[];
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
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
