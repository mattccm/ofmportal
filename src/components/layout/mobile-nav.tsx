"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useUser } from "@/hooks/use-session";
import { useCreatorMessagesCount } from "@/hooks/use-creator-messages";
import { ChevronLeft, ChevronRight, LogOut, RefreshCw, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { clearRememberToken, setSignedOutFlag } from "@/lib/remember-token";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { STAFF_NAV, STAFF_PHONE_EXTRAS, isNavActive, navItemVisible, type StaffNavItem } from "./staff-nav";
import { useAccess } from "@/lib/access/client";

// The four main destinations, in swipe order (an edge swipe moves between them)
const mainNavItems = [
  { name: "Overview", href: "/dashboard" },
  { name: "Creators", href: "/dashboard/creators" },
  { name: "Requests", href: "/dashboard/requests" },
  { name: "Messages", href: "/dashboard/messages" },
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

// Distance (px) from the left/right screen edge within which an edge-swipe
// must start for swipe-to-navigate to activate.
const SWIPE_EDGE_THRESHOLD = 24;

// Determine whether a gesture starting on `target` should be excluded from
// swipe-to-navigate. Ignores interactive elements and horizontally scrollable
// containers so swiping tables/carousels/sliders or selecting text never
// triggers a route change.
const isSwipeBlocked = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;

  // Interactive / opt-out elements
  if (
    target.closest(
      "input, textarea, select, a, button, [role='slider'], [data-no-swipe-nav]"
    )
  ) {
    return true;
  }

  // Any horizontally scrollable ancestor
  let el: Element | null = target;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (
        (overflowX === "auto" || overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth
      ) {
        return true;
      }
    }
    el = el.parentElement;
  }

  return false;
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
          "bg-raised shadow-lg",
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
            "h-5 w-5 text-ink-2 transition-colors",
            pullProgress >= 1 && "text-foreground"
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
        "bg-raised",
        "transition-opacity duration-200",
        direction === "left" ? "left-0 rounded-l-none" : "right-0 rounded-r-none"
      )}
    >
      {direction === "left" ? (
        <ChevronLeft className="h-6 w-6 text-foreground" />
      ) : (
        <ChevronRight className="h-6 w-6 text-foreground" />
      )}
    </div>
  );
}

interface MobileNavProps {
  /** The phone menu's open state, owned by the layout (the phone bar opens it) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The phone fold of the staff rail: a menu that slides in from the left with
 * every destination, plus the phone gestures (pull to refresh, edge swipe
 * between the main destinations). The phone bar (MobileHeader) opens it.
 */
export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    swipeEligible: boolean;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const { count: creatorMessagesCount } = useCreatorMessagesCount();
  const { canAny } = useAccess();
  const visible = (i: StaffNavItem) => navItemVisible(i, canAny);
  // An edge swipe only moves between main destinations this person can open
  const swipeItems = useMemo(
    () =>
      mainNavItems.filter((m) => {
        const item = STAFF_NAV.flatMap((g) => g.items).find((i) => i.href === m.href);
        return !item || navItemVisible(item, canAny);
      }),
    [canAny]
  );

  const isActive = useCallback((href: string) => isNavActive(pathname, href), [pathname]);

  // Current main destination, for swipe navigation
  const getCurrentNavIndex = useCallback(() => {
    for (let i = 0; i < swipeItems.length; i++) {
      if (isActive(swipeItems[i].href)) {
        return i;
      }
    }
    return -1;
  }, [isActive, swipeItems]);

