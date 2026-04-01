"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Types for creator context data
export interface CreatorContextNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  isPinned?: boolean; // NEW: Support for pinned notes
}

export interface CreatorContextRequest {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  isOverdue: boolean;
  urgency: string;
}

export interface CreatorContextUpload {
  id: string;
  originalName: string;
  fileType: string;
  status: string;
  thumbnailUrl: string | null;
  uploadedAt: string | null;
  requestId: string;
  requestTitle: string;
}

export interface CreatorContextActivity {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
  metadata?: Record<string, unknown>;
}

export interface CreatorContextStats {
  avgResponseTimeHours: number;
  onTimeCompletionRate: number;
  totalRequestsCompleted: number;
  approvalRate: number;
  totalUploads: number;
  pendingRequests: number;
  overdueRequests: number;
}

// NEW: Communication/message type for recent communications
export interface CreatorContextCommunication {
  id: string;
  type: "message" | "comment";
  content: string;
  timestamp: string;
  authorId: string;
  authorName: string;
  isFromCreator: boolean;
  requestId?: string;
  requestTitle?: string;
}

// NEW: Tag/label type
export interface CreatorTag {
  id: string;
  name: string;
  color: string;
}

export interface CreatorContextData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  inviteStatus: string;
  timezone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeRequests: CreatorContextRequest[];
  recentUploads: CreatorContextUpload[];
  stats: CreatorContextStats;
  notes: CreatorContextNote[];
  recentActivity: CreatorContextActivity[];
  requestSummary: {
    active: number;
    overdue: number;
  };
  // NEW: Additional fields for improvements
  tags?: CreatorTag[];
  recentCommunications?: CreatorContextCommunication[];
}

