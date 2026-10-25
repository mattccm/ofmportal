"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Settings, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { channelNames, isRealtimeAvailable, type RealtimePayload } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  NotificationItem,
  NotificationItemSkeleton,
  NotificationEmptyState,
  type NotificationItemData,
} from "./notification-item";

// CONSTANTS

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_NOTIFICATIONS = 5; // Max notifications to show in dropdown

// NOTIFICATION BELL COMPONENT

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // FETCH FUNCTIONS

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/notifications?limit=${MAX_NOTIFICATIONS}`
      );
      if (response.ok) {
        const data = await response.json();
        setNotifications(
          data.notifications.map((n: NotificationItemData) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            readAt: n.readAt ? new Date(n.readAt) : null,
          }))
        );
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // POLLING

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();
    fetchNotifications();

    // Set up polling. Read `isOpen` from a ref so the interval stays stable
    // and isn't torn down/recreated every time the dropdown opens or closes.
    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
      // Only fetch full notifications if dropdown is open
      if (isOpenRef.current) {
        fetchNotifications();
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchUnreadCount, fetchNotifications]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // REALTIME

  // Subscribe to this user's notification channel for instant updates.
  // Falls back to the polling above when Realtime isn't configured.
  const handleRealtimeNotification = useCallback(
    (payload: RealtimePayload) => {
      if (payload.type !== "notification") return;
      fetchUnreadCount();
      if (isOpenRef.current) {
        fetchNotifications();
      }
    },
    [fetchUnreadCount, fetchNotifications]
  );

  useSupabaseRealtime({
    channelName: userId ? channelNames.userNotifications(userId) : "",
    onMessage: handleRealtimeNotification,
    enabled: !!userId && isRealtimeAvailable(),
  });

  // ACTIONS

  const handleMarkAsRead = async (notificationId: string) => {
    const target = notifications.find((n) => n.id === notificationId);
    const wasUnread = target ? target.readAt === null : true;

    // Update local state before the round-trip so the badge clears instantly,
    // even when clicking the item also navigates away and unmounts the bell.
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, readAt: new Date() } : n
      )
    );
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (!response.ok) {
        // Revert the optimistic update if the server rejected it
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, readAt: null } : n
          )
        );
        if (wasUnread) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: null } : n
        )
      );
      if (wasUnread) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);

    // Snapshot for rollback, then update local state immediately
    const prevNotifications = notifications;
    const prevUnreadCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    setUnreadCount(0);

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!response.ok) {
        setNotifications(prevNotifications);
        setUnreadCount(prevUnreadCount);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notification: NotificationItemData) => {
    // Close dropdown when navigating
    setIsOpen(false);
  };

  // RENDER

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-lg",
            "hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-all duration-200",
            className
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "min-w-[18px] h-[18px] px-1",
                "flex items-center justify-center",
                "text-[12px] font-semibold text-white",
                " bg-primary ",
                "rounded-full shadow-sm",
                "animate-in zoom-in-50 duration-200"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}

          {/* Pulse animation for new notifications */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "w-[18px] h-[18px]",
                " bg-primary ",
                "rounded-full",
                "animate-ping opacity-75"
              )}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[380px] p-0",
          "bg-popover/95 backdrop-blur-xl",
          "border border-border/50 shadow-xl rounded-xl",
          "animate-in slide-in-from-top-2 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({unreadCount} unread)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mark all as read button */}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllRead}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {isMarkingAllRead ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                )}
                Mark all read
              </Button>
            )}

            {/* Settings link */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
            >
              <Link href="/dashboard/settings/notifications">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Notification settings</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Notification list */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            // Loading skeletons
            <div className="divide-y divide-border/30">
              {[...Array(3)].map((_, i) => (
                <NotificationItemSkeleton key={i} compact />
              ))}
            </div>
          ) : hasError && notifications.length === 0 ? (
            // Error state - distinguishes a failed fetch from "no notifications"
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load notifications
              </p>
            </div>
          ) : notifications.length === 0 ? (
            // Empty state
            <NotificationEmptyState />
          ) : (
            // Notifications list
            <div className="divide-y divide-border/30">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onClick={handleNotificationClick}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full h-9 text-sm",
                  "text-primary hover:text-primary hover:bg-primary/10",
                  "transition-colors duration-200"
                )}
                asChild
              >
                <Link href="/dashboard/notifications">
                  View all notifications
                </Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
