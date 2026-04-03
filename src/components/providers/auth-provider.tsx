"use client";

import { useEffect, useCallback } from "react";
import { SessionProvider, useSession, signIn } from "next-auth/react";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * iOS PWA Session Handler
 *
 * iOS Safari in standalone (PWA) mode can aggressively clear session cookies
 * when the app is quit and reopened. This component helps detect and handle
 * such scenarios by listening for visibility changes and page show events.
 */
function IOSPWASessionHandler({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession();

  // Handle iOS PWA resume - pageshow event fires when app is resumed
  const handlePageShow = useCallback(async (event: PageTransitionEvent) => {
    // event.persisted is true when page is restored from bfcache
    if (event.persisted) {
      // Force session refresh when resuming from bfcache
      try {
        await update();
      } catch {
        // Session update failed - might need re-auth
        console.log("Session refresh failed on page resume");
      }
    }
  }, [update]);

  // Handle visibility change - when app comes to foreground
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === "visible") {
      // Small delay to let iOS settle
      setTimeout(async () => {
        try {
          await update();
        } catch {
          console.log("Session refresh failed on visibility change");
        }
      }, 100);
    }
  }, [update]);

  useEffect(() => {
    // Only set up handlers on client side
    if (typeof window === "undefined") return;

    // Check if running as iOS PWA (standalone mode)
    const isIOSPWA =
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isIOSPWA) {
      // Add event listeners for iOS PWA
      window.addEventListener("pageshow", handlePageShow);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Also refresh session on initial load if we're in standalone mode
      // This helps recover sessions after full app quit
      update().catch(() => {
        console.log("Initial session refresh failed");
      });

      return () => {
        window.removeEventListener("pageshow", handlePageShow);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [handlePageShow, handleVisibilityChange, update]);

  return <>{children}</>;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // Refetch session every 5 minutes to keep it fresh
      refetchInterval={5 * 60}
      // Refetch session when window regains focus (important for iOS PWA)
      refetchOnWindowFocus={true}
      // Don't refetch when offline to prevent errors
      refetchWhenOffline={false}
    >
      <IOSPWASessionHandler>
        {children}
      </IOSPWASessionHandler>
    </SessionProvider>
  );
}
