"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ActivityItemData, ActivityType } from "@/components/activity/activity-item";

// TYPES

interface UseRecentActivityOptions {
  /** Maximum number of activities to fetch. Default: 20 */
  limit?: number;
  /** Poll interval in milliseconds. Default: 30000 (30 seconds) */
  pollInterval?: number;
  /** Whether to enable polling. Default: true */
  enablePolling?: boolean;
  /** Activity types to filter by */
  types?: ActivityType[];
  /** Whether to include team activities. Default: true */
  includeTeamActivities?: boolean;
}

interface UseRecentActivityReturn {
  /** List of recent activities */
  activities: ActivityItemData[];
  /** Number of unread activities */
  unreadCount: number;
  /** Whether activities are loading */
  isLoading: boolean;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually refresh activities */
  refresh: () => Promise<void>;
  /** Mark an activity as read */
  markAsRead: (activityId: string) => void;
  /** Mark all activities as read */
  markAllAsRead: () => void;
  /** Add optimistic activity (for real-time updates) */
  addOptimisticActivity: (activity: ActivityItemData) => void;
}

// HELPER FUNCTIONS

function mapActionToActivityType(action: string): ActivityType {
  const mapping: Record<string, ActivityType> = {
    "upload.created": "upload_new",
    "upload.completed": "upload_new",
    "upload.approved": "upload_approved",
    "upload.rejected": "upload_rejected",
    "upload.reviewed": "upload_pending",
    "comment.created": "comment_new",
    "comment.updated": "comment_new",
    "comment.deleted": "comment_new",
    "request.created": "request_created",
    "request.updated": "request_created",
    "request.submitted": "request_completed",
    "request.approved": "request_completed",
    "request.rejected": "upload_rejected",
    "request.revision_requested": "upload_rejected",
    "request.status_changed": "request_created",
    "reminder.sent": "message_new",
    "reminder.scheduled": "message_new",
    "reminder.escalation": "message_new",
    "creator.invited": "team_member_added",
    "creator.login": "request_viewed",
    "creator.portal_accessed": "request_viewed",
    "creator.updated": "file_edited",
    "creator.note_added": "comment_new",
    "creator.note_updated": "comment_new",
    "creator.note_deleted": "comment_new",
  };
  return mapping[action] || "bulk_action";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActivityHref(activity: any): string | undefined {
  if (activity.entityType === "Upload" && activity.metadata?.requestId) {
    return `/dashboard/requests/${activity.metadata.requestId}`;
  }
  if (activity.entityType === "ContentRequest") {
    return `/dashboard/requests/${activity.entityId}`;
  }
  if (activity.entityType === "Creator") {
    return `/dashboard/creators/${activity.entityId}`;
  }
  return undefined;
}

// HOOK IMPLEMENTATION

export function useRecentActivity(
  options: UseRecentActivityOptions = {}
): UseRecentActivityReturn {
  const {
    limit = 20,
    pollInterval = 300000, // 5 minutes - reduced from 30s to save database egress
    enablePolling = false, // Disabled by default - enable only when needed
    types,
    includeTeamActivities = true,
  } = options;

  const [activities, setActivities] = useState<ActivityItemData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // FETCH FUNCTIONS

  const fetchActivities = useCallback(
    async (isRefresh: boolean = false) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        }

        // Build query params
        const params = new URLSearchParams({
          limit: limit.toString(),
          includeTeam: includeTeamActivities.toString(),
        });

        if (types && types.length > 0) {
          params.set("types", types.join(","));
        }

        // Fetch from API
        const response = await fetch(`/api/activity?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch activities");
        }

        const data = await response.json();

        if (isMountedRef.current) {
          // Map API response format to ActivityItemData format
          const parsedActivities = (data.activities || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any): ActivityItemData => ({
              id: a.id,
              type: mapActionToActivityType(a.action),
              title: a.description || a.action,
              description: a.metadata?.requestTitle || a.metadata?.uploadName || null,
              timestamp: new Date(a.timestamp),
              user: a.user ? {
                id: a.user.id,
                name: a.user.name,
                email: a.user.email,
                image: a.user.avatar,
              } : null,
              metadata: {
                requestId: a.metadata?.requestId,
                requestTitle: a.metadata?.requestTitle,
                uploadId: a.entityType === "Upload" ? a.entityId : undefined,
                uploadName: a.metadata?.uploadName,
                creatorId: a.metadata?.creatorId,
                creatorName: a.metadata?.creatorName,
              },
              href: getActivityHref(a),
              isRead: true, // Activity log items are not marked as read/unread
            })
          );
          setActivities(parsedActivities);
          setUnreadCount(0); // Activity feed doesn't track unread
          setError(null);
        }
      } catch (err) {
        // On error, surface the error and return a clean empty list
        // so the UI can render a proper empty/error state.
        if (isMountedRef.current) {
          setActivities([]);
          setUnreadCount(0);
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [limit, types, includeTeamActivities]
  );

  // ACTIONS

  const refresh = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  const markAsRead = useCallback((activityId: string) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId ? { ...a, isRead: true } : a
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Optimistically update, then sync with server
    fetch("/api/activity/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityIds: [activityId] }),
    }).catch((err) => {
      // Log error but don't revert - optimistic update remains
      console.warn("[useRecentActivity] Failed to mark activity as read:", err);
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setActivities((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);

    // Sync with server
    fetch("/api/activity/read-all", {
      method: "POST",
    }).catch((err) => {
      // Log error but don't revert - optimistic update remains
      console.warn("[useRecentActivity] Failed to mark all activities as read:", err);
    });
  }, []);

  const addOptimisticActivity = useCallback((activity: ActivityItemData) => {
    setActivities((prev) => {
      // Prevent duplicates
      if (prev.some((a) => a.id === activity.id)) {
        return prev;
      }
      // Add to beginning and trim to limit
      const updated = [activity, ...prev].slice(0, limit);
      return updated;
    });

    if (!activity.isRead) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [limit]);

  // EFFECTS

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchActivities();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchActivities]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;

    pollIntervalRef.current = setInterval(() => {
      fetchActivities(false);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enablePolling, pollInterval, fetchActivities]);

  // REAL-TIME UPDATES (optional WebSocket/SSE integration)

  // This effect can be extended to listen for real-time events
  // from a WebSocket or Server-Sent Events connection
  useEffect(() => {
    // Placeholder for real-time integration
    // Example with EventSource:
    // const eventSource = new EventSource('/api/activity/stream');
    // eventSource.onmessage = (event) => {
    //   const newActivity = JSON.parse(event.data);
    //   addOptimisticActivity(newActivity);
    // };
    // return () => eventSource.close();
  }, [addOptimisticActivity]);

  return {
    activities,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    addOptimisticActivity,
  };
}

// SIMPLE UNREAD COUNT HOOK

export function useUnreadActivityCount(pollInterval: number = 300000): number { // 5 minutes default
  const [count, setCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchCount = async () => {
      try {
        const response = await fetch("/api/activity/unread-count");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setCount(data.count);
          }
        } else if (isMounted) {
          setCount(0);
        }
      } catch {
        if (isMounted) {
          setCount(0);
        }
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

export default useRecentActivity;
