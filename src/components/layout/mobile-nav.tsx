"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-session";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Upload,
  Bell,
  Settings,
  LogOut,
  UserCog,
  HelpCircle,
  Sparkles,
  LayoutTemplate,
  BarChart3,
  BellRing,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Repeat,
  Sun,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { clearRememberToken, setSignedOutFlag } from "@/lib/remember-token";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// Main navigation items for bottom bar
const mainNavItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    activeIcon: LayoutDashboard,
  },
  {
    name: "Creators",
    href: "/dashboard/creators",
    icon: Users,
    activeIcon: Users,
  },
  {
    name: "Requests",
    href: "/dashboard/requests",
    icon: FileText,
    activeIcon: FileText,
  },
  {
    name: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    activeIcon: MessageSquare,
  },
];

// Additional items for the "More" menu
const moreMenuItems = [
  { name: "Uploads", href: "/dashboard/uploads", icon: Upload },
  { name: "Templates", href: "/dashboard/templates", icon: LayoutTemplate },
  { name: "Recurring Requests", href: "/dashboard/recurring-requests", icon: Repeat },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Exports", href: "/dashboard/exports", icon: Download },
  { name: "Reminders", href: "/dashboard/reminders", icon: Bell },
  { name: "Notifications", href: "/dashboard/notifications", icon: BellRing },
];

const adminItems = [
  { name: "Team", href: "/dashboard/team", icon: UserCog },
  { name: "Appearance", href: "/dashboard/settings/appearance", icon: Sun },
  { name: "Settings", href: "/dashboard/settings/profile", icon: Settings },
];

const supportItems = [
  { name: "Help Center", href: "/dashboard/help", icon: HelpCircle },
];

// Haptic feedback utility
const triggerHaptic = (type: "light" | "medium" | "heavy" = "light") => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[type]);
  }
};

interface PullToRefreshIndicatorProps {
  pullProgress: number;
  isRefreshing: boolean;
}

function PullToRefreshIndicator({
  pullProgress,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  if (pullProgress === 0 && !isRefreshing) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center",
        "transition-transform duration-200"
      )}
      style={{
        height: `${Math.min(pullProgress * 80, 80)}px`,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full",
          "bg-background border border-border shadow-lg",
          isRefreshing && "animate-spin"
        )}
        style={{
          transform: isRefreshing
            ? "none"
            : `rotate(${pullProgress * 360}deg)`,
          opacity: Math.min(pullProgress, 1),
        }}
      >
        <RefreshCw
          className={cn(
            "h-5 w-5 text-primary transition-colors",
            pullProgress >= 1 && "text-primary"
          )}
        />
      </div>
    </div>
  );
}

interface SwipeNavigationHintProps {
  direction: "left" | "right";
  visible: boolean;
}

