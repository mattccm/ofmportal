"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { getCreatorSession, clearCreatorSession, hasCreatorSessionIndicator, setSignedOutFlag, hasSignedOutFlag, storeCreatorSession } from "@/lib/remember-token";
import { setCreatorCookie, clearCreatorCookie } from "@/lib/creator-cookies";
import { CreatorChrome } from "@/components/portal/creator-chrome";
import { isStandalone } from "@/components/portal/phone-setup";

/** The schema default; a creator still on it gets their browser's time zone saved */
const DEFAULT_CREATOR_TIMEZONE = "America/New_York";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Clear the creator session stored on this device (IndexedDB, localStorage, cookies)
 */
async function clearLocalCreatorSession(): Promise<void> {
  // Clear IndexedDB (most important for iOS PWA)
  try {
    await clearCreatorSession();
  } catch (error) {
    console.error("Error clearing IndexedDB:", error);
  }

  // Clear local storage
  localStorage.removeItem("creatorToken");
  localStorage.removeItem("creatorId");
  localStorage.removeItem("creatorName");
  localStorage.removeItem("creatorEmail");
  localStorage.removeItem("creatorAvatar");
  localStorage.removeItem("creatorOnboardingComplete");

  // Clear cookies too
  clearCreatorCookie("creatorToken");
  clearCreatorCookie("creatorId");
  clearCreatorCookie("creatorName");
  clearCreatorCookie("creatorEmail");
}

