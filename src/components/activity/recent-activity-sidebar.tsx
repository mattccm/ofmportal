"use client";

import { useState, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ActivityItem,
  ActivityItemSkeleton,
  type ActivityItemData,
} from "./activity-item";
import { useRecentActivity } from "@/hooks/use-recent-activity";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  RefreshCw,
  ExternalLink,
  X,
  Bell,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface RecentActivitySidebarProps {
  /** Maximum number of activities to show */
  maxItems?: number;
  /** Whether to show as a collapsible section */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Whether to show as a floating panel */
  floating?: boolean;
  /** Callback when panel is closed (floating mode) */
  onClose?: () => void;
  /** Custom class name */
  className?: string;
  /** Whether to show compact items */
  compact?: boolean;
  /** Custom title */
  title?: string;
  /** Link for "View all" */
  viewAllHref?: string;
}

interface ActivityGroup {
  label: string;
  activities: ActivityItemData[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function groupActivitiesByTime(activities: ActivityItemData[]): ActivityGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, ActivityItemData[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    lastWeek: [],
    older: [],
  };

  activities.forEach((activity) => {
    const activityDate = new Date(activity.timestamp);
    const activityDay = new Date(
      activityDate.getFullYear(),
      activityDate.getMonth(),
      activityDate.getDate()
    );

    if (activityDay.getTime() >= today.getTime()) {
      groups.today.push(activity);
    } else if (activityDay.getTime() >= yesterday.getTime()) {
      groups.yesterday.push(activity);
    } else if (activityDay.getTime() >= thisWeekStart.getTime()) {
      groups.thisWeek.push(activity);
    } else if (activityDay.getTime() >= lastWeekStart.getTime()) {
      groups.lastWeek.push(activity);
    } else {
      groups.older.push(activity);
    }
  });

  const result: ActivityGroup[] = [];

  if (groups.today.length > 0) {
    result.push({ label: "Today", activities: groups.today });
  }
  if (groups.yesterday.length > 0) {
    result.push({ label: "Yesterday", activities: groups.yesterday });
  }
  if (groups.thisWeek.length > 0) {
    result.push({ label: "This Week", activities: groups.thisWeek });
  }
  if (groups.lastWeek.length > 0) {
    result.push({ label: "Last Week", activities: groups.lastWeek });
  }
  if (groups.older.length > 0) {
    result.push({ label: "Older", activities: groups.older });
  }

  return result;
}

// ============================================
// COLLAPSIBLE GROUP COMPONENT
// ============================================

interface ActivityGroupSectionProps {
  group: ActivityGroup;
  compact?: boolean;
  defaultExpanded?: boolean;
}

function ActivityGroupSection({
  group,
  compact = false,
  defaultExpanded = true,
}: ActivityGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
          "text-muted-foreground/70 hover:text-muted-foreground",
          "transition-colors duration-200"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>{group.label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
          {group.activities.length}
        </Badge>
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {group.activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              compact={compact}
              showAvatar={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export function RecentActivitySidebar({
  maxItems = 20,
  collapsible = true,
  defaultCollapsed = false,
  floating = false,
  onClose,
  className,
  compact = false,
  title = "Recent Activity",
  viewAllHref = "/dashboard/notifications",
}: RecentActivitySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const {
    activities,
    isLoading,
    error,
    unreadCount,
    refresh,
    isRefreshing,
  } = useRecentActivity({ limit: maxItems });

  // Group activities by time
  const groupedActivities = useMemo(
    () => groupActivitiesByTime(activities),
    [activities]
  );

  // Floating panel variant
  if (floating) {
    return (
      <Card
        className={cn(
          "fixed right-4 top-20 z-50 w-80 max-h-[calc(100vh-120px)]",
          "shadow-xl border-border/50",
          "animate-in slide-in-from-right-4 fade-in duration-300",
          className
        )}
      >
        <CardHeader className="border-b pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
              className="h-7 w-7 p-0"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto max-h-[400px] scrollbar-thin">
          {isLoading ? (
            <div className="p-2 space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <ActivityItemSkeleton key={i} compact={compact} />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={refresh} className="mt-2">
                Try again
              </Button>
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="py-2 space-y-3">
              {groupedActivities.map((group) => (
                <ActivityGroupSection
                  key={group.label}
                  group={group}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </CardContent>

        {activities.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="w-full justify-center text-xs"
            >
              <Link href={viewAllHref}>
                View all activity
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </Card>
    );
  }

  // Collapsible sidebar section variant
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-3",
          collapsible && "cursor-pointer hover:bg-muted/50 transition-colors",
          !isCollapsed && "border-b"
        )}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <div className="text-muted-foreground">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">{title}</span>
          {unreadCount > 0 && (
            <Badge variant="default" className="text-[10px] h-5 px-1.5">
              {unreadCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            disabled={isRefreshing}
            className="h-7 w-7 p-0"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <>
          <div className="overflow-y-auto max-h-[400px] scrollbar-thin">
            {isLoading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ActivityItemSkeleton key={i} compact={compact} />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={refresh} className="mt-2">
                  Try again
                </Button>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No recent activity
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Activity will appear here as your team works
                </p>
              </div>
            ) : (
              <div className="py-2 space-y-3">
                {groupedActivities.map((group) => (
                  <ActivityGroupSection
                    key={group.label}
                    group={group}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {activities.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              >
                <Link href={viewAllHref}>
                  View all activity
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// FLOATING ACTIVITY BUTTON
// ============================================

interface FloatingActivityButtonProps {
  onClick: () => void;
  unreadCount?: number;
  className?: string;
}

export function FloatingActivityButton({
  onClick,
  unreadCount = 0,
  className,
}: FloatingActivityButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed right-4 z-40 h-12 w-12 rounded-full shadow-lg",
        "bg-primary hover:bg-primary/90",
        "transition-all duration-200 hover:scale-105",
        // Position above mobile nav bar and FABs on mobile, normal position on desktop
        "activity-float-btn",
        className
      )}
    >
      <Activity className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center",
            "rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground",
            "ring-2 ring-background"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}

// ============================================
// ACTIVITY PANEL WRAPPER (combines button + panel)
// ============================================

interface ActivityPanelProps {
  maxItems?: number;
  compact?: boolean;
  className?: string;
}

// Memoized ActivityPanel to prevent unnecessary re-renders
export const ActivityPanel = memo(function ActivityPanel({
  maxItems = 20,
  compact = false,
  className,
}: ActivityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only fetch minimal data for badge count when panel is closed
  // Full data is fetched inside RecentActivitySidebar when opened
  const { unreadCount } = useRecentActivity({
    limit: 1,
    // Reduce polling frequency for the badge to reduce network overhead
    pollInterval: 60000, // 1 minute instead of 30s
    enablePolling: !isOpen, // Disable polling when panel is open (sidebar handles its own)
  });

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <FloatingActivityButton
        onClick={handleOpen}
        unreadCount={unreadCount}
        className={cn(!isOpen && "block", isOpen && "hidden")}
      />
      {isOpen && (
        <RecentActivitySidebar
          floating
          onClose={handleClose}
          maxItems={maxItems}
          compact={compact}
          className={className}
        />
      )}
    </>
  );
});

export default RecentActivitySidebar;
