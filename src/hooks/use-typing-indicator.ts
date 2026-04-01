"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  TypingIndicator,
  TypingDisplayInfo,
  READ_RECEIPT_CONSTANTS,
} from "@/types/read-receipts";
import {
  getTypingKey,
  getTypingIndicators,
  setTypingStatus,
  clearTypingIndicator,
  subscribeToTypingIndicators,
  pollingManager,
  formatTypingText,
  createDebouncedTyping,
} from "@/lib/realtime-simulation";

interface UseTypingIndicatorOptions {
  conversationId?: string;
  requestId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  // Enable polling for real-time updates
  enablePolling?: boolean;
  pollInterval?: number;
  // Typing timeout (when to clear indicator)
  typingTimeout?: number;
  // Debounce interval for sending updates
  debounceInterval?: number;
}

interface UseTypingIndicatorReturn {
  // Who is typing
  typingUsers: TypingIndicator[];
  typingDisplay: TypingDisplayInfo;

  // Send typing status
  startTyping: () => void;
  stopTyping: () => void;
  isTyping: boolean;

  // For input binding
  handleInputChange: () => void;
  handleInputBlur: () => void;

  // Loading state
  isLoading: boolean;
}

export function useTypingIndicator(
  options: UseTypingIndicatorOptions
): UseTypingIndicatorReturn {
  const {
    conversationId,
    requestId,
    userId,
    userName,
    userAvatar,
    enablePolling = true,
    pollInterval = READ_RECEIPT_CONSTANTS.POLL_INTERVAL_MS,
    typingTimeout = READ_RECEIPT_CONSTANTS.TYPING_TIMEOUT_MS,
    debounceInterval = READ_RECEIPT_CONSTANTS.TYPING_DEBOUNCE_MS,
  } = options;

  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const key = getTypingKey(conversationId, requestId);
  const mountedRef = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create debounced typing handler
  const debouncedTyping = useMemo(() => {
    return createDebouncedTyping(
      (typing: boolean) => {
        const indicator: TypingIndicator = {
          conversationId,
          requestId,
          userId,
          userName,
          userAvatar,
          isTyping: typing,
          startedAt: new Date(),
        };

        setTypingStatus(indicator);

        // Also send to API in production
        // fetch("/api/typing", { method: "POST", body: JSON.stringify(indicator) });
      },
      typingTimeout
    );
  }, [conversationId, requestId, userId, userName, userAvatar, typingTimeout]);

  // Filter out current user from typing users
  const filteredTypingUsers = useMemo(() => {
    return typingUsers.filter((u) => u.userId !== userId);
  }, [typingUsers, userId]);

  // Generate display info
  const typingDisplay = useMemo((): TypingDisplayInfo => {
    return {
      text: formatTypingText(filteredTypingUsers),
      users: filteredTypingUsers,
      showAnimation: filteredTypingUsers.length > 0,
    };
  }, [filteredTypingUsers]);

  // Fetch typing indicators
  const fetchTypingIndicators = useCallback(async () => {
    try {
      const indicators = getTypingIndicators(conversationId, requestId);
      if (mountedRef.current) {
        setTypingUsers(indicators);
        setIsLoading(false);
      }
    } catch {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [conversationId, requestId]);

  // Start typing
  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
    }
    debouncedTyping.startTyping();
  }, [isTyping, debouncedTyping]);

  // Stop typing
  const stopTyping = useCallback(() => {
    setIsTyping(false);
    debouncedTyping.stopTyping();
    clearTypingIndicator(userId, conversationId, requestId);
  }, [userId, conversationId, requestId, debouncedTyping]);

  // Handle input change - call this on every keystroke
  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  // Handle input blur - stop typing when focus is lost
  const handleInputBlur = useCallback(() => {
    stopTyping();
  }, [stopTyping]);

  // Subscribe to real-time updates
  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = subscribeToTypingIndicators(key, (updated) => {
      if (mountedRef.current) {
        setTypingUsers(updated);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [key]);

  // Initial fetch
  useEffect(() => {
    fetchTypingIndicators();
  }, [fetchTypingIndicators]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    const pollKey = `typing:${key}`;

    pollingManager.start({
      interval: pollInterval,
      key: pollKey,
      fetchFn: async () => {
        return getTypingIndicators(conversationId, requestId);
      },
      onData: (data) => {
        if (mountedRef.current) {
          setTypingUsers(data as TypingIndicator[]);
        }
      },
    });

    return () => {
      pollingManager.stop(pollKey);
    };
  }, [enablePolling, pollInterval, key, conversationId, requestId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear typing indicator when component unmounts
      if (isTyping) {
        clearTypingIndicator(userId, conversationId, requestId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [userId, conversationId, requestId, isTyping]);

  return {
    typingUsers: filteredTypingUsers,
    typingDisplay,
    startTyping,
    stopTyping,
    isTyping,
    handleInputChange,
    handleInputBlur,
    isLoading,
  };
}

// ============================================================================
// Simplified typing indicator hook for single input
// ============================================================================

interface UseSimpleTypingOptions {
  conversationId?: string;
  requestId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

export function useSimpleTypingIndicator(options: UseSimpleTypingOptions) {
  const { handleInputChange, handleInputBlur, isTyping, stopTyping } = useTypingIndicator({
    ...options,
    enablePolling: false,
  });

  // Returns props to spread on an input element
  const inputProps = useMemo(
    () => ({
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handleInputChange();
        return e;
      },
      onBlur: handleInputBlur,
    }),
    [handleInputChange, handleInputBlur]
  );

  return {
    inputProps,
    isTyping,
    stopTyping,
  };
}

// ============================================================================
// Watch typing indicator hook (read-only)
// ============================================================================

interface UseWatchTypingOptions {
  conversationId?: string;
  requestId?: string;
  excludeUserId?: string;
  enablePolling?: boolean;
}

export function useWatchTypingIndicator(options: UseWatchTypingOptions) {
  const {
    conversationId,
    requestId,
    excludeUserId,
    enablePolling = true,
  } = options;

  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const key = getTypingKey(conversationId, requestId);
  const mountedRef = useRef(true);

  // Filter out excluded user
  const filteredTypingUsers = useMemo(() => {
    if (!excludeUserId) return typingUsers;
    return typingUsers.filter((u) => u.userId !== excludeUserId);
  }, [typingUsers, excludeUserId]);

  // Generate display info
  const typingDisplay = useMemo((): TypingDisplayInfo => {
    return {
      text: formatTypingText(filteredTypingUsers),
      users: filteredTypingUsers,
      showAnimation: filteredTypingUsers.length > 0,
    };
  }, [filteredTypingUsers]);

  // Subscribe to real-time updates
  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = subscribeToTypingIndicators(key, (updated) => {
      if (mountedRef.current) {
        setTypingUsers(updated);
        setIsLoading(false);
      }
    });

    // Initial fetch
    const indicators = getTypingIndicators(conversationId, requestId);
    setTypingUsers(indicators);
    setIsLoading(false);

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [key, conversationId, requestId]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    const pollKey = `watch-typing:${key}`;

    pollingManager.start({
      interval: READ_RECEIPT_CONSTANTS.POLL_INTERVAL_MS,
      key: pollKey,
      fetchFn: async () => {
        return getTypingIndicators(conversationId, requestId);
      },
      onData: (data) => {
        if (mountedRef.current) {
          setTypingUsers(data as TypingIndicator[]);
        }
      },
    });

    return () => {
      pollingManager.stop(pollKey);
    };
  }, [enablePolling, key, conversationId, requestId]);

  return {
    typingUsers: filteredTypingUsers,
    typingDisplay,
    isLoading,
    hasTypingUsers: filteredTypingUsers.length > 0,
  };
}

// ============================================================================
// Multiple conversation typing tracking
// ============================================================================

interface UseMultiConversationTypingOptions {
  conversationIds: string[];
  excludeUserId?: string;
  enablePolling?: boolean;
}

export function useMultiConversationTyping(options: UseMultiConversationTypingOptions) {
  const { conversationIds, excludeUserId, enablePolling = true } = options;

  const [typingMap, setTypingMap] = useState<Map<string, TypingIndicator[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all typing indicators
  useEffect(() => {
    const fetchAll = () => {
      const map = new Map<string, TypingIndicator[]>();

      conversationIds.forEach((id) => {
        let indicators = getTypingIndicators(id, undefined);

        if (excludeUserId) {
          indicators = indicators.filter((i) => i.userId !== excludeUserId);
        }

        if (indicators.length > 0) {
          map.set(id, indicators);
        }
      });

      setTypingMap(map);
      setIsLoading(false);
    };

    fetchAll();
  }, [conversationIds, excludeUserId]);

  // Set up polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    const pollKey = `multi-conversation-typing`;

    pollingManager.start({
      interval: READ_RECEIPT_CONSTANTS.POLL_INTERVAL_MS,
      key: pollKey,
      fetchFn: async () => {
        const map = new Map<string, TypingIndicator[]>();

        conversationIds.forEach((id) => {
          let indicators = getTypingIndicators(id, undefined);

          if (excludeUserId) {
            indicators = indicators.filter((i) => i.userId !== excludeUserId);
          }

          if (indicators.length > 0) {
            map.set(id, indicators);
          }
        });

        return map;
      },
      onData: (data) => {
        setTypingMap(data as Map<string, TypingIndicator[]>);
      },
    });

    return () => {
      pollingManager.stop(pollKey);
    };
  }, [enablePolling, conversationIds, excludeUserId]);

  // Get typing users for a specific conversation
  const getTypingFor = useCallback(
    (conversationId: string): TypingIndicator[] => {
      return typingMap.get(conversationId) || [];
    },
    [typingMap]
  );

  // Check if anyone is typing in a conversation
  const isTypingIn = useCallback(
    (conversationId: string): boolean => {
      return (typingMap.get(conversationId)?.length || 0) > 0;
    },
    [typingMap]
  );

  // Get all conversations with typing activity
  const conversationsWithTyping = useMemo(() => {
    return Array.from(typingMap.keys());
  }, [typingMap]);

  return {
    typingMap,
    getTypingFor,
    isTypingIn,
    conversationsWithTyping,
    isLoading,
  };
}
