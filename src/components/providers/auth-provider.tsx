"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { SessionProvider, useSession, signIn } from "next-auth/react";
import {
  attemptAutoLogin,
  isIOSPWA,
  isIndexedDBAvailable,
} from "@/lib/remember-token";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * iOS PWA Session Handler
 *
 * iOS Safari in standalone (PWA) mode can aggressively clear session cookies
 * when the app is quit and reopened. This component helps detect and handle
 * such scenarios by:
 * 1. Listening for visibility changes and page show events
 * 2. Attempting auto-login with remembered token when session is lost
 */
function IOSPWASessionHandler({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession();
  const [isAttemptingAutoLogin, setIsAttemptingAutoLogin] = useState(false);
  const autoLoginAttempted = useRef(false);

  // Attempt auto-login with remember token
  const tryAutoLogin = useCallback(async () => {
    // Prevent multiple simultaneous attempts
    if (isAttemptingAutoLogin || autoLoginAttempted.current) {
      return false;
    }

    // Only attempt if we're definitely unauthenticated
    if (status !== "unauthenticated") {
      return false;
    }

    // Only attempt if IndexedDB is available
    if (!isIndexedDBAvailable()) {
      return false;
    }

    setIsAttemptingAutoLogin(true);
    autoLoginAttempted.current = true;

    try {
      console.log("[AuthProvider] Attempting auto-login with remember token");
      const result = await attemptAutoLogin();

      if (result) {
        console.log("[AuthProvider] Auto-login successful, signing in");
        // Use the credentials provider with a special "remember" flow
        // This creates a new session from the validated token
        await signIn("credentials", {
          redirect: false,
          email: result.user.email,
          // Special marker that the remember token API has already validated
          password: "__REMEMBER_TOKEN_VALIDATED__",
          rememberUserId: result.user.id,
        });
        return true;
      }
    } catch (error) {
      console.error("[AuthProvider] Auto-login failed:", error);
    } finally {
      setIsAttemptingAutoLogin(false);
    }

    return false;
  }, [status, isAttemptingAutoLogin]);

  // Handle iOS PWA resume - pageshow event fires when app is resumed
  const handlePageShow = useCallback(async (event: PageTransitionEvent) => {
    // event.persisted is true when page is restored from bfcache
    if (event.persisted) {
      // Force session refresh when resuming from bfcache
      try {
        await update();
      } catch {
        // Session update failed - try auto-login
        console.log("Session refresh failed on page resume, trying auto-login");
        await tryAutoLogin();
      }
    }
  }, [update, tryAutoLogin]);

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

  // Initial mount: check session and attempt auto-login if needed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Reset auto-login flag when status changes to allow retry
    if (status === "authenticated") {
      autoLoginAttempted.current = false;
    }
  }, [status]);

  // Attempt auto-login when session becomes unauthenticated in PWA mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only run in PWA mode
    if (!isIOSPWA()) return;

    // When we detect unauthenticated status, try auto-login
    if (status === "unauthenticated" && !autoLoginAttempted.current) {
      tryAutoLogin();
    }
  }, [status, tryAutoLogin]);

  useEffect(() => {
    // Only set up handlers on client side
    if (typeof window === "undefined") return;

    // Check if running as iOS PWA (standalone mode)
    const isPWA = isIOSPWA();

    if (isPWA) {
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
