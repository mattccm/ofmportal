"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme-preference";

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

// Store for syncing across components
let listeners: Array<() => void> = [];
let currentTheme: Theme = "system";
let currentResolvedTheme: ResolvedTheme = "light";

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getThemeSnapshot(): Theme {
  return currentTheme;
}

function getResolvedThemeSnapshot(): ResolvedTheme {
  return currentResolvedTheme;
}

function getServerSnapshot(): Theme {
  return "system";
}

function getServerResolvedSnapshot(): ResolvedTheme {
  return "light";
}

// Initialize on client
if (typeof window !== "undefined") {
  currentTheme = getStoredTheme();
  currentResolvedTheme = resolveTheme(currentTheme);
}

export function setTheme(newTheme: Theme) {
  currentTheme = newTheme;
  currentResolvedTheme = resolveTheme(newTheme);

  // Persist to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  } catch {
    // localStorage might be blocked
  }

  // Apply to document
  applyTheme(currentResolvedTheme);

  emitChange();
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Add transition class for smooth color changes
  root.classList.add("theme-transitioning");

  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Remove transition class after animation completes
  setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, 300);
}

/**
 * Hook to access and control the current theme
 */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerSnapshot
  );

  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getResolvedThemeSnapshot,
    getServerResolvedSnapshot
  );

  const [mounted, setMounted] = useState(false);

  // Handle system preference changes
  useEffect(() => {
    setMounted(true);

    // Initialize theme on mount
    const stored = getStoredTheme();
    if (stored !== currentTheme || resolveTheme(stored) !== currentResolvedTheme) {
      currentTheme = stored;
      currentResolvedTheme = resolveTheme(stored);
      applyTheme(currentResolvedTheme);
      emitChange();
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (currentTheme === "system") {
        currentResolvedTheme = getSystemTheme();
        applyTheme(currentResolvedTheme);
        emitChange();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggle = useCallback(() => {
    const newTheme = currentResolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, []);

  const setThemeMode = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme: setThemeMode,
    toggle,
    mounted,
    systemTheme: mounted ? getSystemTheme() : "light",
  };
}

/**
 * Hook to watch system preference
 */
export function useSystemTheme() {
  const [systemTheme, setSystemThemeState] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setSystemThemeState(getSystemTheme());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemThemeState(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return systemTheme;
}
