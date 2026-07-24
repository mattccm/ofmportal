"use client";

import { useEffect, useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  isRealtimeAvailable,
  channelNames,
  RealtimePayload,
  broadcastToChannel,
} from "@/lib/supabase";

// TYPES

interface UseRealtimeOptions {
  /** Channel name to subscribe to */
  channelName: string;
  /** Callback when a message is received */
  onMessage: (payload: RealtimePayload) => void;
  /** Whether to enable the subscription (default: true) */
  enabled?: boolean;
  /** Fallback polling function if Realtime is unavailable */
  fallbackPoll?: () => Promise<void>;
  /** Fallback polling interval in ms (default: 300000 = 5 min) */
  fallbackInterval?: number;
}

interface UseRealtimeReturn {
  /** Whether connected to Realtime */
  isConnected: boolean;
  /** Whether using fallback polling */
  isPolling: boolean;
  /** Manually trigger a refresh (calls fallback or forces reconnect) */
  refresh: () => Promise<void>;
}

// CORE REALTIME HOOK

function subscribeToMount() {
  return () => {};
}

function getMountedSnapshot(): boolean {
  return true;
}

function getServerMountedSnapshot(): boolean {
  return false;
}

/**
 * Subscribe to Supabase Realtime channel with automatic fallback to polling
 *
 * This hook provides:
 * - Automatic connection to Supabase Realtime when available
 * - Graceful fallback to polling when Realtime is not configured
 * - Cleanup on unmount
 * - Reconnection handling
 */
export function useSupabaseRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const {
    channelName,
    onMessage,
    enabled = true,
    fallbackPoll,
    fallbackInterval = 300000, // 5 minutes default
  } = options;

  // Always report false during server render and hydration to avoid mismatch
  // (server doesn't know about Realtime availability)
  const isMounted = useSyncExternalStore(
    subscribeToMount,
    getMountedSnapshot,
    getServerMountedSnapshot
  );
  const realtimeAvailable = isMounted && enabled && isRealtimeAvailable();
  const isConnected = realtimeAvailable;
  const isPolling = isMounted && enabled && !realtimeAvailable && !!fallbackPoll;

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep callback ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Setup subscription or fallback
  useEffect(() => {
    if (!enabled) return;

    if (isRealtimeAvailable()) {
      // Use Supabase Realtime
      subscribeToChannel(channelName, (payload) => {
        onMessageRef.current(payload);
      });

      return () => {
        unsubscribeFromChannel(channelName);
      };
    } else if (fallbackPoll) {
      // Initial poll
      fallbackPoll();

      // Setup polling interval
      pollIntervalRef.current = setInterval(fallbackPoll, fallbackInterval);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [channelName, enabled, fallbackPoll, fallbackInterval]);

  const refresh = useCallback(async () => {
    if (fallbackPoll) {
      await fallbackPoll();
    }
  }, [fallbackPoll]);

  return {
    isConnected,
    isPolling,
    refresh,
  };
}

// SPECIALIZED HOOKS

/**
 * Subscribe to agency-wide notifications
 */
export function useAgencyNotifications(
  agencyId: string | undefined,
  onNotification: (notification: RealtimePayload) => void
) {
  const channelName = agencyId ? channelNames.agencyNotifications(agencyId) : "";

  return useSupabaseRealtime({
    channelName,
    onMessage: onNotification,
    enabled: !!agencyId,
  });
}

/**
 * Subscribe to user-specific notifications
 */
export function useUserNotifications(
  userId: string | undefined,
  onNotification: (notification: RealtimePayload) => void
) {
  const channelName = userId ? channelNames.userNotifications(userId) : "";

  return useSupabaseRealtime({
    channelName,
    onMessage: onNotification,
    enabled: !!userId,
  });
}

/**
 * Subscribe to request updates (comments, uploads, status changes)
 */
export function useRequestUpdates(
  requestId: string | undefined,
  onUpdate: (update: RealtimePayload) => void
) {
  const channelName = requestId ? channelNames.request(requestId) : "";

  return useSupabaseRealtime({
    channelName,
    onMessage: onUpdate,
    enabled: !!requestId,
  });
}

/**
 * Subscribe to conversation messages
 */
export function useConversationMessages(
  conversationId: string | undefined,
  onMessage: (message: RealtimePayload) => void
) {
  const channelName = conversationId ? channelNames.conversation(conversationId) : "";

  return useSupabaseRealtime({
    channelName,
    onMessage,
    enabled: !!conversationId,
  });
}

/**
 * Typing indicator hook with broadcast capability
 */
export function useTypingIndicator(conversationId: string | undefined, userId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<
    Array<{ id: string; name: string; startedAt: string }>
  >([]);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const channelName = conversationId ? channelNames.typing(conversationId) : "";

  const handleTypingMessage = useCallback((payload: RealtimePayload) => {
    if (payload.type !== "typing") return;

    const data = payload.data as { userId: string; userName: string; isTyping: boolean };

    if (data.isTyping) {
      // Add or update typing user
      setTypingUsers((prev) => {
        const existing = prev.find((u) => u.id === data.userId);
        if (existing) return prev;
        return [...prev, { id: data.userId, name: data.userName, startedAt: payload.timestamp }];
      });

      // Clear after 5 seconds if no update
      const existingTimeout = typingTimeoutRef.current.get(data.userId);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
        typingTimeoutRef.current.delete(data.userId);
      }, 5000);

      typingTimeoutRef.current.set(data.userId, timeout);
    } else {
      // Remove typing user
      setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
      const timeout = typingTimeoutRef.current.get(data.userId);
      if (timeout) {
        clearTimeout(timeout);
        typingTimeoutRef.current.delete(data.userId);
      }
    }
  }, []);

  const { isConnected } = useSupabaseRealtime({
    channelName,
    onMessage: handleTypingMessage,
    enabled: !!conversationId,
  });

  // Broadcast typing status
  const setTyping = useCallback(
    async (isTyping: boolean, userName: string = "User") => {
      if (!conversationId || !userId) return;

      await broadcastToChannel(channelNames.typing(conversationId), {
        type: "typing",
        data: { userId, userName, isTyping },
        timestamp: new Date().toISOString(),
      });
    },
    [conversationId, userId]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = typingTimeoutRef.current;
    return () => {
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
      timeouts.clear();
    };
  }, []);

  return {
    typingUsers: typingUsers.filter((u) => u.id !== userId), // Don't show own typing
    setTyping,
    isConnected,
  };
}

/**
 * Subscribe to creator portal updates
 */
export function useCreatorPortalUpdates(
  creatorId: string | undefined,
  onUpdate: (update: RealtimePayload) => void
) {
  const channelName = creatorId ? channelNames.creatorPortal(creatorId) : "";

  return useSupabaseRealtime({
    channelName,
    onMessage: onUpdate,
    enabled: !!creatorId,
  });
}