export interface UseCreatorContextOptions {
  creatorId: string | null;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseCreatorContextReturn {
  data: CreatorContextData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addNote: (content: string, isPinned?: boolean) => Promise<void>;
  updateNote: (noteId: string, content: string, isPinned?: boolean) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  toggleNotePin: (noteId: string) => Promise<void>; // NEW: Toggle pin status
  isAddingNote: boolean;
  sendReminder: () => Promise<void>; // NEW: Quick action
  isSendingReminder: boolean; // NEW
}

// Simple in-memory cache
const contextCache = new Map<string, { data: CreatorContextData; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// NEW: EventSource for real-time updates
const eventSourceMap = new Map<string, EventSource>();

export function useCreatorContext({
  creatorId,
  enabled = true,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseCreatorContextOptions): UseCreatorContextReturn {
  const [data, setData] = useState<CreatorContextData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchContext = useCallback(async (skipCache = false) => {
    if (!creatorId || !enabled) {
      setData(null);
      return;
    }

    // Check cache first
    if (!skipCache) {
      const cached = contextCache.get(creatorId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        return;
      }
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/creators/${creatorId}/context`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch creator context");
      }

      const contextData: CreatorContextData = await response.json();
      setData(contextData);

      // Update cache
      contextCache.set(creatorId, {
        data: contextData,
        timestamp: Date.now(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore aborted requests
      }
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [creatorId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchContext();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchContext]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !enabled || !creatorId) return;

    const scheduleRefresh = () => {
      refreshTimeoutRef.current = setTimeout(() => {
        fetchContext(true);
        scheduleRefresh();
      }, refreshInterval);
    };

    scheduleRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefresh, enabled, creatorId, refreshInterval, fetchContext]);

  // NEW: Real-time updates via SSE
  useEffect(() => {
    if (!creatorId || !enabled) return;

    // Check if EventSource is supported and not already connected
    if (typeof EventSource === "undefined") return;
    if (eventSourceMap.has(creatorId)) return;

    try {
      const eventSource = new EventSource(`/api/creators/${creatorId}/realtime`);
      eventSourceMap.set(creatorId, eventSource);

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);

          // Handle different update types
          if (update.type === "activity") {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                recentActivity: [update.data, ...prev.recentActivity.slice(0, 4)],
              };
            });
          } else if (update.type === "upload") {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                recentUploads: [update.data, ...prev.recentUploads.slice(0, 5)],
              };
            });
          } else if (update.type === "request") {
            // Refetch to get updated request data
            fetchContext(true);
          } else if (update.type === "communication") {
            setData((prev) => {
              if (!prev) return prev;
              const communications = prev.recentCommunications || [];
              return {
                ...prev,
                recentCommunications: [update.data, ...communications.slice(0, 2)],
              };
            });
          } else if (update.type === "full_refresh") {
            fetchContext(true);
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e);
        }
      };

      eventSource.onerror = () => {
        // Close and remove on error - will reconnect on next render
        eventSource.close();
        eventSourceMap.delete(creatorId);
      };
    } catch (e) {
      console.error("Failed to create EventSource:", e);
    }

    return () => {
      const es = eventSourceMap.get(creatorId);
      if (es) {
        es.close();
        eventSourceMap.delete(creatorId);
      }
    };
  }, [creatorId, enabled, fetchContext]);

  const refetch = useCallback(async () => {
    await fetchContext(true);
  }, [fetchContext]);

  const addNote = useCallback(async (content: string, isPinned = false) => {
    if (!creatorId) return;

    setIsAddingNote(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isPinned }),
      });

      if (!response.ok) {
        throw new Error("Failed to add note");
      }

      const { note } = await response.json();

      // Update local data - pinned notes go first
      setData((prev) => {
        if (!prev) return prev;
        const newNotes = isPinned
          ? [note, ...prev.notes]
          : [...prev.notes.filter(n => n.isPinned), note, ...prev.notes.filter(n => !n.isPinned)];
        return {
          ...prev,
          notes: newNotes,
        };
      });

      // Invalidate cache
      contextCache.delete(creatorId);
    } catch (err) {
      throw err;
    } finally {
      setIsAddingNote(false);
    }
  }, [creatorId]);

  const updateNote = useCallback(async (noteId: string, content: string, isPinned?: boolean) => {
    if (!creatorId) return;

    try {
      const response = await fetch(`/api/creators/${creatorId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content, isPinned }),
      });

      if (!response.ok) {
        throw new Error("Failed to update note");
      }

      const { note } = await response.json();

      // Update local data and reorder if pin status changed
      setData((prev) => {
        if (!prev) return prev;
        const updatedNotes = prev.notes.map((n) => (n.id === noteId ? note : n));
        // Sort: pinned first, then by date
        const sortedNotes = [
          ...updatedNotes.filter(n => n.isPinned),
          ...updatedNotes.filter(n => !n.isPinned),
        ];
        return {
          ...prev,
          notes: sortedNotes,
        };
      });

      // Invalidate cache
      contextCache.delete(creatorId);
    } catch (err) {
      throw err;
    }
  }, [creatorId]);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!creatorId) return;

    try {
      const response = await fetch(
        `/api/creators/${creatorId}/notes?noteId=${noteId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete note");
      }

      // Update local data
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: prev.notes.filter((n) => n.id !== noteId),
        };
      });

      // Invalidate cache
      contextCache.delete(creatorId);
    } catch (err) {
      throw err;
    }
  }, [creatorId]);

  // NEW: Toggle note pin status
  const toggleNotePin = useCallback(async (noteId: string) => {
    if (!creatorId || !data) return;

    const note = data.notes.find(n => n.id === noteId);
    if (!note) return;

    try {
      await updateNote(noteId, note.content, !note.isPinned);
    } catch (err) {
      throw err;
    }
  }, [creatorId, data, updateNote]);

  // NEW: Send reminder quick action
  const sendReminder = useCallback(async () => {
    if (!creatorId) return;

    setIsSendingReminder(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to send reminder");
      }

      // Refetch to update activity
      await fetchContext(true);
    } catch (err) {
      throw err;
    } finally {
      setIsSendingReminder(false);
    }
  }, [creatorId, fetchContext]);

  return {
    data,
    isLoading,
    error,
    refetch,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin,
    isAddingNote,
    sendReminder,
    isSendingReminder,
  };
}

// Hook for invalidating creator context cache
export function useInvalidateCreatorContext() {
  return useCallback((creatorId?: string) => {
    if (creatorId) {
      contextCache.delete(creatorId);
    } else {
      contextCache.clear();
    }
  }, []);
}

// NEW: Hook for storing collapsed section states
const COLLAPSED_SECTIONS_KEY = "creator-panel-collapsed-sections";

function getInitialCollapsedSections(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load collapsed sections:", e);
  }
  return {};
}

export function useCollapsedSections() {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(getInitialCollapsedSections);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const newState = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error("Failed to save collapsed sections:", e);
      }
      return newState;
    });
  }, []);

  const isSectionOpen = useCallback((sectionId: string, defaultOpen = true) => {
    return collapsedSections[sectionId] === undefined
      ? defaultOpen
      : !collapsedSections[sectionId];
  }, [collapsedSections]);

  return { toggleSection, isSectionOpen };
}

// NEW: Hook for creator comparison mode
export interface ComparisonData {
  creator1: CreatorContextData | null;
  creator2: CreatorContextData | null;
}

export function useCreatorComparison() {
  const [comparisonIds, setComparisonIds] = useState<[string | null, string | null]>([null, null]);
  const [isComparing, setIsComparing] = useState(false);

  const context1 = useCreatorContext({
    creatorId: comparisonIds[0],
    enabled: isComparing && !!comparisonIds[0],
  });

  const context2 = useCreatorContext({
    creatorId: comparisonIds[1],
    enabled: isComparing && !!comparisonIds[1],
  });

  const startComparison = useCallback((id1: string, id2: string) => {
    setComparisonIds([id1, id2]);
    setIsComparing(true);
  }, []);

  const endComparison = useCallback(() => {
    setComparisonIds([null, null]);
    setIsComparing(false);
  }, []);

  const swapCreators = useCallback(() => {
    setComparisonIds(([a, b]) => [b, a]);
  }, []);

  return {
    isComparing,
    startComparison,
    endComparison,
    swapCreators,
    creator1: context1.data,
    creator2: context2.data,
    isLoading: context1.isLoading || context2.isLoading,
    error: context1.error || context2.error,
  };
}

// ============================================
// PANEL STATE MANAGEMENT HOOK
// ============================================

export interface UseCreatorContextPanelOptions {
  /** Initial creator ID (optional) */
  initialCreatorId?: string | null;
  /** Whether the panel should start open */
  initialOpen?: boolean;
}

export interface UseCreatorContextPanelReturn {
  /** Current creator ID being displayed */
  creatorId: string | null;
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Open the panel for a specific creator */
  openPanel: (creatorId: string) => void;
  /** Close the panel */
  closePanel: () => void;
  /** Toggle the panel open/closed state */
  togglePanel: () => void;
  /** Set a new creator ID (opens panel if closed) */
  setCreatorId: (creatorId: string | null) => void;
  /** Props to spread on CreatorContextPanel component */
  panelProps: {
    creatorId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onOpenChange: (open: boolean) => void;
    onToggle: () => void;
  };
}

/**
 * Hook to manage CreatorContextPanel state
 *
 * This hook provides an easy way to manage the panel's open/close state
 * and the currently selected creator. It also provides the `onToggle`
 * callback which enables the "C" keyboard shortcut within the panel.
 *
 * @example
 * ```tsx
 * function CreatorsPage() {
 *   const { panelProps, openPanel } = useCreatorContextPanel();
 *
 *   return (
 *     <div>
 *       <CreatorList onSelectCreator={(id) => openPanel(id)} />
 *       <CreatorContextPanel {...panelProps} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useCreatorContextPanel({
  initialCreatorId = null,
  initialOpen = false,
}: UseCreatorContextPanelOptions = {}): UseCreatorContextPanelReturn {
  const [creatorId, setCreatorIdState] = useState<string | null>(initialCreatorId);
  const [isOpen, setIsOpen] = useState(initialOpen);

  const openPanel = useCallback((id: string) => {
    setCreatorIdState(id);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setCreatorId = useCallback((id: string | null) => {
    setCreatorIdState(id);
    if (id && !isOpen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return {
    creatorId,
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    setCreatorId,
    panelProps: {
      creatorId,
      isOpen,
      onClose: closePanel,
      onOpenChange: handleOpenChange,
      onToggle: togglePanel,
    },
  };
}
