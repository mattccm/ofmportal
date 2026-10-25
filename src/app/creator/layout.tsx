"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BrandingProvider, useBranding } from "@/components/providers/branding-provider";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BRAND } from "@/lib/brand";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  FileText,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCreatorSession, clearCreatorSession, hasCreatorSessionIndicator, setSignedOutFlag, hasSignedOutFlag, storeCreatorSession } from "@/lib/remember-token";
import { setCreatorCookie, clearCreatorCookie } from "@/lib/creator-cookies";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/creator/dashboard", label: "Home", icon: <Home className="h-5 w-5" /> },
  { href: "/creator/requests", label: "Requests", icon: <FileText className="h-5 w-5" /> },
  { href: "/creator/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
  { href: "/creator/messages", label: "Messages", icon: <MessageSquare className="h-5 w-5" /> },
];

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
  const { branding, agencyName } = useBranding();
  const sessionCheckInProgress = useRef(false);
  const [creator, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null>(null);

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
            setCreator(initialCreator);
          }
        } catch (error) {
          console.error("Error fetching creator profile:", error);
          // Use localStorage data on error
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

  if (!creator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-2 border-t-transparent motion-reduce:animate-none" />
        <span className="sr-only">Loading your portal</span>
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const initials =
    creator.name
      .replace(/\./g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const logo =
    branding.logoDark && branding.logoDark !== BRAND.logoPath ? (
      // eslint-disable-next-line @next/next/no-img-element -- agency's own dark-surface logo from settings
      <img src={branding.logoDark} alt="" className="h-8 w-8 object-contain" />
    ) : (
      <BrandLogo size={30} priority imageClassName="invert" />
    );

  const avatar = creator.avatar ? (
    <Avatar size="sm" user={{ name: creator.name, email: creator.email, image: creator.avatar }} />
  ) : (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full bg-raised-hi text-xs font-semibold text-foreground"
      aria-hidden="true"
    >
      {initials}
    </span>
  );

  const accountMenu = (side: "bar" | "rail") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {side === "bar" ? (
          <button
            type="button"
            aria-label={`Account: ${creator.name}`}
            className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {avatar}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Account: ${creator.name}`}
            className="flex h-12 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {avatar}
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{creator.name}</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={side === "bar" ? "end" : "start"} side={side === "bar" ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold">{creator.name}</p>
          <p className="truncate text-[13px] text-ink-2">{creator.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/creator/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-late focus:text-late">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const allItems = [...navItems, { href: "/creator/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> }];

  return (
    <div className="min-h-screen bg-background safe-area-top">
      {/* Desktop (1024px and up): a labelled side rail with every destination */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ground px-3 pb-4 pt-5 lg:flex">
        <Link
          href="/creator/dashboard"
          aria-label={`${agencyName || "CCM"}, Home`}
          className="mb-6 ml-1 grid size-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {logo}
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "[&_svg]:size-[18px] [&_svg]:stroke-[1.5]",
                  active
                    ? "bg-tile text-foreground before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-ink [&_svg]:stroke-2"
                    : "text-ink-2 hover:bg-tile hover:text-foreground [&_svg]:text-icon"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">{accountMenu("rail")}</div>
      </aside>

      {/* Phone and tablet top bar: the mark, the destinations from 640px, the creator's initials */}
      <header className="sticky top-0 z-40 bg-ground lg:hidden">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-2 px-4 md:max-w-[720px]">
          <Link
            href="/creator/dashboard"
            aria-label={`${agencyName || "CCM"}, Home`}
            className="grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {logo}
          </Link>
          <span className="flex-1" />

          <nav aria-label="Main" className="hidden items-center gap-0.5 sm:flex">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active ? "bg-tile text-foreground" : "text-ink-2 hover:bg-tile hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {accountMenu("bar")}
        </div>
      </header>

      {/* Phone tab bar: every destination one thumb away */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-tile sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-[560px] safe-area-x">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  "touch-manipulation active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-ink-2"
                )}
              >
                <span className={cn("[&_svg]:stroke-[1.5]", active && "[&_svg]:stroke-2")}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/*
        The content column: at most 560px on a phone (104px under it so the tab
        bar never covers content), 720px on a tablet, and from 1024px a wide
        area beside the rail that each page lays out in columns.
      */}
      <div className="lg:pl-60">
        <main
          id="main"
          className="relative mx-auto w-full max-w-[560px] pb-[calc(104px+env(safe-area-inset-bottom,0px))] sm:pb-16 md:max-w-[720px] lg:max-w-[1200px] lg:px-4 lg:pb-12"
        >
          {children}
        </main>
      </div>
    </div>
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
