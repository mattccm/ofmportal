"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { GuidedTour } from "./guided-tour";
import { createTourConfig, DASHBOARD_TOUR_STEPS } from "@/hooks/use-guided-tour";

/**
 * Auto-starts the dashboard guided tour on a staff user's FIRST visit to the
 * dashboard, then never again. The "seen" flag is persisted in localStorage so
 * it survives reloads and future sessions. We manage the flag ourselves (rather
 * than relying on the tour's own persistCompletion) so that skipping the tour
 * also counts as "seen" — otherwise a skipped tour would re-appear next visit.
 *
 * The tour steps target elements that only exist on the /dashboard route, so we
 * gate rendering on that pathname to guarantee every step has a real target.
 */

const TOUR_SEEN_KEY = "uploadportal-dashboard-tour-seen";

const emptySubscribe = () => () => {};

function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) !== null;
  } catch {
    // If localStorage is unavailable, treat as "seen" so we don't nag.
    return true;
  }
}

export function DashboardTour() {
  const pathname = usePathname();
  // Client-only mount signal (server renders false) so we never read
  // localStorage during SSR and avoid setState-in-effect churn.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [dismissed, setDismissed] = useState(false);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, new Date().toISOString());
    } catch {
      // Ignore persistence failures; hiding for this session is enough.
    }
    setDismissed(true);
  }, []);

  // Only run on the dashboard home, where the tour's target nodes exist,
  // and only for a user who has not already seen (or just dismissed) it.
  if (!mounted || dismissed || pathname !== "/dashboard" || hasSeenTour()) {
    return null;
  }

  return (
    <GuidedTour
      config={createTourConfig("dashboard-tour", DASHBOARD_TOUR_STEPS, {
        autoStart: true,
        autoStartDelay: 1200,
        // We own the "seen" flag, so disable the hook's separate persistence.
        persistCompletion: false,
        onComplete: markSeen,
        onSkip: markSeen,
      })}
    />
  );
}

export default DashboardTour;
