"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccess } from "@/lib/access/client";

interface UseCreatorMessagesCountReturn {
  count: number;
  refresh: () => Promise<void>;
}

/**
 * Unread creator comments, for the Comments badge. Only asked for when the
 * role can see requests (the API answers 403 otherwise); the API counts only
 * comments on requests inside the person's creator scope.
 */
export function useCreatorMessagesCount(): UseCreatorMessagesCountReturn {
  const [count, setCount] = useState(0);
  const allowed = useAccess().can("requests.view");

  const refresh = useCallback(async () => {
    if (!allowed) return;
    try {
      const response = await fetch("/api/creator-messages?limit=1");
      if (response.ok) {
        const data = await response.json();
        // Use unreadCount for the badge (unread comments only)
        setCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch creator messages count:", error);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    queueMicrotask(refresh);

    // Refresh promptly when comments are marked read elsewhere (the Comments
    // page dispatches this) or when the user returns to the tab. The 5-minute
    // poll is only a fallback so the badge is never more than a beat stale.
    const onRead = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("creator-messages:read", onRead);
    window.addEventListener("focus", onRead);
    document.addEventListener("visibilitychange", onVisible);

    const interval = setInterval(refresh, 300000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("creator-messages:read", onRead);
      window.removeEventListener("focus", onRead);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, allowed]);

  return { count: allowed ? count : 0, refresh };
}
