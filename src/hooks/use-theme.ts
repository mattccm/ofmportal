"use client";

/**
 * The app has one pinned dark theme (see components/theme/theme-provider.tsx).
 * This module is kept for compatibility; it re-exports the pinned hook.
 */
export { useTheme } from "@/components/theme/theme-provider";
export type { Theme, ResolvedTheme } from "@/components/theme/theme-provider";

/** No-op: the theme cannot change. */
export function setTheme(): void {}
