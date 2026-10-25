"use client";

import * as React from "react";
import { Moon } from "lucide-react";
import type { Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

/**
 * CCM Portal uses one dark theme, so there is nothing to toggle. These exports
 * keep their old signatures so existing imports compile; the toggles render
 * nothing and the settings switcher explains the single theme instead.
 */

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "dropdown" | "switcher";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export function ThemeToggle(_props: ThemeToggleProps) {
  return null;
}

interface ThemeSwitcherProps {
  theme?: Theme;
  setTheme?: (theme: Theme) => void;
  className?: string;
}

/** Settings row: states the one theme instead of offering a choice. */
export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  return (
    <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Moon className="h-4 w-4 text-icon" aria-hidden="true" />
      CCM Portal uses one dark theme.
    </p>
  );
}

export function ThemeToggleInline(_props: { className?: string }) {
  return null;
}

export function ThemeToggleMenuItem(_props: { className?: string; onSelect?: () => void }) {
  return null;
}

export default ThemeToggle;
