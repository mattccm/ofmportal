"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReadReceipt,
  ReadReceiptWithUser,
  MessageReadStatus,
  READ_RECEIPT_CONSTANTS,
} from "@/types/read-receipts";
import {
  getReadReceiptKey,
  getReadReceipts,
  addReadReceipt,
  subscribeToReadReceipts,
  pollingManager,
  generateId,
  getDeviceType,
  optimisticReadReceipts,
  readReceiptBatch,
} from "@/lib/realtime-simulation";

interface UseReadReceiptsOptions {
  messageId?: string;
  requestId?: string;
  commentId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  // Enable auto-polling for real-time updates
  enablePolling?: boolean;
  pollInterval?: number;
  // Auto mark as read when visible
  autoMarkAsRead?: boolean;
}

interface UseReadReceiptsReturn {
  // Read receipts data
  receipts: ReadReceiptWithUser[];
  isRead: boolean;
  readCount: number;

  // Actions
  markAsRead: () => Promise<void>;
  getReadStatus: () => MessageReadStatus;

  // Loading states
  isLoading: boolean;
  isMarking: boolean;
  error: string | null;

  // Refresh
  refresh: () => void;
}

export function useReadReceipts(options: UseReadReceiptsOptions): UseReadReceiptsReturn {
  const {
    messageId,
    requestId,
    commentId,
    userId,
    userName = "User",
    userAvatar,
    enablePolling = true,
    pollInterval = READ_RECEIPT_CONSTANTS.POLL_INTERVAL_MS,
    autoMarkAsRead = false,
  } = options;

  const [receipts, setReceipts] = useState<ReadReceiptWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = getReadReceiptKey(messageId, requestId, commentId);
  const hasMarkedRef = useRef(false);
  const mountedRef = useRef(true);

  // Fetch receipts from API/store
  const fetchReceipts = useCallback(async () => {
    try {
      // In production, this would fetch from API
      // For now, use the in-memory store
      const stored = getReadReceipts(messageId, requestId, commentId);

      // Merge with optimistic updates
      const pending = optimisticReadReceipts.getPending();
      const pendingForThisItem = pending.filter((p) => {
        const receipt = p.data;
        return (
          (messageId && receipt.messageId === messageId) ||
          (requestId && receipt.requestId === requestId) ||
          (commentId && receipt.commentId === commentId)
        );
      });

      const merged = [...stored];
      pendingForThisItem.forEach((p) => {
        const exists = merged.some((r) => r.userId === p.data.userId);
        if (!exists) {
          merged.push({
            ...p.data,
            userName: userName,
            userAvatar,
          });
        }
      });

      if (mountedRef.current) {
        setReceipts(merged);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch receipts");
        setIsLoading(false);
      }
    }
  }, [messageId, requestId, commentId, userName, userAvatar]);

  // Mark as read
  const markAsRead = useCallback(async () => {
    if (!userId || hasMarkedRef.current) return;
    if (receipts.some((r) => r.userId === userId)) return;

    setIsMarking(true);

    const receipt: ReadReceipt = {
      id: generateId("receipt"),
      messageId,
      requestId,
      commentId,
      userId,
      readAt: new Date(),
      deviceType: getDeviceType(),
    };

    // Add optimistic update
    optimisticReadReceipts.add(receipt.id, receipt);

    // Update local state immediately
    setReceipts((prev) => [
      ...prev,
      {
        ...receipt,
        userName,
        userAvatar,
      },
    ]);

    try {
      // In production, this would call the API
      // await fetch("/api/read-receipts", { method: "POST", body: JSON.stringify(receipt) });

      // For now, add to in-memory store
      addReadReceipt({
        ...receipt,
        userName,
        userAvatar,
      });

      // Also batch for potential API sync
      readReceiptBatch.add(receipt);

      optimisticReadReceipts.confirm(receipt.id);
      hasMarkedRef.current = true;
    } catch (err) {
      optimisticReadReceipts.remove(receipt.id);
      setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    } finally {
      if (mountedRef.current) {
        setIsMarking(false);
      }
    }
  }, [userId, userName, userAvatar, messageId, requestId, commentId, receipts]);

  // Get read status for the message
  const getReadStatus = useCallback((): MessageReadStatus => {
    return {
      messageId: messageId || "",
      isRead: receipts.length > 0,
      readBy: receipts.map((r) => ({
        userId: r.userId,
        userName: r.userName,
        userAvatar: r.userAvatar,
        userEmail: r.userEmail,
        readAt: r.readAt,
      })),
      readCount: receipts.length,
    };
  }, [messageId, receipts]);

  // Subscribe to real-time updates
  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = subscribeToReadReceipts(key, (updated) => {
      if (mountedRef.current) {
        setReceipts(updated);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [key]);

  // Initial fetch
  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    const pollKey = `read-receipts:${key}`;

    pollingManager.start({
      interval: pollInterval,
      key: pollKey,
      fetchFn: async () => {
        // In production, fetch from API
        return getReadReceipts(messageId, requestId, commentId);
      },
      onData: (data) => {
        if (mountedRef.current) {
          setReceipts(data as ReadReceiptWithUser[]);
        }
      },
    });

    return () => {
      pollingManager.stop(pollKey);
    };
  }, [enablePolling, pollInterval, key, messageId, requestId, commentId]);

  // Auto mark as read after delay
  useEffect(() => {
    if (!autoMarkAsRead || !userId || hasMarkedRef.current) return;

    const timeout = setTimeout(() => {
      markAsRead();
    }, READ_RECEIPT_CONSTANTS.READ_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [autoMarkAsRead, userId, markAsRead]);

  return {
    receipts,
    isRead: receipts.length > 0,
    readCount: receipts.length,
    markAsRead,
    getReadStatus,
    isLoading,
    isMarking,
    error,
    refresh: fetchReceipts,
  };
}

// ============================================================================
// Batch Read Receipts Hook
// ============================================================================

interface UseBatchReadReceiptsOptions {
  messageIds?: string[];
  requestIds?: string[];
  commentIds?: string[];
  enablePolling?: boolean;
}

interface BatchReadReceiptsReturn {
  receiptsMap: Map<string, ReadReceiptWithUser[]>;
  isLoading: boolean;
  markAllAsRead: (userId: string, userName: string) => Promise<void>;
  getReceiptsFor: (id: string) => ReadReceiptWithUser[];
}

export function useBatchReadReceipts(
  options: UseBatchReadReceiptsOptions
): BatchReadReceiptsReturn {
  const { messageIds = [], requestIds = [], commentIds = [], enablePolling = true } = options;

  const [receiptsMap, setReceiptsMap] = useState<Map<string, ReadReceiptWithUser[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all receipts
  useEffect(() => {
    const fetchAll = async () => {
      const map = new Map<string, ReadReceiptWithUser[]>();

      messageIds.forEach((id) => {
        const key = `message:${id}`;
        map.set(key, getReadReceipts(id, undefined, undefined));
      });

      requestIds.forEach((id) => {
        const key = `request:${id}`;
        map.set(key, getReadReceipts(undefined, id, undefined));
      });

      commentIds.forEach((id) => {
        const key = `comment:${id}`;
        map.set(key, getReadReceipts(undefined, undefined, id));
      });

      setReceiptsMap(map);
      setIsLoading(false);
    };

    fetchAll();
  }, [messageIds, requestIds, commentIds]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    const pollKey = `batch-read-receipts`;

    pollingManager.start({
      interval: READ_RECEIPT_CONSTANTS.POLL_INTERVAL_MS,
      key: pollKey,
      fetchFn: async () => {
        const map = new Map<string, ReadReceiptWithUser[]>();

        messageIds.forEach((id) => {
          map.set(`message:${id}`, getReadReceipts(id, undefined, undefined));
        });

        return map;
      },
      onData: (data) => {
        setReceiptsMap(data as Map<string, ReadReceiptWithUser[]>);
      },
    });

    return () => {
      pollingManager.stop(pollKey);
    };
  }, [enablePolling, messageIds, requestIds, commentIds]);

  const markAllAsRead = useCallback(async (userId: string, userName: string) => {
    messageIds.forEach((id) => {
      const receipt: ReadReceiptWithUser = {
        id: generateId("receipt"),
        messageId: id,
        userId,
        userName,
        readAt: new Date(),
        deviceType: getDeviceType(),
      };
      addReadReceipt(receipt);
    });
  }, [messageIds]);

  const getReceiptsFor = useCallback(
    (id: string): ReadReceiptWithUser[] => {
      return receiptsMap.get(`message:${id}`) || receiptsMap.get(`request:${id}`) || [];
    },
    [receiptsMap]
  );

  return {
    receiptsMap,
    isLoading,
    markAllAsRead,
    getReceiptsFor,
  };
}

// ============================================================================
// Visibility-based Read Tracking Hook
// ============================================================================

interface UseVisibilityReadTrackingOptions {
  messageId?: string;
  requestId?: string;
  commentId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  // Minimum time visible before marking as read (ms)
  minVisibleTime?: number;
}

export function useVisibilityReadTracking(
  elementRef: React.RefObject<HTMLElement | null>,
  options: UseVisibilityReadTrackingOptions
) {
  const {
    messageId,
    requestId,
    commentId,
    userId,
    userName = "User",
    userAvatar,
    minVisibleTime = READ_RECEIPT_CONSTANTS.READ_DELAY_MS,
  } = options;

  const { markAsRead, isRead } = useReadReceipts({
    messageId,
    requestId,
    commentId,
    userId,
    userName,
    userAvatar,
    enablePolling: false,
  });

  const visibleStartRef = useRef<number | null>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (!elementRef.current || markedRef.current || isRead) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!visibleStartRef.current) {
              visibleStartRef.current = Date.now();
            }

            // Check if visible long enough
            const checkTimeout = setTimeout(() => {
              if (
                visibleStartRef.current &&
                Date.now() - visibleStartRef.current >= minVisibleTime &&
                !markedRef.current
              ) {
                markedRef.current = true;
                markAsRead();
              }
            }, minVisibleTime);

            return () => clearTimeout(checkTimeout);
          } else {
            visibleStartRef.current = null;
          }
        });
      },
      { threshold: 0.5 } // Element must be 50% visible
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, markAsRead, minVisibleTime, isRead]);

  return { isRead };
}
