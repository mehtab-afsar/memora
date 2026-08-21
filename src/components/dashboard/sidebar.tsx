"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Lightbulb,
  FlaskConical,
  KeyRound,
  Layers,
  Building2,
  Activity,
  ChevronsUpDown,
  Check,
  Menu,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { useSidebar } from "@/components/dashboard/sidebar-provider";
import { signOutAction } from "@/lib/auth-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Org = { id: string; name: string };
type Project = { id: string; name: string };
type SessionUser = { id: string; email?: string | null; name?: string | null };

const SIDEBAR_ID = "dashboard-sidebar";
// The collapsed rail's width — a little wider than the bare minimum an icon
// needs so the project switcher and account avatar in the bottom block have
// breathing room too, not just the nav icons.
const RAIL_WIDTH = "w-[72px]";
// Shared transition so every animated piece (rail width, label fades) moves
// in lockstep — mismatched durations are what make a "smooth" interaction
// start to feel off even when each piece individually animates fine.
const TRANSITION = "transition-all duration-200 ease-in-out motion-reduce:transition-none";

function getNavSections(org: Org, project: Project) {
  const base = `/${org.id}/${project.id}`;
  return {
    primaryNav: [
      { label: "Overview", href: `${base}/overview`, icon: LayoutDashboard },
      { label: "Memories", href: `${base}/memories`, icon: Database },
      { label: "Experiences", href: `${base}/experiences`, icon: Lightbulb },
      { label: "Playground", href: `${base}/playground`, icon: FlaskConical },
    ],
    settingsNav: [
      { label: "API Keys", href: `${base}/settings/api-keys`, icon: KeyRound },
      { label: "Environments", href: `${base}/settings/environments`, icon: Layers },
      { label: "Usage", href: `${base}/settings/usage`, icon: Activity },
      { label: "Organization", href: `/${org.id}/settings`, icon: Building2 },
    ],
  };
}

/** Desktop rail — collapses to icon-only via SidebarProvider's persisted state. */
export function DashboardSidebar({
  org,
  project,
  projects,
  user,
}: {
  org: Org;
  project: Project;
  projects: Project[];
  user: SessionUser;
}) {
  const { collapsed } = useSidebar();
  const [peeking, setPeeking] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  function handleMouseEnter() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (collapsed) setPeeking(true);
  }

  function handleMouseLeave() {
    // A short delay absorbs the cursor briefly crossing the border on its
    // way to a nav item — without it, moving diagonally toward a link near
    // the rail's edge can flicker the sidebar shut mid-click.
    closeTimeoutRef.current = setTimeout(() => setPeeking(false), 150);
  }

  // `collapsed` is the persisted, pinned preference (drives layout width and
  // the cookie). `expanded` is what's actually drawn right now — pinned open,
  // or peeking open on hover while pinned collapsed. Keeping these separate
  // means the peek never has to touch the persisted state.
  //
  // Every child below renders the SAME elements in both states and only
  // animates their size/opacity via CSS — nothing here conditionally renders
  // different content for collapsed vs. expanded. That distinction is the
  // fix for the "sidebar keeps changing" report: swapping the project
  // switcher between a single-letter avatar and its full name+org text (or
  // mounting/unmounting tooltips) on every hover is what read as content
  // randomly changing, and CSS transitions can only look smooth on an
  // element that persists across the state change.
  const expanded = !collapsed || peeking;

  return (
    <div className={cn("relative hidden shrink-0 md:block", TRANSITION, collapsed ? RAIL_WIDTH : "w-64")}>
      <aside
        id={SIDEBAR_ID}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
          TRANSITION,
          collapsed && "absolute inset-y-0 left-0 z-40",
          expanded ? "w-64" : RAIL_WIDTH,
          collapsed && peeking && "shadow-xl"
        )}
      >
        <SidebarHeader expanded={expanded} />
        <SidebarNavSections org={org} project={project} expanded={expanded} />
        <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-3">
          <ProjectSwitcher org={org} project={project} projects={projects} expanded={expanded} />
          <SidebarUserMenu user={user} expanded={expanded} />
        </div>
      </aside>
    </div>
  );
}

