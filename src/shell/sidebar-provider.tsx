"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const COOKIE_NAME = "sidebar-collapsed";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persistCookie(collapsed: boolean) {
  document.cookie = `${COOKIE_NAME}=${collapsed ? "1" : "0"}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * The layout reads the same cookie server-side and passes it in as
 * `defaultCollapsed`, so the sidebar renders at the right width on first
 * paint — no client-only localStorage read, no flash, no hydration
 * mismatch. (The theme system took the long way to this same conclusion —
 * applying that lesson here from the start.)
 */
export function SidebarProvider({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    persistCookie(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      persistCookie(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b") return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
