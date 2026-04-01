"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, AlertCircle, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Priority,
  type UrgencyLevel,
  getPriorityConfig,
  getDeadlineInfo,
  getUrgencyLevelClasses,
  formatTimeRemainingText,
} from "@/lib/deadline-utils";

interface PriorityIndicatorProps {
  priority: Priority;
  deadline?: string | Date | null;
  showLabel?: boolean;
  showCountdown?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Visual priority indicator with color coding and animations
 */
export function PriorityIndicator({
  priority,
  deadline,
  showLabel = true,
  showCountdown = false,
  size = "md",
  className,
}: PriorityIndicatorProps) {
  const config = getPriorityConfig(priority);
  const deadlineInfo = deadline ? getDeadlineInfo(deadline, priority) : null;

  const sizeClasses = {
    sm: "h-4 text-[10px] px-1.5 gap-0.5",
    md: "h-5 text-xs px-2 gap-1",
    lg: "h-6 text-sm px-2.5 gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  const PriorityIcon = priority === "URGENT" ? Flame : AlertCircle;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {/* Priority Badge */}
      {config.showIndicator && (
        <Badge
          variant="outline"
          className={cn(
            sizeClasses[size],
            config.bgColor,
            config.borderColor,
            config.textColor,
            "font-medium transition-all",
            config.animate && "animate-pulse"
          )}
        >
          <PriorityIcon className={iconSizes[size]} />
          {showLabel && <span>{config.label}</span>}
        </Badge>
      )}

      {/* Countdown */}
      {showCountdown && deadlineInfo && (
        <DeadlineCountdown
          deadlineInfo={deadlineInfo}
          size={size}
        />
      )}
    </div>
  );
}

interface DeadlineCountdownProps {
  deadline?: string | Date | null;
  priority?: Priority;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

/**
 * Deadline countdown display with urgency-based styling
 */
export function DeadlineCountdown({
  deadline,
  deadlineInfo: propDeadlineInfo,
  priority = "NORMAL",
  size = "md",
  showIcon = true,
  className,
}: DeadlineCountdownProps & { deadlineInfo?: ReturnType<typeof getDeadlineInfo> }) {
  const deadlineInfo = propDeadlineInfo || (deadline ? getDeadlineInfo(deadline, priority) : null);

  if (!deadlineInfo) return null;

  const urgencyClasses = getUrgencyLevelClasses(deadlineInfo.urgencyLevel);

  const sizeClasses = {
    sm: "text-[10px] gap-0.5",
    md: "text-xs gap-1",
    lg: "text-sm gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  const Icon = deadlineInfo.isOverdue ? AlertTriangle : Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        sizeClasses[size],
        urgencyClasses.text,
        deadlineInfo.isOverdue && "animate-pulse",
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{deadlineInfo.relativeText}</span>
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

/**
 * Simple priority badge without deadline information
 */
export function PriorityBadge({
  priority,
  size = "md",
  showIcon = true,
  className,
}: PriorityBadgeProps) {
  const config = getPriorityConfig(priority);

  const sizeClasses = {
    sm: "h-4 text-[10px] px-1.5 gap-0.5",
    md: "h-5 text-xs px-2 gap-1",
    lg: "h-6 text-sm px-2.5 gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  const PriorityIcon = priority === "URGENT" ? Flame : AlertCircle;

  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        config.bgColor,
        config.borderColor,
        config.textColor,
        "font-medium transition-all",
        config.animate && "animate-pulse",
        className
      )}
    >
      {showIcon && <PriorityIcon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </Badge>
  );
}

interface OverdueWarningProps {
  deadline: string | Date | null;
  className?: string;
}

/**
 * Overdue warning banner
 */
export function OverdueWarning({ deadline, className }: OverdueWarningProps) {
  const deadlineInfo = deadline ? getDeadlineInfo(deadline) : null;

  if (!deadlineInfo?.isOverdue) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-red-100 dark:bg-red-900/30",
        "border border-red-200 dark:border-red-800",
        "text-red-700 dark:text-red-400",
        "animate-pulse",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium">
        Overdue by {deadlineInfo.relativeText}
      </span>
    </div>
  );
}

interface PriorityDotProps {
  priority: Priority;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}

/**
 * Simple priority dot indicator
 */
export function PriorityDot({
  priority,
  size = "md",
  animate: forceAnimate,
  className,
}: PriorityDotProps) {
  const config = getPriorityConfig(priority);
  const shouldAnimate = forceAnimate ?? config.animate;

  const dotColors: Record<Priority, string> = {
    URGENT: "bg-red-500",
    HIGH: "bg-orange-500",
    NORMAL: "bg-blue-500",
    LOW: "bg-gray-400",
  };

  const sizeClasses = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizeClasses[size],
        dotColors[priority],
        shouldAnimate && "animate-pulse",
        className
      )}
    />
  );
}