/**
 * Check if we're in any standalone/PWA mode
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

  return false;
}

function CreatorLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionCheckInProgress = useRef(false);
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null>(null);
  // Every moment on the creator's screens reads in their own time zone
  const [viewerTz, setViewerTz] = useState<string>("UTC");

  // Helper to get cookie value
  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }, []);

  // Core function to check and restore session from all storage mechanisms
  const checkAndRestoreSession = useCallback(async (source: string): Promise<{ token: string; creatorId: string; creatorName: string | null; creatorEmail: string | null; creatorAvatar: string | null } | null> => {
    // Prevent concurrent checks
    if (sessionCheckInProgress.current) {
      return null;
    }

    // Check if user intentionally signed out
    if (hasSignedOutFlag()) {
      return null;
    }

    sessionCheckInProgress.current = true;

    try {
      const hasIndicator = hasCreatorSessionIndicator();
      const isPWA = isStandaloneMode();

      // Try localStorage first
      let token = localStorage.getItem("creatorToken");
      let creatorId = localStorage.getItem("creatorId");
      let creatorName = localStorage.getItem("creatorName");
      let creatorEmail = localStorage.getItem("creatorEmail");
      let creatorAvatar = localStorage.getItem("creatorAvatar");

      // If localStorage is empty but cookies exist, restore from cookies
      if (!token && getCookie("creatorToken")) {
        token = getCookie("creatorToken");
        creatorId = getCookie("creatorId");
        creatorName = getCookie("creatorName");
        creatorEmail = getCookie("creatorEmail");

        // Restore to localStorage for faster access
        if (token) localStorage.setItem("creatorToken", token);
        if (creatorId) localStorage.setItem("creatorId", creatorId);
        if (creatorName) localStorage.setItem("creatorName", creatorName);
        if (creatorEmail) localStorage.setItem("creatorEmail", creatorEmail);
      }

      // If still no token, try IndexedDB (most reliable on iOS PWA)
      // ALWAYS check IndexedDB if: we have indicator cookie, OR we're in PWA mode, OR it's a resume event
      const shouldCheckIndexedDB = !token && (hasIndicator || isPWA || source === "pageshow" || source === "visibilitychange" || source === "mount");

      if (shouldCheckIndexedDB) {
        try {
          const storedSession = await getCreatorSession();

          if (storedSession) {
            token = storedSession.token;
            creatorId = storedSession.creatorId;
            creatorName = storedSession.name;
            creatorEmail = storedSession.email;
            creatorAvatar = storedSession.avatar || null;

            // Restore to localStorage
            localStorage.setItem("creatorToken", token);
            localStorage.setItem("creatorId", creatorId);
            localStorage.setItem("creatorName", creatorName);
            localStorage.setItem("creatorEmail", creatorEmail);
            if (creatorAvatar) localStorage.setItem("creatorAvatar", creatorAvatar);

            // Also restore cookies (30 days)
            const maxAge = 30 * 24 * 60 * 60;
            setCreatorCookie("creatorToken", token, maxAge);
            setCreatorCookie("creatorId", creatorId, maxAge);
            setCreatorCookie("creatorName", encodeURIComponent(creatorName), maxAge);
            setCreatorCookie("creatorEmail", encodeURIComponent(creatorEmail), maxAge);

            // Re-store in IndexedDB to refresh the indicator cookie
            await storeCreatorSession({
              token,
              creatorId,
              name: creatorName,
              email: creatorEmail,
              avatar: creatorAvatar || undefined,
            });
          }
        } catch (error) {
          console.error("[CreatorLayout] IndexedDB error:", error);
        }
      }

      if (!token || !creatorId) {
        return null;
      }

      return { token, creatorId, creatorName, creatorEmail, creatorAvatar };
    } finally {
      sessionCheckInProgress.current = false;
    }
  }, [getCookie]);

  // Handle pageshow event - fires when PWA is resumed from background
  const handlePageShow = useCallback(async (event: PageTransitionEvent) => {
    // event.persisted is true when page is restored from bfcache (back-forward cache)
    if (event.persisted) {
      // Check if localStorage was cleared but we have IndexedDB data
      const hasLocalToken = !!localStorage.getItem("creatorToken");

      if (!hasLocalToken) {
        const authData = await checkAndRestoreSession("pageshow");

        if (authData) {
          // Session restored from IndexedDB, update UI
          setCreator({
            id: authData.creatorId,
            name: authData.creatorName || "Creator",
            email: authData.creatorEmail || "",
            avatar: authData.creatorAvatar || undefined,
          });
        } else if (!hasSignedOutFlag()) {
          // No session found and user didn't sign out - redirect to login
          router.push("/login");
        }
      }
    }
  }, [checkAndRestoreSession, router]);

  // Handle visibilitychange - fires when app comes to foreground
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === "visible") {
      // Small delay to let iOS settle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if session is still valid
      const hasLocalToken = !!localStorage.getItem("creatorToken");

      if (!hasLocalToken && !hasSignedOutFlag()) {
        const authData = await checkAndRestoreSession("visibilitychange");

        if (authData) {
          // Session restored from IndexedDB, update UI
          setCreator({
            id: authData.creatorId,
            name: authData.creatorName || "Creator",
            email: authData.creatorEmail || "",
            avatar: authData.creatorAvatar || undefined,
          });
        } else if (!hasSignedOutFlag()) {
          // No session found and user didn't sign out - redirect to login
          router.push("/login");
        }
      }
    }
  }, [checkAndRestoreSession, router]);

  // Set up PWA event listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always set up event listeners (they're cheap and help with debugging)
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handlePageShow, handleVisibilityChange]);

  // Initial auth check on mount
  useEffect(() => {
    checkAndRestoreSession("mount").then((authData) => {
      if (!authData) {
        if (!hasSignedOutFlag()) {
          router.push("/login");
        }
        return;
      }

      const { token, creatorId, creatorName, creatorEmail, creatorAvatar } = authData;

      // Set initial state from localStorage first
      const initialCreator = {
        id: creatorId!,
        name: creatorName || "Creator",
        email: creatorEmail || "",
        avatar: creatorAvatar || undefined,
      };

      // Fetch fresh profile data to get latest avatar
      (async () => {
        try {
          const response = await fetch("/api/portal/profile", {
            headers: {
              "x-creator-token": token!,
            },
          });
          if (response.ok) {
            const data = await response.json();

            // First-time creators must complete onboarding before entering the portal.
            if (data.onboardingCompleted === false) {
              localStorage.setItem("creatorOnboardingComplete", "false");
              router.replace("/portal/onboarding");
              return;
            }
            localStorage.setItem("creatorOnboardingComplete", "true");

            // Their time zone: saved from this browser while still the default,
            // so a deadline ends at 23:59 where they actually are
            const browserTz = browserTimeZone();
            let tz: string = data.timezone || browserTz;
            if (data.timezone === DEFAULT_CREATOR_TIMEZONE && browserTz !== DEFAULT_CREATOR_TIMEZONE) {
              try {
                const saved = await fetch("/api/portal/timezone", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-creator-token": token! },
                  body: JSON.stringify({ timezone: browserTz }),
                });
                if (saved.ok) tz = (await saved.json()).timezone || tz;
              } catch {
                // Keep the stored zone; it is tried again next sign-in
              }
            }
            setViewerTz(tz);

            // Update localStorage with fresh data
            if (data.name) localStorage.setItem("creatorName", data.name);
            if (data.avatar) {
              localStorage.setItem("creatorAvatar", data.avatar);
            } else {
              localStorage.removeItem("creatorAvatar");
            }
            // Update state with fresh data including avatar
            setCreator({
              id: creatorId!,
              name: data.name || creatorName || "Creator",
              email: data.email || creatorEmail || "",
              avatar: data.avatar || undefined,
            });
          } else if (response.status === 401) {
            // Session expired or was invalidated - clear it and send to sign-in
            // (no signed-out flag, so the user can sign in again normally)
            await clearLocalCreatorSession();
            router.replace("/login");
            return;
          } else {
            // If fetch fails, use localStorage data
            setViewerTz(browserTimeZone());
            setCreator(initialCreator);
          }
        } catch (error) {
          console.error("Error fetching creator profile:", error);
          // Use localStorage data on error
          setViewerTz(browserTimeZone());
          setCreator(initialCreator);
        }
      })();
    });
  }, [checkAndRestoreSession, router]);

  const handleLogout = async () => {
    const token = localStorage.getItem("creatorToken");

    // Set signed-out flag FIRST to prevent auto-login from kicking back in
    setSignedOutFlag();

    // Call logout API to invalidate session on server
    if (token) {
      try {
        await fetch("/api/portal/logout", {
          method: "POST",
          headers: {
            "x-creator-token": token,
          },
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }

    await clearLocalCreatorSession();

    router.push("/login");
  };

  // "Add to home screen" ticks itself off: tell the server once per session
  // when the portal is open from the home screen
  const creatorId = creator?.id;
  useEffect(() => {
    if (!creatorId || !isStandalone()) return;
    try {
      if (sessionStorage.getItem("ccm-home-screen-told") === creatorId) return;
      sessionStorage.setItem("ccm-home-screen-told", creatorId);
    } catch {
      /* private mode: tell it anyway */
    }
    fetch("/api/portal/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-creator-token": localStorage.getItem("creatorToken") || "" },
      body: JSON.stringify({ action: "home-screen" }),
    }).catch(() => {});
  }, [creatorId]);

  if (!creator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-2 border-t-transparent motion-reduce:animate-none" />
        <span className="sr-only">Loading your portal</span>
      </div>
    );
  }

  return (
    <CreatorChrome creator={creator} pathname={pathname} viewerTz={viewerTz} onLogout={handleLogout}>
      {children}
    </CreatorChrome>
  );
}

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    // The root layout already provides ThemeProvider; nesting a second one
    // here gave creator pages their own (out-of-sync) theme state.
    <BrandingProvider>
      <CreatorLayoutInner>{children}</CreatorLayoutInner>
    </BrandingProvider>
  );
}
