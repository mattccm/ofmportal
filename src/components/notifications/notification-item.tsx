"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  NotificationType,
  getNotificationColor,
  getNotificationGradient,
} from "@/lib/notifications";
import {
  Upload,
  CheckCircle,
  XCircle,
  FilePlus,
  Clock,
  MessageCircle,
  AtSign,
  Mail,
  Info,
  Bell,
} from "lucide-react";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onMarkAsRead?: (id: string) => void;
  onClick?: (notification: NotificationItemData) => void;
  compact?: boolean;
}

// ============================================
// ICON MAPPING
// ============================================

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  [NotificationType.UPLOAD_SUBMITTED]: Upload,
  [NotificationType.UPLOAD_APPROVED]: CheckCircle,
  [NotificationType.UPLOAD_REJECTED]: XCircle,
  [NotificationType.REQUEST_CREATED]: FilePlus,
  [NotificationType.REQUEST_DUE_SOON]: Clock,
  [NotificationType.COMMENT_ADDED]: MessageCircle,
  [NotificationType.MENTION]: AtSign,
  [NotificationType.MESSAGE_RECEIVED]: Mail,
  [NotificationType.SYSTEM]: Info,
};

// ============================================
// TIME AGO FORMATTER
// ============================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  return `${Math.floor(diffInMonths / 12)}y ago`;
}

// ============================================
// NOTIFICATION ITEM COMPONENT
// ============================================

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const router = useRouter();
  const isUnread = notification.readAt === null;
  const IconComponent =
    notificationIcons[notification.type as NotificationType] || Bell;
  const iconColor = getNotificationColor(notification.type as NotificationType);
  const iconGradient = getNotificationGradient(notification.type as NotificationType);

  const handleClick = () => {
    // Mark as read
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // Call custom onClick handler
    if (onClick) {
      onClick(notification);
    }

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Parse the date safely
  const createdAt =
    notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt);

  return (
    <button
      onClick={handleClick}
      aria-label={`${isUnread ? "Unread notification: " : ""}${notification.title}. ${notification.message}. ${formatTimeAgo(createdAt)}`}
      aria-describedby={`notification-${notification.id}-desc`}
      className={cn(
        "w-full text-left transition-all duration-200",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "group relative",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        isUnread && "bg-primary/5"
      )}
    >
      {/* Hidden description for screen readers */}
      <span id={`notification-${notification.id}-desc`} className="sr-only">
        {notification.link ? "Click to view details" : "Notification"}
      </span>

      {/* Unread indicator */}
      {isUnread && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-violet-500"
          aria-hidden="true"
        />
      )}

      <div className={cn("flex gap-3", compact ? "items-center" : "items-start")}>
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 rounded-lg flex items-center justify-center",
            iconGradient,
            compact ? "w-8 h-8" : "w-10 h-10"
          )}
        >
          <IconComponent
            className={cn(iconColor, compact ? "w-4 h-4" : "w-5 h-5")}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "font-medium truncate",
                compact ? "text-xs" : "text-sm",
                isUnread ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {notification.title}
            </p>
            <span
              className={cn(
                "flex-shrink-0 text-muted-foreground",
                compact ? "text-[10px]" : "text-xs"
              )}
            >
              {formatTimeAgo(createdAt)}
            </span>
          </div>

          {!compact && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {notification.message}
            </p>
          )}

          {compact && (
            <p className="text-[11px] text-muted-foreground truncate">
              {notification.message}
            </p>
          )}
        </div>
      </div>

      {/* Hover gradient effect */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
          "bg-gradient-to-r from-primary/5 to-violet-500/5"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

// ============================================
// NOTIFICATION SKELETON
// ============================================

export function NotificationItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex gap-3", compact ? "px-3 py-2.5" : "px-4 py-3")}>
      {/* Icon skeleton */}
      <div
        className={cn(
          "flex-shrink-0 rounded-lg bg-muted animate-pulse",
          compact ? "w-8 h-8" : "w-10 h-10"
        )}
      />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "h-4 bg-muted rounded animate-pulse",
              compact ? "w-24" : "w-32"
            )}
          />
          <div className="h-3 w-10 bg-muted rounded animate-pulse" />
        </div>
        <div
          className={cn(
            "h-3 bg-muted rounded animate-pulse",
            compact ? "w-36" : "w-full"
          )}
        />
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

export function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-3">
        <Bell className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">All caught up!</p>
      <p className="text-xs text-muted-foreground mt-1">
        No new notifications at the moment
      </p>
    </div>
  );
}

export default NotificationItem;
