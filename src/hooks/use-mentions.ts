"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "./use-debounce";
import type {
  MentionSuggestion,
  MentionWithDetails,
  MentionFilters,
  MentionInputState,
} from "@/types/mentions";
import {
  getMentionQuery,
  insertMention,
  filterSuggestions,
  extractMentionIds,
} from "@/lib/mention-parser";

// USE MENTION INPUT HOOK

interface UseMentionInputOptions {
  onMentionsChange?: (mentionIds: string[]) => void;
  /** Only suggest these users (e.g. the members of a team group) */
  onlyUserIds?: string[];
}

interface UseMentionInputReturn {
  // State
  inputState: MentionInputState;
  suggestions: MentionSuggestion[];
  isLoadingSuggestions: boolean;

  // Handlers
  handleTextChange: (text: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  handleSelectSuggestion: (suggestion: MentionSuggestion) => string;
  closeSuggestions: () => void;

  // Text state
  text: string;
  setText: (text: string) => void;
  mentionIds: string[];
}

export function useMentionInput(
  initialText: string = "",
  options: UseMentionInputOptions = {}
): UseMentionInputReturn {
  const { onMentionsChange, onlyUserIds } = options;

  // Text state
  const [text, setText] = useState(initialText);
  const mentionIds = useMemo(() => extractMentionIds(text), [text]);

  // Input state for autocomplete
  const [inputState, setInputState] = useState<MentionInputState>({
    isOpen: false,
    query: "",
    cursorPosition: 0,
    selectedIndex: 0,
    triggerPosition: null,
  });

  // Suggestions state
  const [allSuggestions, setAllSuggestions] = useState<MentionSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Debounced query for API calls
  const debouncedQuery = useDebounce(inputState.query, 150);

  // Track mention start index for insertion
  const mentionStartIndexRef = useRef<number | null>(null);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setIsLoadingSuggestions(true);
        const response = await fetch(
          `/api/mentions/suggestions?q=${encodeURIComponent(debouncedQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setAllSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error("Failed to fetch mention suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    if (inputState.isOpen) {
      fetchSuggestions();
    }
  }, [debouncedQuery, inputState.isOpen]);

  // Filter suggestions when query changes (local filtering)
  const suggestions = useMemo(() => {
    const scoped = onlyUserIds ? allSuggestions.filter((s) => onlyUserIds.includes(s.id)) : allSuggestions;
    return filterSuggestions(scoped, inputState.query);
  }, [allSuggestions, inputState.query, onlyUserIds]);

  // Notify when mention IDs change
  useEffect(() => {
    onMentionsChange?.(mentionIds);
  }, [mentionIds, onMentionsChange]);

  // Handle text change and detect @ trigger
  const handleTextChange = useCallback(
    (newText: string, cursorPosition: number) => {
      setText(newText);

      // Check for mention query
      const mentionQuery = getMentionQuery(newText, cursorPosition);

      if (mentionQuery) {
        mentionStartIndexRef.current = mentionQuery.startIndex;
        setInputState((prev) => ({
          ...prev,
          isOpen: true,
          query: mentionQuery.query,
          cursorPosition,
          selectedIndex: 0,
        }));
      } else {
        mentionStartIndexRef.current = null;
        setInputState((prev) => ({
          ...prev,
          isOpen: false,
          query: "",
          cursorPosition,
        }));
      }
    },
    []
  );

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback(
    (suggestion: MentionSuggestion): string => {
      if (mentionStartIndexRef.current === null) return text;

      const result = insertMention(
        text,
        suggestion,
        mentionStartIndexRef.current,
        inputState.cursorPosition
      );

      setText(result.text);
      mentionStartIndexRef.current = null;
      setInputState({
        isOpen: false,
        query: "",
        cursorPosition: result.cursorPosition,
        selectedIndex: 0,
        triggerPosition: null,
      });

      return result.text;
    },
    [text, inputState.cursorPosition]
  );

  // Close suggestions
  const closeSuggestions = useCallback(() => {
    mentionStartIndexRef.current = null;
    setInputState((prev) => ({
      ...prev,
      isOpen: false,
      query: "",
      selectedIndex: 0,
    }));
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!inputState.isOpen || suggestions.length === 0) {
        return false;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setInputState((prev) => ({
            ...prev,
            selectedIndex: Math.min(
              prev.selectedIndex + 1,
              suggestions.length - 1
            ),
          }));
          return true;

        case "ArrowUp":
          e.preventDefault();
          setInputState((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          return true;

        case "Enter":
        case "Tab":
          e.preventDefault();
          const selectedSuggestion = suggestions[inputState.selectedIndex];
          if (selectedSuggestion) {
            handleSelectSuggestion(selectedSuggestion);
          }
          return true;

        case "Escape":
          e.preventDefault();
          closeSuggestions();
          return true;

        default:
          return false;
      }
    },
    [inputState.isOpen, inputState.selectedIndex, suggestions, handleSelectSuggestion, closeSuggestions]
  );

  return {
    inputState,
    suggestions,
    isLoadingSuggestions,
    handleTextChange,
    handleKeyDown,
    handleSelectSuggestion,
    closeSuggestions,
    text,
    setText,
    mentionIds,
  };
}

// USE MENTIONS PANEL HOOK

interface UseMentionsPanelOptions {
  filters?: MentionFilters;
  limit?: number;
}

interface UseMentionsPanelReturn {
  mentions: MentionWithDetails[];
  isLoading: boolean;
  error: Error | null;
  unreadCount: number;
  hasMore: boolean;

  // Actions
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (mentionId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useMentionsPanel(
  options: UseMentionsPanelOptions = {}
): UseMentionsPanelReturn {
  const { filters, limit = 20 } = options;

  const [mentions, setMentions] = useState<MentionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  // Fetch mentions
  const fetchMentions = useCallback(
    async (reset: boolean = false) => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("limit", limit.toString());
        params.set("offset", reset ? "0" : offsetRef.current.toString());

        if (filters?.read !== undefined) {
          params.set("read", filters.read.toString());
        }
        if (filters?.resourceType && filters.resourceType !== "all") {
          params.set("contextType", filters.resourceType);
        }

        const response = await fetch(`/api/mentions?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch mentions");
        }

        const data = await response.json();

        if (reset) {
          setMentions(data.mentions);
          offsetRef.current = data.mentions.length;
        } else {
          setMentions((prev) => [...prev, ...data.mentions]);
          offsetRef.current += data.mentions.length;
        }

        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [filters, limit]
  );

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/mentions/unread");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    queueMicrotask(() => {
      fetchMentions(true);
      fetchUnreadCount();
    });
  }, [fetchMentions, fetchUnreadCount]);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchMentions(true);
    await fetchUnreadCount();
  }, [fetchMentions, fetchUnreadCount]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchMentions(false);
  }, [fetchMentions, hasMore, isLoading]);

  // Mark as read
  const markAsRead = useCallback(async (mentionId: string) => {
    try {
      const response = await fetch(`/api/mentions/${mentionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });

      if (response.ok) {
        setMentions((prev) =>
          prev.map((m) =>
            m.id === mentionId ? { ...m, read: true, readAt: new Date() } : m
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark mention as read:", error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/mentions/read-all", {
        method: "POST",
      });

      if (response.ok) {
        setMentions((prev) =>
          prev.map((m) => ({ ...m, read: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all mentions as read:", error);
    }
  }, []);

  return {
    mentions,
    isLoading,
    error,
    unreadCount,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}

// USE UNREAD MENTIONS COUNT HOOK

interface UseUnreadMentionsReturn {
  count: number;
  refresh: () => Promise<void>;
}

export function useUnreadMentions(): UseUnreadMentionsReturn {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/mentions/unread");
      if (response.ok) {
        const data = await response.json();
        setCount(data.count);
      }
    } catch (error) {
      console.error("Failed to fetch unread mentions:", error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    queueMicrotask(refresh);

    // Poll every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