interface DeadlineDisplayProps {
  deadline: string | Date | null;
  priority?: Priority;
  showRelative?: boolean;
  showAbsolute?: boolean;
  className?: string;
}

/**
 * Full deadline display with relative and absolute time
 */
export function DeadlineDisplay({
  deadline,
  priority = "NORMAL",
  showRelative = true,
  showAbsolute = true,
  className,
}: DeadlineDisplayProps) {
  const deadlineInfo = deadline ? getDeadlineInfo(deadline, priority) : null;

  if (!deadlineInfo) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)}>
        No deadline
      </span>
    );
  }

  const urgencyClasses = getUrgencyLevelClasses(deadlineInfo.urgencyLevel);

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {showRelative && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            urgencyClasses.text,
            deadlineInfo.isOverdue && "animate-pulse"
          )}
        >
          {deadlineInfo.isOverdue ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          <span>{deadlineInfo.relativeText}</span>
        </div>
      )}
      {showAbsolute && (
        <span className="text-xs text-muted-foreground">
          {deadlineInfo.displayText}
        </span>
      )}
    </div>
  );
}

interface UrgentPulseProps {
  children: React.ReactNode;
  isUrgent: boolean;
  className?: string;
}

/**
 * Wrapper component that adds pulse animation for urgent items
 */
export function UrgentPulse({ children, isUrgent, className }: UrgentPulseProps) {
  if (!isUrgent) return <>{children}</>;

  return (
    <div
      className={cn(
        "relative",
        className
      )}
    >
      {/* Pulse ring effect */}
      <div className="absolute inset-0 rounded-lg bg-red-500/10 animate-ping opacity-25" />
      <div className="relative">{children}</div>
    </div>
  );
}

interface PriorityAndDeadlineProps {
  priority: Priority;
  deadline?: string | Date | null;
  compact?: boolean;
  className?: string;
}

/**
 * Combined priority and deadline indicator
 */
export function PriorityAndDeadline({
  priority,
  deadline,
  compact = false,
  className,
}: PriorityAndDeadlineProps) {
  const config = getPriorityConfig(priority);
  const deadlineInfo = deadline ? getDeadlineInfo(deadline, priority) : null;
  const urgencyClasses = deadlineInfo
    ? getUrgencyLevelClasses(deadlineInfo.urgencyLevel)
    : null;

  const isUrgentOrOverdue =
    priority === "URGENT" || deadlineInfo?.isOverdue;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <PriorityDot priority={priority} />
        {deadlineInfo && (
          <span
            className={cn(
              "text-xs",
              urgencyClasses?.text,
              deadlineInfo.isOverdue && "font-medium"
            )}
          >
            {deadlineInfo.relativeText}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        isUrgentOrOverdue && "animate-pulse",
        className
      )}
    >
      {config.showIndicator && (
        <PriorityBadge priority={priority} size="sm" />
      )}
      {deadlineInfo && (
        <DeadlineCountdown
          deadlineInfo={deadlineInfo}
          size="sm"
          showIcon={!config.showIndicator}
        />
      )}
    </div>
  );
}