/** Mobile drawer — the sidebar's `hidden md:flex` means it doesn't exist below md at all, so this is the only nav on small screens. Always renders expanded; collapsing a full-width overlay drawer has no purpose. */
export function MobileSidebar({
  org,
  project,
  projects,
  user,
}: {
  org: Org;
  project: Project;
  projects: Project[];
  user: SessionUser;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" />}
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">MEMORA dashboard navigation</SheetDescription>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-2 px-5">
            <BrandMark className="size-8 shrink-0 text-primary" />
            <div className="flex flex-1 items-center justify-start pl-1 overflow-hidden">
              <span className="truncate text-xl leading-none font-light tracking-wider text-foreground">Memora</span>
            </div>
          </div>
          <SidebarNavSections org={org} project={project} expanded />
          <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-3">
            <ProjectSwitcher org={org} project={project} projects={projects} expanded />
            <SidebarUserMenu user={user} expanded />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SidebarHeader({ expanded }: { expanded: boolean }) {
  return (
    <div className="flex h-16 items-center gap-2 px-3">
      {/* The mark sits in a fixed slot and never moves — only the label next
          to it shifts within the remaining space. Centering the pair as one
          group made the icon itself drift left/right as the label's width
          animated in and out, which read as the mark moving on its own. */}
      <BrandMark className="size-8 shrink-0 text-primary" />
      <div className="flex flex-1 items-center justify-start pl-1 overflow-hidden">
        <span
          className={cn(
            "whitespace-nowrap text-xl leading-none font-light tracking-wider text-sidebar-foreground",
            TRANSITION,
            expanded ? "max-w-[150px] opacity-100" : "max-w-0 opacity-0"
          )}
        >
          Memora
        </span>
      </div>
    </div>
  );
}

function ProjectSwitcher({
  org,
  project,
  projects,
  expanded,
}: {
  org: Org;
  project: Project;
  projects: Project[];
  expanded: boolean;
}) {
  return (
    <Tooltip disabled={expanded}>
      <DropdownMenu>
        {/* Base UI merges each trigger's own handlers onto whatever's inside
            via `render`, so nesting Tooltip's trigger around the dropdown's
            trigger (rather than picking one or the other) is what lets a
            single button be both at once. The tooltip itself stays mounted
            at every width (only `disabled` toggles) so expanding never has
            to mount anything new — it'd be pure noise once the name is
            already visible, so it's turned off rather than removed. */}
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
                />
              }
            />
          }
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-medium">
            {project.name.charAt(0).toUpperCase()}
          </span>
          <span
            className={cn(
              "flex min-w-0 flex-col items-start overflow-hidden",
              TRANSITION,
              expanded ? "max-w-[150px] flex-1 opacity-100" : "max-w-0 opacity-0"
            )}
          >
            <span className="w-full truncate text-sm font-medium">{project.name}</span>
            <span className="w-full truncate text-xs text-muted-foreground">{org.name}</span>
          </span>
          <ChevronsUpDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              TRANSITION,
              expanded ? "max-w-4 opacity-100" : "max-w-0 opacity-0"
            )}
          />
        </TooltipTrigger>
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
      <TooltipContent side="right">{project.name}</TooltipContent>
    </Tooltip>
  );
}

function SidebarUserMenu({ user, expanded }: { user: SessionUser; expanded: boolean }) {
  const label = user.name || user.email || "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <Tooltip disabled={expanded}>
      <DropdownMenu>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
                  aria-label={expanded ? undefined : "Account menu"}
                />
              }
            />
          }
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initial}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden truncate text-left text-sm text-sidebar-foreground",
              TRANSITION,
              expanded ? "max-w-[150px] opacity-100" : "max-w-0 opacity-0"
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
              <UserIcon className="size-3.5" />
              <span className="truncate">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              void signOutAction();
            }}
          >
            <LogOut className="size-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarSectionLabel({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "overflow-hidden whitespace-nowrap px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
        TRANSITION,
        expanded ? "max-h-4 opacity-100" : "max-h-0 opacity-0"
      )}
    >
      {children}
    </span>
  );
}

function SidebarNavSections({
  org,
  project,
  expanded,
}: {
  org: Org;
  project: Project;
  expanded: boolean;
}) {
  const pathname = usePathname();
  const { primaryNav, settingsNav } = getNavSections(org, project);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2 pb-5">
      <div className="flex flex-col gap-0.5">
        <SidebarSectionLabel expanded={expanded}>General</SidebarSectionLabel>
        {primaryNav.map((item) => (
          <SidebarLink key={item.href} {...item} active={isActive(item.href)} expanded={expanded} />
        ))}
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-0.5">
        <SidebarSectionLabel expanded={expanded}>Settings</SidebarSectionLabel>
        {settingsNav.map((item) => (
          <SidebarLink key={item.href} {...item} active={isActive(item.href)} expanded={expanded} />
        ))}
      </div>
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  expanded,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  expanded: boolean;
}) {
  return (
    <Tooltip disabled={expanded}>
      <TooltipTrigger
        render={
          <Link
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          />
        }
      >
        <Icon className="size-4 shrink-0" />
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap",
            TRANSITION,
            expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
          )}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
