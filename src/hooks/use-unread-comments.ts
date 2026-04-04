"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UnreadCounts {
  total: number;
  byRequest: Record<string, number>;
}

interface UseUnreadCommentsReturn {
  /** Total unread comments count */
  total: number;
  /** Unread counts by request ID */
  byRequest: Record<string, number>;
  /** Whether data is loading */
  isLoading: boolean;
  /** Get unread count for a specific request */
  getCountForRequest: (requestId: string) => number;
  /** Mark comments as read for a request */
  markRequestAsRead: (requestId: string) => Promise<void>;
  /** Refresh the counts */
  refresh: () => Promise<void>;
}

export function useUnreadComments(
  pollInterval: number = 30000
): UseUnreadCommentsReturn {
  const [counts, setCounts] = useState<UnreadCounts>({ total: 0, byRequest: {} });
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/comments/unread?groupBy=request");
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setCounts({
            total: data.total || 0,
            byRequest: data.byRequest || {},
          });
        }
      }
    } catch (error) {
      console.error("[useUnreadComments] Error fetching counts:", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const markRequestAsRead = useCallback(async (requestId: string) => {
    try {
      const response = await fetch("/api/comments/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (response.ok) {
        // Optimistically update counts
        setCounts((prev) => {
          const requestCount = prev.byRequest[requestId] || 0;
          const newByRequest = { ...prev.byRequest };
          delete newByRequest[requestId];
          return {
            total: Math.max(0, prev.total - requestCount),
            byRequest: newByRequest,
          };
        });
      }
    } catch (error) {
      console.error("[useUnreadComments] Error marking as read:", error);
    }
  }, []);

  const getCountForRequest = useCallback(
    (requestId: string) => counts.byRequest[requestId] || 0,
    [counts.byRequest]
  );

  const refresh = useCallback(async () => {
    await fetchCounts();
  }, [fetchCounts]);

  // Initial fetch and polling
  useEffect(() => {
    isMountedRef.current = true;
    fetchCounts();

    const interval = setInterval(fetchCounts, pollInterval);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchCounts, pollInterval]);

  return {
    total: counts.total,
    byRequest: counts.byRequest,
    isLoading,
    getCountForRequest,
    markRequestAsRead,
    refresh,
  };
}

export default useUnreadComments;
