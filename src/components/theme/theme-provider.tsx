"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * CCM Portal has one theme: the dark Title Wall world. The root layout renders
 * <html class="dark">, and this provider keeps it there. The context API is kept
 * (theme, resolvedTheme, setTheme, toggle) so existing callers keep compiling;
 * every value resolves to "dark" and the setters do nothing.
 */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  mounted: boolean;
  systemTheme: ResolvedTheme;
}

const noop = () => {};
const emptySubscribe = () => () => {};

const PINNED: ThemeContextValue = {
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: noop,
  toggle: noop,
  mounted: false,
  systemTheme: "dark",
};

const ThemeContext = createContext<ThemeContextValue>(PINNED);

/** Kept for callers that still render it; the class is already server-rendered. */
export function ThemeScript() {
  return null;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Ignored: the theme is pinned to dark. Kept for API compatibility. */
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  forcedTheme?: Theme;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Keep the class pinned even if an old script or extension removes it, and
  // forget any light preference saved by earlier versions.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    try {
      localStorage.removeItem("theme-preference");
    } catch {
      // storage may be blocked
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ ...PINNED, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export type { ThemeContextValue };
