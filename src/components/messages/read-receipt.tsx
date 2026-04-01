"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, Eye } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// Read receipt status types
export type ReadStatus = "sending" | "delivered" | "read";

export interface ReadReceipt {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userEmail?: string;
  readAt: Date;
}

interface ReadReceiptIndicatorProps {
  status: ReadStatus;
  readAt?: Date | null;
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "subtle" | "minimal";
}

// Simple tooltip wrapper component
function SimpleTooltip({
  children,
  content,
  side = "top",
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={<span className="inline-flex" />}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={4}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md border border-border/50",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-popover [&>path]:stroke-border" />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/**
 * Read receipt indicator component
 * Shows single check for delivered, double check for read
 * With animated transitions and timestamp on hover
 */
export function ReadReceiptIndicator({
  status,
  readAt,
  className,
  showLabel = false,
  variant = "default",
}: ReadReceiptIndicatorProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case "sending":
        return {
          icon: Check,
          label: "Sending...",
          color: "text-muted-foreground/50",
          animate: true,
        };
      case "delivered":
        return {
          icon: Check,
          label: "Delivered",
          color: "text-muted-foreground/70",
          animate: false,
        };
      case "read":
        return {
          icon: CheckCheck,
          label: "Read",
          color: "text-primary",
          animate: false,
        };
      default:
        return {
          icon: Check,
          label: "Sent",
          color: "text-muted-foreground/50",
          animate: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    default: "h-4 w-4",
    subtle: "h-3.5 w-3.5",
    minimal: "h-3 w-3",
  };

  const tooltipContent = (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{config.label}</span>
      {readAt && status === "read" && (
        <span className="text-muted-foreground">
          {format(readAt, "MMM d, h:mm a")}
        </span>
      )}
    </div>
  );

  return (
    <SimpleTooltip content={tooltipContent} side="top">
      <div
        className={cn(
          "inline-flex items-center gap-1 transition-all duration-200 cursor-default",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Icon
          className={cn(
            sizeClasses[variant],
            config.color,
            "transition-all duration-300 ease-out",
            config.animate && "animate-pulse",
            status === "read" && "scale-100",
            isHovered && "scale-110"
          )}
        />
        {showLabel && (
          <span
            className={cn(
              "text-xs transition-opacity duration-200",
              config.color
            )}
          >
            {config.label}
          </span>
        )}
      </div>
    </SimpleTooltip>
  );
}

interface SeenByIndicatorProps {
  readers: ReadReceipt[];
  maxAvatars?: number;
  className?: string;
  showTimestamp?: boolean;
  compact?: boolean;
}

/**
 * "Seen by" indicator for group chats
 * Shows avatars of users who have read the message
 */
export function SeenByIndicator({
  readers,
  maxAvatars = 3,
  className,
  showTimestamp = true,
  compact = false,
}: SeenByIndicatorProps) {
  if (readers.length === 0) {
    return null;
  }

  const visibleReaders = readers.slice(0, maxAvatars);
  const remainingCount = readers.length - maxAvatars;
  const latestRead = readers.reduce((latest, reader) =>
    new Date(reader.readAt) > new Date(latest.readAt) ? reader : latest
  );

  const compactTooltipContent = (
    <div className="space-y-1">
      <p className="font-medium text-xs">Seen by</p>
      <div className="flex flex-wrap gap-1">
        {readers.map((reader) => (
          <Badge
            key={reader.userId}
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
          >
            {reader.userName}
          </Badge>
        ))}
      </div>
    </div>
  );

  if (compact) {
    return (
      <SimpleTooltip content={compactTooltipContent} side="top">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-default",
            className
          )}
        >
          <Eye className="h-3 w-3" />
          <span>{readers.length}</span>
        </div>
      </SimpleTooltip>
    );
  }

  const fullTooltipContent = (
    <div className="space-y-2">
      <p className="font-medium text-xs">Seen by {readers.length}</p>
      <div className="space-y-1">
        {readers.slice(0, 5).map((reader) => (
          <div
            key={reader.userId}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span>{reader.userName}</span>
            <span className="text-muted-foreground">
              {format(new Date(reader.readAt), "h:mm a")}
            </span>
          </div>
        ))}
        {readers.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{readers.length - 5} more
          </p>
        )}
      </div>
    </div>
  );

  return (
    <SimpleTooltip content={fullTooltipContent} side="top">
      <div
        className={cn(
          "flex items-center gap-2 transition-opacity duration-200 hover:opacity-100 cursor-default",
          className
        )}
      >
        <AvatarGroup>
          {visibleReaders.map((reader) => (
            <Avatar
              key={reader.userId}
              size="xs"
              user={{
                name: reader.userName,
                email: reader.userEmail || "",
                image: reader.userAvatar,
              }}
              ring="white"
            />
          ))}
          {remainingCount > 0 && (
            <AvatarGroupCount count={remainingCount} size="xs" />
          )}
        </AvatarGroup>
        {showTimestamp && (
          <span className="text-[10px] text-muted-foreground">
            Seen {formatDistanceToNow(new Date(latestRead.readAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </SimpleTooltip>
  );
}

interface LastSeenIndicatorProps {
  lastActiveAt: Date | null;
  isOnline?: boolean;
  className?: string;
}

/**
 * Last seen timestamp indicator
 * Shows when user was last active
 */
export function LastSeenIndicator({
  lastActiveAt,
  isOnline = false,
  className,
}: LastSeenIndicatorProps) {
  if (isOnline) {
    return (
      <span className={cn("text-xs text-emerald-500 font-medium", className)}>
        Online
      </span>
    );
  }

  if (!lastActiveAt) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Offline
      </span>
    );
  }

  const now = new Date();
  const lastSeen = new Date(lastActiveAt);
  const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);

  // Within the last hour - show "X minutes ago"
  if (diffMinutes < 60) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Last seen {diffMinutes === 0 ? "just now" : `${diffMinutes}m ago`}
      </span>
    );
  }

  // Within today - show time
  if (lastSeen.toDateString() === now.toDateString()) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Last seen at {format(lastSeen, "h:mm a")}
      </span>
    );
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastSeen.toDateString() === yesterday.toDateString()) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Last seen yesterday at {format(lastSeen, "h:mm a")}
      </span>
    );
  }

  // More than a day ago
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      Last seen {format(lastSeen, "MMM d")}
    </span>
  );
}

