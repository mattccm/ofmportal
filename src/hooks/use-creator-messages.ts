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
        setCount(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch creator messages count:", error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    refresh();

    // Poll every 60 seconds
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
