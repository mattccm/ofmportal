"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cleanupCreatorContextGlobals, clearCreatorContextCache } from "./use-creator-context";

/**
 * Hook that cleans up global caches and connections on route change
 *
 * This helps prevent memory leaks and stale state from persisting
 * across navigation, which can cause cascading failures.
 */
export function useRouteCleanup() {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip on initial mount
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname;
      return;
    }

    // Only clean up if the path actually changed
    if (previousPathnameRef.current !== pathname) {
      // Clear caches to prevent stale data
      clearCreatorContextCache();

      // Update ref
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Clean up on unmount (e.g., logout)
  useEffect(() => {
    return () => {
      cleanupCreatorContextGlobals();
    };
  }, []);
}

/**
 * Hook that performs full cleanup of all global state
 * Use this when the user logs out or on critical errors
 */
export function useFullCleanup() {
  return {
    cleanupAll: cleanupCreatorContextGlobals,
    clearCaches: clearCreatorContextCache,
  };
}
