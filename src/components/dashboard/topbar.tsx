"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop, LogOut, User as UserIcon, Layers, Check } from "lucide-react";
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
import { signOutAction } from "@/lib/auth-actions";

type Environment = { id: string; name: string };
type SessionUser = { id: string; email?: string | null; name?: string | null };

export function DashboardTopbar({
  environments,
  user,
}: {
  environments: Environment[];
  user: SessionUser;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <Suspense fallback={<div className="h-8 w-32 animate-pulse rounded-md bg-muted" />}>
          <EnvironmentSwitcher environments={environments} />
        </Suspense>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function EnvironmentSwitcher({ environments }: { environments: Environment[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentId = searchParams.get("env") ?? environments[0]?.id;
  const current = environments.find((e) => e.id === currentId) ?? environments[0];

  if (!current) return null;

  const hrefFor = (envId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("env", envId);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2 font-mono text-xs" />}>
        <Layers className="size-3.5 text-muted-foreground" />
        {current.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environment</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {environments.map((env) => (
            <DropdownMenuItem
              key={env.id}
              render={<Link href={hrefFor(env.id)} />}
              className="flex items-center justify-between font-mono text-xs"
            >
              {env.name}
              {env.id === current.id && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: string; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Laptop, label: "System" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Toggle theme" />}>
        <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)} className="justify-between">
            <span className="flex items-center gap-2">
              <opt.icon className="size-3.5" />
              {opt.label}
            </span>
            {theme === opt.value && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const label = user.name || user.email || "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}>
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
  );
}
