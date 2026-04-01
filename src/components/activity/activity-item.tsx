"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileCheck,
  FileX,
  MessageSquare,
  MessageCircle,
  Users,
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  Download,
  Edit,
  Trash2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type ActivityType =
  | "upload_new"
  | "upload_approved"
  | "upload_rejected"
  | "upload_pending"
  | "request_created"
  | "request_sent"
  | "request_completed"
  | "request_expired"
  | "request_viewed"
  | "comment_new"
  | "message_new"
  | "message_reply"
  | "team_member_added"
  | "team_member_removed"
  | "team_member_role_changed"
  | "file_downloaded"
  | "file_edited"
  | "file_deleted"
  | "bulk_action";

export interface ActivityUser {
  id: string;
  name: string | null;
  email?: string | null;
  image?: string | null;
}

export interface ActivityItemData {
  id: string;
  type: ActivityType;
  title: string;
  description?: string | null;
  timestamp: Date;
  user?: ActivityUser | null;
  metadata?: {
    requestId?: string;
    requestTitle?: string;
    uploadId?: string;
    uploadName?: string;
    creatorId?: string;
    creatorName?: string;
    commentId?: string;
    messageId?: string;
    teamMemberId?: string;
    teamMemberName?: string;
    count?: number;
    oldRole?: string;
    newRole?: string;
  };
  href?: string;
  isRead?: boolean;
}

interface ActivityItemProps {
  activity: ActivityItemData;
  onClick?: () => void;
  showAvatar?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================
// ACTIVITY CONFIG
// ============================================

interface ActivityConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

const activityConfig: Record<ActivityType, ActivityConfig> = {
  // Upload activities
  upload_new: {
    icon: Upload,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  upload_approved: {
    icon: FileCheck,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  upload_rejected: {
    icon: FileX,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    badgeVariant: "destructive",
  },
  upload_pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },

  // Request activities
  request_created: {
    icon: FileCheck,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
  request_sent: {
    icon: Send,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  request_completed: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  request_expired: {
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  request_viewed: {
    icon: Eye,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-900/30",
  },

  // Comment activities
  comment_new: {
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },

  // Message activities
  message_new: {
    icon: MessageCircle,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  message_reply: {
    icon: MessageCircle,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },

  // Team activities
  team_member_added: {
    icon: UserPlus,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  team_member_removed: {
    icon: UserMinus,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  team_member_role_changed: {
    icon: Users,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },

  // File activities
  file_downloaded: {
    icon: Download,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-900/30",
  },
  file_edited: {
    icon: Edit,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  file_deleted: {
    icon: Trash2,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    badgeVariant: "destructive",
  },

  // Bulk activities
  bulk_action: {
    icon: RefreshCw,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
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
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================
// ACTIVITY ITEM COMPONENT
// ============================================

export const ActivityItem = forwardRef<HTMLDivElement, ActivityItemProps>(
  function ActivityItem(
    { activity, onClick, showAvatar = true, compact = false, className },
    ref
  ) {
    const config = activityConfig[activity.type];
    const Icon = config.icon;

    const content = (
      <div
        ref={ref}
        className={cn(
          "group relative flex gap-3 rounded-lg transition-all duration-200",
          "hover:bg-muted/50",
          compact ? "px-2 py-2" : "px-3 py-3",
          !activity.isRead && "bg-primary/5",
          activity.href && "cursor-pointer",
          className
        )}
        onClick={onClick}
        role={activity.href ? "button" : undefined}
        tabIndex={activity.href ? 0 : undefined}
      >
        {/* Icon or Avatar */}
        <div className="relative flex-shrink-0">
          {showAvatar && activity.user ? (
            <div className="relative">
              <Avatar
                user={activity.user}
                size={compact ? "xs" : "sm"}
                className="ring-2 ring-background"
              />
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full",
                  "ring-2 ring-background",
                  config.bgColor,
                  compact ? "h-4 w-4" : "h-5 w-5"
                )}
              >
                <Icon
                  className={cn(
                    config.color,
                    compact ? "h-2.5 w-2.5" : "h-3 w-3"
                  )}
                />
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-lg",
                config.bgColor,
                compact ? "h-7 w-7" : "h-9 w-9"
              )}
            >
              <Icon
                className={cn(
                  config.color,
                  compact ? "h-3.5 w-3.5" : "h-4 w-4"
                )}
              />
            </div>
          )}

          {/* Unread indicator */}
          {!activity.isRead && (
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Title */}
          <p
            className={cn(
              "font-medium leading-snug",
              compact ? "text-xs" : "text-sm",
              !activity.isRead
                ? "text-foreground"
                : "text-foreground/80"
            )}
          >
            {activity.title}
          </p>

          {/* Description (if not compact) */}
          {!compact && activity.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {activity.description}
            </p>
          )}

          {/* Metadata badges */}
          {!compact && activity.metadata && (
            <div className="flex flex-wrap gap-1 mt-1">
              {activity.metadata.requestTitle && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {activity.metadata.requestTitle}
                </Badge>
              )}
              {activity.metadata.creatorName && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {activity.metadata.creatorName}
                </Badge>
              )}
              {activity.metadata.count && activity.metadata.count > 1 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  +{activity.metadata.count - 1} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-muted-foreground whitespace-nowrap",
              compact ? "text-[10px]" : "text-xs"
            )}
            title={formatFullDate(activity.timestamp)}
          >
            {formatRelativeTime(activity.timestamp)}
          </span>

          {/* Status badge for specific types */}
          {config.badgeVariant && (
            <Badge
              variant={config.badgeVariant}
              className={cn("text-[10px] h-4", compact && "hidden")}
            >
              {activity.type.split("_").pop()}
            </Badge>
          )}
        </div>

        {/* Hover indicator */}
        {activity.href && (
          <div className="absolute inset-y-0 right-0 w-1 bg-primary/0 group-hover:bg-primary/50 rounded-r-lg transition-colors" />
        )}
      </div>
    );

    if (activity.href) {
      return (
        <Link href={activity.href} className="block">
          {content}
        </Link>
      );
    }

    return content;
  }
);

// ============================================
// ACTIVITY SKELETON
// ============================================

export function ActivityItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-3 animate-pulse",
        compact ? "px-2 py-2" : "px-3 py-3"
      )}
    >
      <div
        className={cn(
          "rounded-lg bg-muted",
          compact ? "h-7 w-7" : "h-9 w-9"
        )}
      />
      <div className="flex-1 space-y-2">
        <div className={cn("h-4 bg-muted rounded", compact ? "w-3/4" : "w-2/3")} />
        {!compact && <div className="h-3 bg-muted rounded w-1/2" />}
      </div>
      <div className={cn("bg-muted rounded", compact ? "h-3 w-8" : "h-4 w-12")} />
    </div>
  );
}

export default ActivityItem;
