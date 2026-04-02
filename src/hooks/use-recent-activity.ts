"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ActivityItemData, ActivityType } from "@/components/activity/activity-item";

// ============================================
// TYPES
// ============================================

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
  /** Whether mock/demo data is being displayed (API unavailable) */
  isUsingMockData: boolean;
  /** Manually refresh activities */
  refresh: () => Promise<void>;
  /** Mark an activity as read */
  markAsRead: (activityId: string) => void;
  /** Mark all activities as read */
  markAllAsRead: () => void;
  /** Add optimistic activity (for real-time updates) */
  addOptimisticActivity: (activity: ActivityItemData) => void;
}

// ============================================
// MOCK DATA GENERATOR (for development)
// ============================================

function generateMockActivities(limit: number): ActivityItemData[] {
  const activityTypes: ActivityType[] = [
    "upload_new",
    "upload_approved",
    "upload_rejected",
    "request_created",
    "request_sent",
    "request_completed",
    "comment_new",
    "message_new",
    "team_member_added",
    "file_downloaded",
  ];

  const users = [
    { id: "1", name: "Sarah Johnson", email: "sarah@example.com" },
    { id: "2", name: "Michael Chen", email: "michael@example.com" },
    { id: "3", name: "Emily Davis", email: "emily@example.com" },
    { id: "4", name: "James Wilson", email: "james@example.com" },
    { id: "5", name: null, email: "anonymous@example.com" },
  ];

  const titles: Record<ActivityType, string[]> = {
    upload_new: [
      "New upload received from {creator}",
      "{creator} uploaded 3 new files",
      "New content submitted for review",
    ],
    upload_approved: [
      "Upload approved for {request}",
      "Content approved and ready for download",
      "{creator}'s submission has been approved",
    ],
    upload_rejected: [
      "Upload rejected - revision needed",
      "Content did not meet requirements",
      "{creator}'s submission needs revision",
    ],
    upload_pending: [
      "Upload pending review",
      "New submission awaiting approval",
    ],
    request_created: [
      "New request created: {request}",
      "Content request drafted",
      "Request ready to send",
    ],
    request_sent: [
      "Request sent to {creator}",
      "Content request delivered",
      "{creator} received the request",
    ],
    request_completed: [
      "Request completed by {creator}",
      "All files received for {request}",
      "Content delivery complete",
    ],
    request_expired: [
      "Request expired: {request}",
      "Deadline passed for content request",
    ],
    request_viewed: [
      "{creator} viewed the request",
      "Request opened by recipient",
    ],
    comment_new: [
      "{user} commented on {upload}",
      "New feedback on submitted content",
      "Comment added to revision request",
    ],
    message_new: [
      "New message from {creator}",
      "{creator} sent you a message",
      "Unread message in inbox",
    ],
    message_reply: [
      "{creator} replied to your message",
      "New reply in conversation",
    ],
    team_member_added: [
      "{user} joined the team",
      "New team member added",
      "Welcome {user} to the team",
    ],
    team_member_removed: [
      "{user} left the team",
      "Team member removed",
    ],
    team_member_role_changed: [
      "{user}'s role changed to {role}",
      "Team permissions updated",
    ],
    file_downloaded: [
      "{user} downloaded {upload}",
      "Content downloaded",
      "Files exported successfully",
    ],
    file_edited: [
      "File metadata updated",
      "Content details modified",
    ],
    file_deleted: [
      "File removed from uploads",
      "Content deleted",
    ],
    bulk_action: [
      "Bulk action completed",
      "Multiple items updated",
    ],
  };

  const descriptions: string[] = [
    "View details to learn more",
    "Click to review the content",
    "Action may be required",
    "No action needed",
    "",
  ];

  const requestTitles = [
    "Summer Campaign Photos",
    "Product Launch Video",
    "Social Media Content Pack",
    "Brand Assets Update",
    "Quarterly Review Materials",
  ];

  const creatorNames = [
    "Alex Thompson",
    "Jordan Lee",
    "Casey Morgan",
    "Taylor Swift",
    "Drew Parker",
  ];

  const activities: ActivityItemData[] = [];

  for (let i = 0; i < limit; i++) {
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const titleOptions = titles[type] || ["Activity occurred"];
    let title = titleOptions[Math.floor(Math.random() * titleOptions.length)];

    // Replace placeholders
    title = title
      .replace("{creator}", creatorNames[Math.floor(Math.random() * creatorNames.length)])
      .replace("{request}", requestTitles[Math.floor(Math.random() * requestTitles.length)])
      .replace("{user}", user.name || "A user")
      .replace("{upload}", "uploaded-file.jpg")
      .replace("{role}", "Admin");

    // Generate timestamp within the last week
    const now = Date.now();
    const randomTime = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);

    activities.push({
      id: `activity-${i}-${Date.now()}`,
      type,
      title,
      description: Math.random() > 0.5 ? descriptions[Math.floor(Math.random() * descriptions.length)] : undefined,
      timestamp: new Date(randomTime),
      user: Math.random() > 0.3 ? user : null,
      metadata: {
        requestTitle: Math.random() > 0.5 ? requestTitles[Math.floor(Math.random() * requestTitles.length)] : undefined,
        creatorName: Math.random() > 0.6 ? creatorNames[Math.floor(Math.random() * creatorNames.length)] : undefined,
        count: Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 2 : undefined,
      },
      href: Math.random() > 0.3 ? `/dashboard/notifications` : undefined,
      isRead: Math.random() > 0.4,
    });
  }

  // Sort by timestamp (most recent first)
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return activities;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useRecentActivity(
  options: UseRecentActivityOptions = {}
): UseRecentActivityReturn {
  const {
    limit = 20,
    pollInterval = 30000,
    enablePolling = true,
    types,
    includeTeamActivities = true,
  } = options;

  const [activities, setActivities] = useState<ActivityItemData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ============================================
  // FETCH FUNCTIONS
  // ============================================

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

        // Try to fetch from API
        const response = await fetch(`/api/activity?${params}`);

        if (!response.ok) {
          // If API not available, use mock data in development with warning
          if (process.env.NODE_ENV === "development") {
            console.warn("[useRecentActivity] API unavailable, using mock data");
            const mockData = generateMockActivities(limit);
            if (isMountedRef.current) {
              setActivities(mockData);
              setUnreadCount(mockData.filter((a) => !a.isRead).length);
              setIsUsingMockData(true);
              // Set a warning instead of hiding the error completely
              setError("Using demo data (API unavailable)");
            }
            return;
          }
          throw new Error("Failed to fetch activities");
        }

        const data = await response.json();

        if (isMountedRef.current) {
          const parsedActivities = data.activities.map(
            (a: ActivityItemData) => ({
              ...a,
              timestamp: new Date(a.timestamp),
            })
          );
          setActivities(parsedActivities);
          setUnreadCount(data.unreadCount ?? parsedActivities.filter((a: ActivityItemData) => !a.isRead).length);
          setError(null);
          setIsUsingMockData(false);
        }
      } catch (err) {
        // In development, fall back to mock data with warning
        if (process.env.NODE_ENV === "development") {
          console.warn("[useRecentActivity] Error fetching activities, using mock data:", err);
          const mockData = generateMockActivities(limit);
          if (isMountedRef.current) {
            setActivities(mockData);
            setUnreadCount(mockData.filter((a) => !a.isRead).length);
            setIsUsingMockData(true);
            // Show warning that we're using mock data
            setError("Using demo data (connection error)");
          }
          return;
        }

        if (isMountedRef.current) {
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

  // ============================================
  // ACTIONS
  // ============================================

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

  // ============================================
  // EFFECTS
  // ============================================

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

  // ============================================
  // REAL-TIME UPDATES (optional WebSocket/SSE integration)
  // ============================================

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
    isUsingMockData,
    refresh,
    markAsRead,
    markAllAsRead,
    addOptimisticActivity,
  };
}

// ============================================
// SIMPLE UNREAD COUNT HOOK
// ============================================

export function useUnreadActivityCount(pollInterval: number = 30000): number {
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
        } else if (process.env.NODE_ENV === "development" && isMounted) {
          // In development, use a consistent mock count (not random)
          console.warn("[useUnreadActivityCount] API unavailable, using mock count");
          setCount(3); // Consistent mock value
        }
      } catch {
        // In development, generate mock count with warning
        if (process.env.NODE_ENV === "development" && isMounted) {
          console.warn("[useUnreadActivityCount] Error fetching count, using mock");
          setCount(3); // Consistent mock value
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