interface RequestViewedIndicatorProps {
  viewedAt: Date | string | null;
  viewedBy?: string;
  className?: string;
  showTimestamp?: boolean;
}

/**
 * Request viewed indicator
 * Shows when a creator viewed a request
 */
export function RequestViewedIndicator({
  viewedAt,
  viewedBy,
  className,
  showTimestamp = true,
}: RequestViewedIndicatorProps) {
  if (!viewedAt) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-muted-foreground border-muted-foreground/30",
          className
        )}
      >
        <Eye className="h-3 w-3 mr-1 opacity-50" />
        Not viewed
      </Badge>
    );
  }

  const viewDate = typeof viewedAt === "string" ? new Date(viewedAt) : viewedAt;

  const tooltipContent = (
    <div className="flex flex-col gap-0.5">
      {viewedBy && <span className="font-medium">Viewed by {viewedBy}</span>}
      {showTimestamp && (
        <span className="text-muted-foreground">
          {format(viewDate, "MMM d, yyyy 'at' h:mm a")}
        </span>
      )}
    </div>
  );

  return (
    <SimpleTooltip content={tooltipContent} side="top">
      <Badge
        variant="secondary"
        className={cn(
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 cursor-default",
          className
        )}
      >
        <Eye className="h-3 w-3 mr-1" />
        Viewed
      </Badge>
    </SimpleTooltip>
  );
}

// Hook for managing read receipt state
export function useReadReceipts(initialReaders: ReadReceipt[] = []) {
  const [readers, setReaders] = React.useState<ReadReceipt[]>(initialReaders);
  const [isMarkingRead, setIsMarkingRead] = React.useState(false);

  const addReader = React.useCallback((reader: ReadReceipt) => {
    setReaders((prev) => {
      // Don't add duplicate readers
      if (prev.some((r) => r.userId === reader.userId)) {
        return prev;
      }
      return [...prev, reader];
    });
  }, []);

  const markAsRead = React.useCallback(
    async (messageId: string, userId: string): Promise<boolean> => {
      setIsMarkingRead(true);
      try {
        const response = await fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, userId }),
        });

        if (!response.ok) {
          throw new Error("Failed to mark as read");
        }

        return true;
      } catch (error) {
        console.error("Error marking message as read:", error);
        return false;
      } finally {
        setIsMarkingRead(false);
      }
    },
    []
  );

  return {
    readers,
    addReader,
    markAsRead,
    isMarkingRead,
    hasReaders: readers.length > 0,
  };
}

// Privacy-respecting read receipts hook
export interface ReadReceiptSettings {
  sendReadReceipts: boolean;
  showReadReceipts: boolean;
}

export function useReadReceiptSettings() {
  const [settings, setSettings] = React.useState<ReadReceiptSettings>({
    sendReadReceipts: true,
    showReadReceipts: true,
  });

  // Load settings from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("readReceiptSettings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  const updateSettings = React.useCallback(
    (newSettings: Partial<ReadReceiptSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        localStorage.setItem("readReceiptSettings", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  return { settings, updateSettings };
}

export default ReadReceiptIndicator;