function SwipeNavigationHint({ direction, visible }: SwipeNavigationHintProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed top-1/2 -translate-y-1/2 z-40",
        "flex items-center justify-center",
        "w-12 h-24 rounded-2xl",
        "bg-primary/10 backdrop-blur-sm",
        "transition-opacity duration-200",
        direction === "left" ? "left-0 rounded-l-none" : "right-0 rounded-r-none"
      )}
    >
      {direction === "left" ? (
        <ChevronLeft className="h-6 w-6 text-primary animate-pulse" />
      ) : (
        <ChevronRight className="h-6 w-6 text-primary animate-pulse" />
      )}
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Check if any "More" section item is active
  const isMoreActive = [...moreMenuItems, ...adminItems].some((item) =>
    pathname.startsWith(item.href)
  );

  // Get current nav index for swipe navigation
  const getCurrentNavIndex = useCallback(() => {
    for (let i = 0; i < mainNavItems.length; i++) {
      if (isActive(mainNavItems[i].href)) {
        return i;
      }
    }
    return -1;
  }, [pathname]);

  // Pull-to-refresh handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    scrollContainerRef.current = document.scrollingElement as HTMLElement;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current || isRefreshing) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Pull-to-refresh (vertical)
      const scrollTop = scrollContainerRef.current?.scrollTop || 0;
      if (scrollTop === 0 && deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
        const progress = Math.min(deltaY / 150, 1);
        setPullProgress(progress);

        if (progress >= 0.5) {
          triggerHaptic("light");
        }
      }

      // Swipe navigation hints (horizontal)
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        const currentIndex = getCurrentNavIndex();
        if (deltaX > 0 && currentIndex > 0) {
          setSwipeHint("left");
        } else if (deltaX < 0 && currentIndex < mainNavItems.length - 1) {
          setSwipeHint("right");
        }
      }
    },
    [isRefreshing, getCurrentNavIndex]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Handle pull-to-refresh
      if (pullProgress >= 1) {
        setIsRefreshing(true);
        triggerHaptic("medium");

        // Simulate refresh - in real app, this would refresh data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      // Handle swipe navigation
      if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
        const currentIndex = getCurrentNavIndex();
        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous
          triggerHaptic("medium");
          router.push(mainNavItems[currentIndex - 1].href);
        } else if (deltaX < 0 && currentIndex < mainNavItems.length - 1) {
          // Swipe left - go to next
          triggerHaptic("medium");
          router.push(mainNavItems[currentIndex + 1].href);
        }
      }

      // Reset states
      setPullProgress(0);
      setSwipeHint(null);
      touchStartRef.current = null;
    },
    [pullProgress, getCurrentNavIndex, router]
  );

  // Set up touch event listeners
  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleNavClick = useCallback((href: string) => {
    triggerHaptic("light");
  }, []);

  const handleMoreOpen = useCallback(() => {
    triggerHaptic("light");
    setMoreOpen(true);
  }, []);

  const handleMenuItemClick = useCallback(() => {
    triggerHaptic("light");
    setMoreOpen(false);
  }, []);

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        pullProgress={pullProgress}
        isRefreshing={isRefreshing}
      />

      {/* Swipe navigation hints */}
      <SwipeNavigationHint direction="left" visible={swipeHint === "left"} />
      <SwipeNavigationHint direction="right" visible={swipeHint === "right"} />

      {/* Bottom Navigation Bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "bg-background/95 backdrop-blur-xl border-t border-border",
          "safe-area-bottom"
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Touch target enhancement - extra padding area */}
        <div className="absolute -top-2 left-0 right-0 h-2" aria-hidden="true" />

        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = active ? item.activeIcon : item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  // Touch target: minimum 48px for accessibility
                  "flex flex-col items-center justify-center gap-1",
                  "min-w-[64px] min-h-[48px] px-3 py-2 rounded-xl",
                  "transition-all duration-200 ease-out",
                  // Active state scale
                  "active:scale-95",
                  // Touch optimization
                  "touch-manipulation select-none",
                  "-webkit-tap-highlight-color-transparent",
                  // Color states
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-transform duration-200",
                      active && "scale-110"
                    )}
                  />
                  {/* Active indicator */}
                  {active && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-gradient-to-r from-primary to-violet-500" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={handleMoreOpen}
            className={cn(
              // Touch target: minimum 48px for accessibility
              "flex flex-col items-center justify-center gap-1",
              "min-w-[64px] min-h-[48px] px-3 py-2 rounded-xl",
              "transition-all duration-200 ease-out",
              "active:scale-95",
              "touch-manipulation select-none",
              "-webkit-tap-highlight-color-transparent",
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-label="More options"
          >
            <div className="relative">
              <MoreHorizontal
                className={cn(
                  "h-6 w-6 transition-transform duration-200",
                  isMoreActive && "scale-110"
                )}
              />
              {isMoreActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-gradient-to-r from-primary to-violet-500" />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              More
            </span>
          </button>
        </div>

        {/* Swipe hint indicator at bottom */}
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-muted/80 backdrop-blur-sm text-xs text-muted-foreground",
            "opacity-0 transition-opacity duration-300",
            swipeHint && "opacity-100"
          )}
          aria-hidden="true"
        >
          {swipeHint === "left" && (
            <>
              <ChevronLeft className="h-3 w-3" />
              <span>Swipe for previous</span>
            </>
          )}
          {swipeHint === "right" && (
            <>
              <span>Swipe for next</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
        </div>
      </nav>

      {/* More Menu Sheet */}
      <MobileSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        height="auto"
        title="More"
      >
        <div className="space-y-6 pb-6">
          {/* User Section */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white font-semibold text-lg">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {user?.name || "User"}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email || ""}
              </p>
            </div>
            <Link
              href="/dashboard/settings/profile"
              onClick={handleMenuItemClick}
              className={cn(
                // 48px minimum touch target
                "flex h-12 w-12 items-center justify-center rounded-xl",
                "bg-background border border-border",
                "active:scale-95 transition-transform",
                "touch-manipulation"
              )}
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Navigation
            </p>
            {moreMenuItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleMenuItemClick}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl",
                    "transition-all duration-200 active:scale-[0.98]",
                    // 48px minimum touch target
                    "min-h-[48px] touch-manipulation",
                    "-webkit-tap-highlight-color-transparent",
                    active
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <div
                    className={cn(
                      // Icon container with good touch feedback
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Administration
                </p>
                {adminItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleMenuItemClick}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-xl",
                        "transition-all duration-200 active:scale-[0.98]",
                        "min-h-[48px] touch-manipulation",
                        "-webkit-tap-highlight-color-transparent",
                        active
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Support & Sign Out */}
          <Separator />
          <div className="space-y-1">
            {supportItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleMenuItemClick}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl",
                  "transition-all duration-200 active:scale-[0.98]",
                  "min-h-[48px] touch-manipulation",
                  "-webkit-tap-highlight-color-transparent",
                  "hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}

            <button
              onClick={async () => {
                triggerHaptic("medium");
                setMoreOpen(false);
                // Set flag to prevent auto-login, then clear token and sign out
                setSignedOutFlag();
                await clearRememberToken();
                signOut({ callbackUrl: "/login" });
              }}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl w-full",
                "transition-all duration-200 active:scale-[0.98]",
                "min-h-[48px] touch-manipulation",
                "-webkit-tap-highlight-color-transparent",
                "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600">
                <LogOut className="h-5 w-5" />
              </div>
              <span className="font-medium">Sign out</span>
            </button>
          </div>

          {/* App Version & Gesture Hints */}
          <div className="text-center pt-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <img src="/ccm-logo.png" alt="CCM" className="h-3 w-3 dark:invert" />
              <span>CCM Portal v1.0</span>
            </div>

            {/* Gesture hints */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                <span>Pull to refresh</span>
              </div>
              <div className="flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" />
                <ChevronRight className="h-3 w-3" />
                <span>Swipe to navigate</span>
              </div>
            </div>
          </div>
        </div>
      </MobileSheet>
    </>
  );
}
