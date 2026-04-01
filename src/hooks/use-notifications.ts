"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { NotificationItemData } from "@/components/notifications";

// ============================================
// TYPES
// ============================================

interface UseNotificationsOptions {
  /** Poll interval in milliseconds. Default: 30000 (30 seconds) */
  pollInterval?: number;
  /** Maximum notifications to fetch. Default: 20 */
  limit?: number;
  /** Whether to only fetch unread notifications */
  unreadOnly?: boolean;
  /** Whether to enable polling. Default: true */
  enablePolling?: boolean;
}

interface UseNotificationsReturn {
  /** List of notifications */
  notifications: NotificationItemData[];
  /** Total count of notifications matching the query */
  total: number;
  /** Unread notification count */
  unreadCount: number;
  /** Whether there are more notifications to load */
  hasMore: boolean;
  /** Whether notifications are currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually refresh notifications */
  refresh: () => Promise<void>;
  /** Load more notifications (pagination) */
  loadMore: () => Promise<void>;
  /** Mark a single notification as read */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    pollInterval = 30000,
    limit = 20,
    unreadOnly = false,
    enablePolling = true,
  } = options;

  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ============================================
  // FETCH FUNCTIONS
  // ============================================

  const fetchNotifications = useCallback(
    async (reset: boolean = false) => {
      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
          ...(unreadOnly && { unreadOnly: "true" }),
        });

        const response = await fetch(`/api/notifications?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch notifications");
        }

        const data = await response.json();

        if (!isMountedRef.current) return;

        const newNotifications = data.notifications.map(
          (n: NotificationItemData) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            readAt: n.readAt ? new Date(n.readAt) : null,
          })
        );

        if (reset) {
          setNotifications(newNotifications);
          setOffset(limit);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
          setOffset((prev) => prev + limit);
        }

        setTotal(data.total);
        setHasMore(data.hasMore);
        setError(null);
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [limit, offset, unreadOnly]
  );

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setUnreadCount(data.count);
        }
      }
    } catch {
      // Silently fail for count updates
    }
  }, []);

  // ============================================
  // ACTIONS
  // ============================================

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchNotifications(true), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    await fetchNotifications(false);
  }, [fetchNotifications, hasMore, isLoading]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, readAt: new Date() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications(true);
    fetchUnreadCount();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;

    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enablePolling, pollInterval, fetchUnreadCount]);

  return {
    notifications,
    total,
    unreadCount,
    hasMore,
    isLoading,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}

// ============================================
// SIMPLE UNREAD COUNT HOOK
// ============================================

export function useUnreadNotificationCount(pollInterval: number = 30000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchCount = async () => {
      try {
        const response = await fetch("/api/notifications/unread-count");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setCount(data.count);
          }
        }
      } catch {
        // Silently fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return count;
}

export default useNotifications;
