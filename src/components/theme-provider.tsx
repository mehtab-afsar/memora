"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

// useLayoutEffect warns when it runs during SSR (it can't — there's no
// paint to run "before" on the server). This project's whole page tree gets
// server-rendered once for the initial HTML even though ThemeProvider is a
// Client Component, so that warning is real, not hypothetical — fall back
// to a no-op-on-server, real-layout-effect-on-client wrapper (the standard
// pattern several major libraries use for exactly this).
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function resolveSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Lazy useState initializer (not an on-mount effect that calls setState) —
 * localStorage is a one-time read, not a subscription, so there's no
 * external system to "sync" via effect. Server render always sees no
 * `window` and returns the default.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default.
  }
  return "light";
}

function applyThemeToDocument(theme: Theme, disableTransition: boolean) {
  const resolved = theme === "system" ? resolveSystemTheme() : theme;
  const root = document.documentElement;

  let restoreTransitions: (() => void) | null = null;
  if (disableTransition) {
    const style = document.createElement("style");
    style.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}"));
    document.head.appendChild(style);
    restoreTransitions = () => {
      // Force a reflow so the browser applies the disabled state before removing it.
      void window.getComputedStyle(document.body).transition;
      setTimeout(() => document.head.removeChild(style), 0);
    };
  }

  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  restoreTransitions?.();
}

/**
 * Hand-rolled — not next-themes. Both next-themes' own no-flash mechanism
 * and an earlier version of this file tried to solve "no flash of the wrong
 * theme" with a <script> that runs before hydration (via a raw tag, and
 * then via next/script strategy="beforeInteractive"). Neither survives
 * React 19: any script that has to exist in the initial HTML to run before
 * hydration gets "encountered" during hydration reconciliation and
 * triggers its new script-tag warning — that's true regardless of how the
 * script is authored, so there's no version of that technique that works
 * anymore. This avoids the flash a different way: no script tag at all.
 * useLayoutEffect runs synchronously before the browser paints, so the
 * theme class is set before the user ever sees the wrong one — same visual
 * result, zero script tags, so this warning class can't apply.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useIsomorphicLayoutEffect(() => {
    applyThemeToDocument(theme, true);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeToDocument("system", false);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — theme still applies for this session via React state.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