  // Pull-to-refresh handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // Swipe-to-navigate only activates for edge-swipes that don't start on an
    // interactive or horizontally scrollable element.
    const startedAtEdge =
      touch.clientX <= SWIPE_EDGE_THRESHOLD ||
      touch.clientX >= window.innerWidth - SWIPE_EDGE_THRESHOLD;
    const swipeEligible = startedAtEdge && !isSwipeBlocked(e.target);
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      swipeEligible,
    };
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
        const progress = Math.min(deltaY / 180, 1);
        setPullProgress(progress);

        if (progress >= 0.5) {
          triggerHaptic("light");
        }
      }

      // Swipe navigation hints (horizontal) - only for eligible edge-swipes
      if (
        touchStartRef.current.swipeEligible &&
        Math.abs(deltaX) > 50 &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        const currentIndex = getCurrentNavIndex();
        if (deltaX > 0 && currentIndex > 0) {
          setSwipeHint("left");
        } else if (deltaX < 0 && currentIndex < swipeItems.length - 1) {
          setSwipeHint("right");
        }
      }
    },
    [isRefreshing, getCurrentNavIndex, swipeItems]
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

        // Refresh server data without a hard reload (preserves client state)
        router.refresh();
        setTimeout(() => {
          setIsRefreshing(false);
        }, 1000);
      }

      // Handle swipe navigation - only for eligible edge-swipes
      if (
        touchStartRef.current.swipeEligible &&
        Math.abs(deltaX) > 100 &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        const currentIndex = getCurrentNavIndex();
        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous
          triggerHaptic("medium");
          router.push(swipeItems[currentIndex - 1].href);
        } else if (deltaX < 0 && currentIndex < swipeItems.length - 1) {
          // Swipe left - go to next
          triggerHaptic("medium");
          router.push(swipeItems[currentIndex + 1].href);
        }
      }

      // Reset states
      setPullProgress(0);
      setSwipeHint(null);
      touchStartRef.current = null;
    },
    [pullProgress, getCurrentNavIndex, router, swipeItems]
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

  const close = useCallback(() => {
    triggerHaptic("light");
    onOpenChange(false);
  }, [onOpenChange]);

  const row = (item: StaffNavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const count = item.badge === "comments" && creatorMessagesCount > 0 ? creatorMessagesCount : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={close}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-md px-2.5 text-[15px] font-medium transition-colors",
          "touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          active ? "bg-raised text-foreground" : "text-ink-2 hover:bg-raised hover:text-foreground"
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="flex-1 truncate">{item.name}</span>
        {count > 0 && (
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {count > 99 ? "99+" : count}
            <span className="sr-only"> new</span>
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} />
      <SwipeNavigationHint direction="left" visible={swipeHint === "left"} />
      <SwipeNavigationHint direction="right" visible={swipeHint === "right"} />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          id="staff-menu"
          side="left"
          className="flex w-[min(300px,84vw)] flex-col gap-0 overflow-y-auto border-r-0 bg-tile p-0 px-3 pb-5"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 px-1">
            <BrandLogo size={28} imageClassName="invert" />
            <SheetTitle className="text-base font-semibold">{BRAND.productName}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Every page of the staff portal</SheetDescription>

          <nav aria-label="Main" className="mt-2 flex flex-col gap-0.5">
            {STAFF_NAV.map((g, gi) => {
              const items = g.items.filter(visible);
              if (!items.length) return null;
              return (
                <div key={g.name} className="flex flex-col gap-0.5" role="group" aria-label={g.name}>
                  {gi > 0 && <p className="mb-1 mt-4 px-2.5 text-[13px] text-ink-2">{g.name}</p>}
                  {items.map(row)}
                </div>
              );
            })}
            <div className="mt-4 flex flex-col gap-0.5" role="group" aria-label="More">
              {STAFF_PHONE_EXTRAS.filter(visible).map(row)}
            </div>
          </nav>

          <div className="mt-auto flex items-center gap-3 border-t border-line px-2.5 pt-4">
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              <span className="block truncate font-semibold text-foreground">{user?.name || "User"}</span>
              <span className="block truncate">{user?.email || ""}</span>
            </p>
            <Link
              href="/dashboard/settings/profile"
              onClick={close}
              aria-label="Profile settings"
              className="grid size-11 place-items-center rounded-md text-icon transition-colors hover:bg-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Settings className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            onClick={async () => {
              triggerHaptic("medium");
              onOpenChange(false);
              // Set flag to prevent auto-login, then clear token and sign out
              setSignedOutFlag();
              await clearRememberToken();
              signOut({ callbackUrl: "/login" });
            }}
            className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-2.5 text-[15px] font-medium text-late transition-colors hover:bg-late/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <LogOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
            Sign out
          </button>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="size-3" aria-hidden="true" /> Pull to refresh
            </span>
            <span className="inline-flex items-center gap-1">
              <ChevronLeft className="size-3" aria-hidden="true" />
              <ChevronRight className="size-3" aria-hidden="true" /> Swipe from the edge
            </span>
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
