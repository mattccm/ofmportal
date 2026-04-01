"use client";

import * as React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "dropdown" | "switcher";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

/**
 * Theme toggle button with multiple variants
 * - icon: Simple toggle between light/dark
 * - dropdown: Dropdown menu with light/dark/system options
 * - switcher: Horizontal segmented control
 */
export function ThemeToggle({
  className,
  variant = "dropdown",
  size = "default",
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggle, mounted } = useTheme();

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "rounded-xl transition-all duration-200",
          size === "sm" && "h-8 w-8",
          size === "default" && "h-10 w-10",
          size === "lg" && "h-12 w-12",
          className
        )}
        disabled
      >
        <div className="h-5 w-5 animate-pulse bg-muted rounded-full" />
      </Button>
    );
  }

  // Simple icon toggle
  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className={cn(
          "rounded-xl transition-all duration-200 hover:bg-accent active:scale-95",
          size === "sm" && "h-8 w-8",
          size === "default" && "h-10 w-10",
          size === "lg" && "h-12 w-12",
          className
        )}
        aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  // Horizontal switcher
  if (variant === "switcher") {
    return (
      <ThemeSwitcher theme={theme} setTheme={setTheme} className={className} />
    );
  }

  // Dropdown menu (default)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "default" : "icon"}
          className={cn(
            "rounded-xl transition-all duration-200 hover:bg-accent active:scale-95",
            !showLabel && size === "sm" && "h-8 w-8",
            !showLabel && size === "default" && "h-10 w-10",
            !showLabel && size === "lg" && "h-12 w-12",
            showLabel && "gap-2 px-3",
            className
          )}
          aria-label="Select theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
          {showLabel && (
            <span className="capitalize">{theme}</span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(
            "gap-3 cursor-pointer",
            theme === "light" && "bg-accent"
          )}
        >
          <Sun className="h-4 w-4" />
          Light
          {theme === "light" && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(
            "gap-3 cursor-pointer",
            theme === "dark" && "bg-accent"
          )}
        >
          <Moon className="h-4 w-4" />
          Dark
          {theme === "dark" && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(
            "gap-3 cursor-pointer",
            theme === "system" && "bg-accent"
          )}
        >
          <Monitor className="h-4 w-4" />
          System
          {theme === "system" && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  className?: string;
}

/**
 * Horizontal segmented theme switcher
 */
export function ThemeSwitcher({
  theme,
  setTheme,
  className,
}: ThemeSwitcherProps) {
  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-4 w-4" />, label: "System" },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-muted/50 p-1",
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
            theme === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Inline theme toggle for dropdown menus
 */
export function ThemeToggleInline({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  if (!mounted) {
    return null;
  }

  const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-4 w-4" />, label: "System" },
  ];

  return (
    <div className={cn("p-2", className)}>
      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Theme
      </p>
      <div className="grid grid-cols-3 gap-1 mt-1">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg py-2 px-2 text-xs transition-all",
              theme === t.value
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Simple theme toggle button for menus
 */
export function ThemeToggleMenuItem({
  className,
  onSelect,
}: {
  className?: string;
  onSelect?: () => void;
}) {
  const { resolvedTheme, toggle, mounted } = useTheme();

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={() => {
        toggle();
        onSelect?.();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        "hover:bg-muted focus:bg-muted outline-none cursor-pointer",
        className
      )}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span>
        {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}

export default ThemeToggle;
