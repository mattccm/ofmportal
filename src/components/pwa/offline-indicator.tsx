"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-mobile-features";

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show reconnected message when coming back online after being offline
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      setDismissed(false);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and never was offline
  if (isOnline && !showReconnected) {
    return null;
  }

  // Show reconnected toast
  if (isOnline && showReconnected && !dismissed) {
    return (
      <div
        className={cn(
          "fixed top-4 left-4 right-4 z-50 md:hidden",
          "animate-slide-down"
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div
          className={cn(
            "flex items-center gap-3 p-4 rounded-2xl",
            "bg-emerald-500 text-white shadow-lg"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "bg-white/20"
            )}
          >
            <Wifi className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Back online</p>
            <p className="text-sm text-white/80">
              Your connection has been restored
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              "bg-white/20 hover:bg-white/30 transition-colors",
              "touch-manipulation"
            )}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show offline banner
  if (!isOnline) {
    return (
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "bg-amber-500 text-white py-2 px-4",
          "flex items-center justify-center gap-2",
          "text-sm font-medium",
          "md:hidden"
        )}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
        }}
        role="alert"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4 animate-pulse" />
        <span>You&apos;re offline - Some features may be limited</span>
      </div>
    );
  }

  return null;
}
