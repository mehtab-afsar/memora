"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Lightbulb,
  FlaskConical,
  KeyRound,
  Layers,
  Building2,
  ChevronsUpDown,
  Check,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Org = { id: string; name: string };
type Project = { id: string; name: string };

export function DashboardSidebar({
  org,
  project,
  projects,
}: {
  org: Org;
  project: Project;
  projects: Project[];
}) {
  const pathname = usePathname();
  const base = `/${org.id}/${project.id}`;

  const primaryNav = [
    { label: "Overview", href: `${base}/overview`, icon: LayoutDashboard },
    { label: "Memories", href: `${base}/memories`, icon: Database },
    { label: "Experiences", href: `${base}/experiences`, icon: Lightbulb },
    { label: "Playground", href: `${base}/playground`, icon: FlaskConical },
  ];

  const settingsNav = [
    { label: "API Keys", href: `${base}/settings/api-keys`, icon: KeyRound },
    { label: "Environments", href: `${base}/settings/environments`, icon: Layers },
    { label: "Organization", href: `/${org.id}/settings`, icon: Building2 },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <Brain className="size-5 text-primary" strokeWidth={2.25} />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">MEMORA</span>
      </div>

      <div className="px-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="w-full justify-between px-2.5 text-sidebar-foreground hover:bg-sidebar-accent"
              />
            }
          >
            <span className="flex min-w-0 flex-col items-start">
              <span className="w-full truncate text-sm font-medium">{project.name}</span>
              <span className="w-full truncate text-xs text-muted-foreground">{org.name}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  render={<Link href={`/${org.id}/${p.id}/overview`} />}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === project.id && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Settings
          </span>
          {settingsNav.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
