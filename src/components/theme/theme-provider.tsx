"use client";

import * as React from "react";
import { useEffect, useState, createContext, useContext, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme-preference";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  mounted: boolean;
  systemTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Helper to get system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Helper to get stored theme
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage might be blocked
  }
  return "system";
}

// Helper to resolve theme
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
}

// Script to inject into head for SSR flash prevention
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // Initialize on mount
  useEffect(() => {
    const stored = getStoredTheme();
    const system = getSystemTheme();
    const resolved = resolveTheme(stored);

    setThemeState(stored);
    setSystemTheme(system);
    setResolvedTheme(resolved);
    setMounted(true);

    // Apply initial theme
    applyTheme(resolved, disableTransitionOnChange);
  }, [disableTransitionOnChange]);

  // Watch system preference changes
  useEffect(() => {
    if (!enableSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? "dark" : "light";
      setSystemTheme(newSystemTheme);

      if (theme === "system") {
        setResolvedTheme(newSystemTheme);
        applyTheme(newSystemTheme, disableTransitionOnChange);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem, disableTransitionOnChange]);

  const applyTheme = useCallback(
    (resolved: ResolvedTheme, skipTransition: boolean = false) => {
      if (typeof document === "undefined") return;

      const root = document.documentElement;

      // Add transition class for smooth color changes (unless disabled)
      if (!skipTransition) {
        root.classList.add("theme-transitioning");
      }

      if (resolved === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      // Remove transition class after animation completes
      if (!skipTransition) {
        setTimeout(() => {
          root.classList.remove("theme-transitioning");
        }, 300);
      }
    },
    []
  );

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);

      // Persist to localStorage
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {
        // localStorage might be blocked
      }

      // Resolve and apply
      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved, disableTransitionOnChange);
    },
    [applyTheme, disableTransitionOnChange]
  );

  const toggle = useCallback(() => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggle,
    mounted,
    systemTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Export types for external use
export type { ThemeContextValue };
