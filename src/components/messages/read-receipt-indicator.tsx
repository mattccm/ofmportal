"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, Clock, X, Monitor, Smartphone, Tablet } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import {
  ReadReceiptWithUser,
  ReadStatusDisplay,
  ReadStatusInfo,
  DEVICE_TYPE_ICONS,
} from "@/types/read-receipts";
import { useReadReceipts } from "@/hooks/use-read-receipts";

// ============================================================================
// Tooltip Wrapper Component
// ============================================================================

function ReadReceiptTooltip({
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
      <TooltipPrimitive.Trigger render={<span className="inline-flex cursor-default" />}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={4}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 overflow-hidden rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md border border-border/50",
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

// ============================================================================
// Status Icon Component
// ============================================================================

interface StatusIconProps {
  status: ReadStatusDisplay;
  className?: string;
  animate?: boolean;
}

function StatusIcon({ status, className, animate }: StatusIconProps) {
  const baseClasses = cn(
    "transition-all duration-300 ease-out",
    animate && "animate-pulse",
    className
  );

  switch (status) {
    case "sending":
      return <Clock className={cn(baseClasses, "text-muted-foreground/50")} />;
    case "sent":
      return <Check className={cn(baseClasses, "text-muted-foreground/70")} />;
    case "delivered":
      return <Check className={cn(baseClasses, "text-muted-foreground")} />;
    case "read":
      return <CheckCheck className={cn(baseClasses, "text-primary")} />;
    case "read_all":
      return <CheckCheck className={cn(baseClasses, "text-primary fill-primary/20")} />;
    case "failed":
      return <X className={cn(baseClasses, "text-destructive")} />;
    default:
      return <Check className={cn(baseClasses, "text-muted-foreground/50")} />;
  }
}

// ============================================================================
// Device Icon Component
// ============================================================================

interface DeviceIconProps {
  deviceType?: "desktop" | "mobile" | "tablet";
  className?: string;
}

function DeviceIcon({ deviceType, className }: DeviceIconProps) {
  if (!deviceType) return null;

  const iconMap = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
  };

  const Icon = iconMap[deviceType];
  return <Icon className={cn("h-3 w-3 text-muted-foreground", className)} />;
}

// ============================================================================
// Main Read Receipt Indicator Component
// ============================================================================

interface ReadReceiptIndicatorProps {
  // Message identification
  messageId?: string;
  requestId?: string;
  commentId?: string;

  // Status override (if you want to manually control status)
  status?: ReadStatusDisplay;

  // Recipients (for calculating if all have read)
  totalRecipients?: number;

  // Readers data (if you already have it)
  readers?: ReadReceiptWithUser[];

  // User info for marking as read
  userId?: string;
  userName?: string;
  userAvatar?: string;

  // Display options
  showAvatars?: boolean;
  maxAvatars?: number;
  showTimestamp?: boolean;
  showLabel?: boolean;
  variant?: "default" | "subtle" | "minimal";
  size?: "sm" | "md" | "lg";

  // Callbacks
  onClick?: () => void;

  className?: string;
}

export function ReadReceiptIndicator({
  messageId,
  requestId,
  commentId,
  status: statusOverride,
  totalRecipients,
  readers: readersOverride,
  userId,
  userName,
  userAvatar,
  showAvatars = false,
  maxAvatars = 3,
  showTimestamp = false,
  showLabel = false,
  variant = "default",
  size = "md",
  onClick,
  className,
}: ReadReceiptIndicatorProps) {
  const { receipts, isLoading } = useReadReceipts({
    messageId,
    requestId,
    commentId,
    userId,
    userName,
    userAvatar,
    enablePolling: !readersOverride,
  });

  const readers = readersOverride || receipts;
  const isHovered = React.useRef(false);
  const [hoverState, setHoverState] = React.useState(false);

  // Determine status
  const determineStatus = (): ReadStatusDisplay => {
    if (statusOverride) return statusOverride;
    if (isLoading) return "sending";
    if (readers.length === 0) return "delivered";
    if (totalRecipients && readers.length >= totalRecipients) return "read_all";
    return "read";
  };

  const status = determineStatus();

  // Get status info
  const getStatusInfo = (): ReadStatusInfo => {
    const baseInfo = {
      readers,
      readCount: readers.length,
      totalRecipients,
    };

    switch (status) {
      case "sending":
        return {
          ...baseInfo,
          status: "sending",
          label: "Sending...",
          icon: "clock",
          color: "muted",
        };
      case "sent":
        return {
          ...baseInfo,
          status: "sent",
          label: "Sent",
          icon: "check",
          color: "muted",
        };
      case "delivered":
        return {
          ...baseInfo,
          status: "delivered",
          label: "Delivered",
          icon: "check",
          color: "default",
        };
      case "read":
        return {
          ...baseInfo,
          status: "read",
          label: `Read${readers.length > 1 ? ` by ${readers.length}` : ""}`,
          icon: "check-check",
          color: "primary",
        };
      case "read_all":
        return {
          ...baseInfo,
          status: "read_all",
          label: `Read by all`,
          icon: "check-check-filled",
          color: "primary",
        };
      case "failed":
        return {
          ...baseInfo,
          status: "failed",
          label: "Failed to send",
          icon: "x",
          color: "destructive",
        };
      default:
        return {
          ...baseInfo,
          status: "sent",
          label: "Sent",
          icon: "check",
          color: "muted",
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Size classes
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Get most recent read time
  const getMostRecentRead = (): Date | null => {
    if (readers.length === 0) return null;
    return readers.reduce((latest, reader) => {
      const readDate = new Date(reader.readAt);
      return !latest || readDate > latest ? readDate : latest;
    }, null as Date | null);
  };

  const mostRecentRead = getMostRecentRead();

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-2 min-w-[150px]">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">{statusInfo.label}</span>
        {mostRecentRead && (
          <span className="text-muted-foreground text-[10px]">
            {format(mostRecentRead, "h:mm a")}
          </span>
        )}
      </div>

      {readers.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Seen by {readers.length} {readers.length === 1 ? "person" : "people"}
          </span>
          <div className="space-y-1">
            {readers.slice(0, 5).map((reader) => (
              <div
                key={reader.userId}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    size="xs"
                    user={{
                      name: reader.userName,
                      image: reader.userAvatar,
                    }}
                  />
                  <span className="text-xs">{reader.userName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DeviceIcon deviceType={reader.deviceType} />
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(reader.readAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            {readers.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{readers.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ReadReceiptTooltip content={tooltipContent} side="top">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 transition-all duration-200",
          onClick && "cursor-pointer hover:opacity-80",
          className
        )}
        onClick={onClick}
        onMouseEnter={() => {
          isHovered.current = true;
          setHoverState(true);
        }}
        onMouseLeave={() => {
          isHovered.current = false;
          setHoverState(false);
        }}
      >
        {/* Status Icon */}
        <StatusIcon
          status={status}
          className={cn(
            sizeClasses[size],
            hoverState && "scale-110"
          )}
          animate={status === "sending"}
        />

        {/* Avatars (optional) */}
        {showAvatars && readers.length > 0 && (
          <AvatarGroup>
            {readers.slice(0, maxAvatars).map((reader) => (
              <Avatar
                key={reader.userId}
                size="xs"
                user={{
                  name: reader.userName,
                  image: reader.userAvatar,
                }}
                ring="white"
              />
            ))}
            {readers.length > maxAvatars && (
              <AvatarGroupCount count={readers.length - maxAvatars} size="xs" />
            )}
          </AvatarGroup>
        )}

        {/* Label (optional) */}
        {showLabel && (
          <span
            className={cn(
              "text-xs transition-opacity duration-200",
              status === "read" || status === "read_all"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {statusInfo.label}
          </span>
        )}

        {/* Timestamp (optional) */}
        {showTimestamp && mostRecentRead && (
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(mostRecentRead, { addSuffix: true })}
          </span>
        )}
      </div>
    </ReadReceiptTooltip>
  );
}

// ============================================================================
// Seen By Component (for group messages)
// ============================================================================

interface SeenByAvatarsProps {
  readers: ReadReceiptWithUser[];
  maxAvatars?: number;
  showCount?: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export function SeenByAvatars({
  readers,
  maxAvatars = 4,
  showCount = true,
  showTimestamp = true,
  className,
}: SeenByAvatarsProps) {
  if (readers.length === 0) return null;

  const visibleReaders = readers.slice(0, maxAvatars);
  const hiddenCount = readers.length - maxAvatars;

  const latestRead = readers.reduce((latest, reader) => {
    const readDate = new Date(reader.readAt);
    return !latest || readDate > latest ? readDate : latest;
  }, null as Date | null);

  const tooltipContent = (
    <div className="space-y-2">
      <span className="font-medium">Seen by {readers.length}</span>
      <div className="space-y-1">
        {readers.map((reader) => (
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
      </div>
    </div>
  );

  return (
    <ReadReceiptTooltip content={tooltipContent} side="top">
      <div className={cn("flex items-center gap-2", className)}>
        <AvatarGroup>
          {visibleReaders.map((reader) => (
            <Avatar
              key={reader.userId}
              size="xs"
              user={{
                name: reader.userName,
                image: reader.userAvatar,
              }}
              ring="white"
            />
          ))}
          {hiddenCount > 0 && (
            <AvatarGroupCount count={hiddenCount} size="xs" />
          )}
        </AvatarGroup>

        {showCount && readers.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Seen by {readers.length}
          </span>
        )}

        {showTimestamp && latestRead && (
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(latestRead, { addSuffix: true })}
          </span>
        )}
      </div>
    </ReadReceiptTooltip>
  );
}

// ============================================================================
// Inline Read Status (compact for message lists)
// ============================================================================

interface InlineReadStatusProps {
  messageId?: string;
  status?: ReadStatusDisplay;
  readers?: ReadReceiptWithUser[];
  className?: string;
}

export function InlineReadStatus({
  messageId,
  status: statusOverride,
  readers: readersOverride,
  className,
}: InlineReadStatusProps) {
  const { receipts } = useReadReceipts({
    messageId,
    enablePolling: !readersOverride,
  });

  const readers = readersOverride || receipts;
  const status = statusOverride || (readers.length > 0 ? "read" : "delivered");

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <StatusIcon status={status} className="h-3 w-3" />
      {readers.length > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {readers.length}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Message Read Receipt Footer
// ============================================================================

interface MessageReadReceiptFooterProps {
  messageId?: string;
  requestId?: string;
  commentId?: string;
  readers?: ReadReceiptWithUser[];
  totalRecipients?: number;
  sentAt?: Date;
  className?: string;
}

export function MessageReadReceiptFooter({
  messageId,
  requestId,
  commentId,
  readers: readersOverride,
  totalRecipients,
  sentAt,
  className,
}: MessageReadReceiptFooterProps) {
  const { receipts } = useReadReceipts({
    messageId,
    requestId,
    commentId,
    enablePolling: !readersOverride,
  });

  const readers = readersOverride || receipts;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-xs text-muted-foreground",
        className
      )}
    >
      {/* Timestamp */}
      {sentAt && (
        <span className="text-[10px]">{format(sentAt, "h:mm a")}</span>
      )}

      {/* Read receipt indicator */}
      <ReadReceiptIndicator
        messageId={messageId}
        requestId={requestId}
        commentId={commentId}
        readers={readers}
        totalRecipients={totalRecipients}
        showAvatars={readers.length > 0 && readers.length <= 3}
        maxAvatars={3}
        size="sm"
      />
    </div>
  );
}

export default ReadReceiptIndicator;
