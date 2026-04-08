"use client";

import { useState, useCallback, useEffect } from "react";

interface UseCreatorMessagesCountReturn {
  count: number;
  refresh: () => Promise<void>;
}

export function useCreatorMessagesCount(): UseCreatorMessagesCountReturn {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
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
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    refresh();

    // Poll every 5 minutes (reduced from 60s to save database egress)
    const interval = setInterval(refresh, 300000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
