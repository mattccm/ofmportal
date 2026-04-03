"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { SessionProvider, useSession, signIn } from "next-auth/react";
import {
  attemptAutoLogin,
  isIOSPWA,
  isIndexedDBAvailable,
  getRememberToken,
  hasIndicatorCookie,
} from "@/lib/remember-token";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Check if we're in any standalone/PWA mode (not just iOS)
 * This is more reliable than just checking iOS
 */
function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  // Check iOS standalone
  if (
    "standalone" in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  ) {
    return true;
  }

  // Check display-mode media query (works on all platforms)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // Check fullscreen mode (some PWAs use this)
  if (window.matchMedia("(display-mode: fullscreen)").matches) {
    return true;
  }

  return false;
}

/**
 * iOS PWA Session Handler
 *
 * iOS Safari in standalone (PWA) mode can aggressively clear session cookies
 * when the app is quit and reopened. This component helps detect and handle
 * such scenarios by:
 * 1. Listening for visibility changes and page show events
 * 2. Attempting auto-login with remembered token when session is lost
 * 3. Pre-checking for remember token BEFORE NextAuth declares unauthenticated
 */
function IOSPWASessionHandler({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession();
  const [isAttemptingAutoLogin, setIsAttemptingAutoLogin] = useState(false);
  const autoLoginAttempted = useRef(false);
  const initialCheckDone = useRef(false);

  // Attempt auto-login with remember token
  const tryAutoLogin = useCallback(async (force = false) => {
    // Prevent multiple simultaneous attempts
    if (isAttemptingAutoLogin) {
      console.log("[AuthProvider] Auto-login already in progress");
      return false;
    }

    // Don't retry unless forced (e.g., on resume)
    if (autoLoginAttempted.current && !force) {
      console.log("[AuthProvider] Auto-login already attempted");
      return false;
    }

    // Only attempt if IndexedDB is available
    if (!isIndexedDBAvailable()) {
      console.log("[AuthProvider] IndexedDB not available");
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
        const signInResult = await signIn("credentials", {
          redirect: false,
          email: result.user.email,
          // Special marker that the remember token API has already validated
          password: "__REMEMBER_TOKEN_VALIDATED__",
          rememberUserId: result.user.id,
        });

        if (signInResult?.ok) {
          console.log("[AuthProvider] Session created from remember token");
          // Force a page refresh to ensure session is picked up everywhere
          window.location.reload();
          return true;
        } else {
          console.error("[AuthProvider] signIn failed:", signInResult?.error);
        }
      } else {
        console.log("[AuthProvider] No valid remember token found");
      }
    } catch (error) {
      console.error("[AuthProvider] Auto-login failed:", error);
    } finally {
      setIsAttemptingAutoLogin(false);
    }

    return false;
  }, [isAttemptingAutoLogin]);

  // Handle iOS PWA resume - pageshow event fires when app is resumed
  const handlePageShow = useCallback(async (event: PageTransitionEvent) => {
    console.log("[AuthProvider] pageshow event, persisted:", event.persisted);

    // event.persisted is true when page is restored from bfcache
    if (event.persisted) {
      // Reset the attempt flag to allow retry on resume
      autoLoginAttempted.current = false;

      // Force session refresh when resuming from bfcache
      try {
        const session = await update();
        console.log("[AuthProvider] Session refreshed on resume:", !!session);

        // If no session after refresh, try auto-login
        if (!session?.user) {
          console.log("[AuthProvider] No session after resume, trying auto-login");
          await tryAutoLogin(true);
        }
      } catch {
        // Session update failed - try auto-login
        console.log("[AuthProvider] Session refresh failed on page resume, trying auto-login");
        await tryAutoLogin(true);
      }
    }
  }, [update, tryAutoLogin]);

  // Handle visibility change - when app comes to foreground
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === "visible") {
      console.log("[AuthProvider] App became visible");

      // Delay to let iOS settle, then check session
      setTimeout(async () => {
        try {
          const session = await update();
          console.log("[AuthProvider] Session on visibility:", !!session?.user);

          // If session was lost, try auto-login
          if (!session?.user && isIndexedDBAvailable()) {
            const hasToken = await getRememberToken();
            if (hasToken) {
              console.log("[AuthProvider] Have token but no session, trying auto-login");
              autoLoginAttempted.current = false; // Reset to allow attempt
              await tryAutoLogin(true);
            }
          }
        } catch {
          console.log("[AuthProvider] Session refresh failed on visibility change");
        }
      }, 200);
    }
  }, [update, tryAutoLogin]);

  // CRITICAL: Early check for remember token on initial mount
  // This runs BEFORE waiting for NextAuth to declare unauthenticated
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    const checkTokenEarly = async () => {
      // Quick check: if indicator cookie exists, we likely have a token
      const hasCookieIndicator = hasIndicatorCookie();
      const isPWA = isStandaloneMode() || isIOSPWA();

      console.log("[AuthProvider] Early check - PWA:", isPWA, "Cookie indicator:", hasCookieIndicator);

      // If not in PWA mode and no cookie indicator, skip
      if (!isPWA && !hasCookieIndicator) {
        console.log("[AuthProvider] No PWA mode and no cookie indicator, skipping early check");
        return;
      }

      // If we have the cookie indicator, we likely have a token - check storage
      if (hasCookieIndicator || isPWA) {
        console.log("[AuthProvider] Checking for remember token in storage");

        try {
          const storedToken = await getRememberToken();
          if (storedToken) {
            console.log("[AuthProvider] Found remember token, will attempt auto-login if needed");
          } else {
            console.log("[AuthProvider] No token found in storage");
          }
        } catch (error) {
          console.error("[AuthProvider] Error checking token:", error);
        }
      }
    };

    checkTokenEarly();
  }, []);

  // Reset auto-login flag when becoming authenticated
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (status === "authenticated") {
      console.log("[AuthProvider] Session authenticated");
      autoLoginAttempted.current = false;
    }
  }, [status]);

  // Attempt auto-login when session becomes unauthenticated
  useEffect(() => {
    if (typeof window === "undefined") return;

    // When we detect unauthenticated status, try auto-login
    // Do this for ANY device with a remember token, not just iOS PWA
    if (status === "unauthenticated" && !autoLoginAttempted.current) {
      console.log("[AuthProvider] Status is unauthenticated, checking for remember token");

      // Small delay to ensure status is stable
      const timer = setTimeout(async () => {
        // Check if we have a remember token before attempting
        if (isIndexedDBAvailable()) {
          const hasToken = await getRememberToken();
          if (hasToken) {
            console.log("[AuthProvider] Have remember token, attempting auto-login");
            tryAutoLogin();
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [status, tryAutoLogin]);

  // Set up event listeners for PWA mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone/PWA mode
    const isPWA = isStandaloneMode() || isIOSPWA();

    if (isPWA) {
      console.log("[AuthProvider] Setting up PWA event listeners");

      // Add event listeners for PWA
      window.addEventListener("pageshow", handlePageShow);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Also refresh session on initial load if we're in standalone mode
      // This helps recover sessions after full app quit
      update().catch(() => {
        console.log("[AuthProvider] Initial session refresh failed");
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
