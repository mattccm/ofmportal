"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Eye, Monitor, Smartphone, Tablet, Clock, User, X, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ViewReceipt, ViewHistory } from "@/types/read-receipts";
import { formatViewDuration, getViewReceipts, getViewKey, subscribeToViewReceipts } from "@/lib/realtime-simulation";

// ============================================================================
// Device Icon Component
// ============================================================================

interface DeviceIconProps {
  deviceType?: "desktop" | "mobile" | "tablet";
  className?: string;
}

function DeviceIcon({ deviceType, className }: DeviceIconProps) {
  if (!deviceType) return <Monitor className={cn("h-3.5 w-3.5", className)} />;

  const iconMap = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
  };

  const Icon = iconMap[deviceType];
  return <Icon className={cn("h-3.5 w-3.5", className)} />;
}

// ============================================================================
// View Receipt Item Component
// ============================================================================

interface ViewReceiptItemProps {
  view: ViewReceipt;
  showDuration?: boolean;
  showDevice?: boolean;
  compact?: boolean;
  className?: string;
}

function ViewReceiptItem({
  view,
  showDuration = true,
  showDevice = true,
  compact = false,
  className,
}: ViewReceiptItemProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center justify-between gap-2 py-1", className)}>
        <div className="flex items-center gap-2">
          <Avatar
            size="xs"
            user={{ name: view.userName }}
          />
          <span className="text-xs truncate max-w-[120px]">{view.userName}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(view.viewedAt), { addSuffix: true })}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 py-2", className)}>
      <div className="flex items-center gap-3">
        <Avatar
          size="sm"
          user={{ name: view.userName }}
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{view.userName}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(view.viewedAt), "MMM d, h:mm a")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showDuration && view.duration && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <Clock className="h-2.5 w-2.5 mr-1" />
            {formatViewDuration(view.duration)}
          </Badge>
        )}
        {showDevice && (
          <DeviceIcon className="text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Who Viewed Panel Component
// ============================================================================

interface WhoViewedPanelProps {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  views?: ViewReceipt[];
  title?: string;
  showDuration?: boolean;
  showDevice?: boolean;
  showStats?: boolean;
  maxHeight?: string;
  onClose?: () => void;
  className?: string;
}

export function WhoViewedPanel({
  resourceType,
  resourceId,
  views: viewsOverride,
  title = "Who Viewed",
  showDuration = true,
  showDevice = true,
  showStats = true,
  maxHeight = "300px",
  onClose,
  className,
}: WhoViewedPanelProps) {
  const [views, setViews] = React.useState<ViewReceipt[]>(viewsOverride || []);
  const [isLoading, setIsLoading] = React.useState(!viewsOverride);

  // Fetch views from store
  React.useEffect(() => {
    if (viewsOverride) {
      setViews(viewsOverride);
      return;
    }

    const key = getViewKey(resourceType, resourceId);
    const stored = getViewReceipts(resourceType, resourceId);
    setViews(stored);
    setIsLoading(false);

    // Subscribe to updates
    const unsubscribe = subscribeToViewReceipts(key, (updated) => {
      setViews(updated);
    });

    return () => unsubscribe();
  }, [resourceType, resourceId, viewsOverride]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const uniqueViewers = new Set(views.map((v) => v.userId)).size;
    const totalDuration = views.reduce((sum, v) => sum + (v.duration || 0), 0);
    const avgDuration = views.length > 0 ? totalDuration / views.length : 0;

    return {
      uniqueViewers,
      totalViews: views.length,
      avgDuration,
    };
  }, [views]);

  // Sort views by most recent first
  const sortedViews = React.useMemo(() => {
    return [...views].sort(
      (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
    );
  }, [views]);

  if (isLoading) {
    return (
      <div className={cn("p-4 rounded-lg border bg-card", className)}>
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {stats.uniqueViewers}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Stats */}
      {showStats && views.length > 0 && (
        <div className="px-3 py-2 bg-muted/30 border-b">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{stats.uniqueViewers} unique viewers</span>
            </div>
            {showDuration && stats.avgDuration > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Avg. {formatViewDuration(stats.avgDuration)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Views List */}
      {views.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No views yet</p>
        </div>
      ) : (
        <ScrollArea className="px-3" style={{ maxHeight }}>
          <div className="divide-y">
            {sortedViews.map((view, index) => (
              <ViewReceiptItem
                key={`${view.userId}-${index}`}
                view={view}
                showDuration={showDuration}
                showDevice={showDevice}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ============================================================================
// Compact Who Viewed (Inline)
// ============================================================================

interface WhoViewedInlineProps {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  views?: ViewReceipt[];
  maxAvatars?: number;
  showCount?: boolean;
  className?: string;
  onClick?: () => void;
}

export function WhoViewedInline({
  resourceType,
  resourceId,
  views: viewsOverride,
  maxAvatars = 3,
  showCount = true,
  className,
  onClick,
}: WhoViewedInlineProps) {
  const [views, setViews] = React.useState<ViewReceipt[]>(viewsOverride || []);

  React.useEffect(() => {
    if (viewsOverride) {
      setViews(viewsOverride);
      return;
    }

    const stored = getViewReceipts(resourceType, resourceId);
    setViews(stored);
  }, [resourceType, resourceId, viewsOverride]);

  if (views.length === 0) {
    return null;
  }

  const uniqueViewers = [...new Map(views.map((v) => [v.userId, v])).values()];
  const visibleViewers = uniqueViewers.slice(0, maxAvatars);
  const hiddenCount = uniqueViewers.length - maxAvatars;

  return (
    <div
      className={cn(
        "flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
    >
      <AvatarGroup>
        {visibleViewers.map((view) => (
          <Avatar
            key={view.userId}
            size="xs"
            user={{ name: view.userName }}
            ring="white"
          />
        ))}
        {hiddenCount > 0 && (
          <AvatarGroupCount count={hiddenCount} size="xs" />
        )}
      </AvatarGroup>

      {showCount && (
        <span className="text-xs text-muted-foreground">
          <Eye className="h-3 w-3 inline mr-1" />
          {uniqueViewers.length}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Collapsible Who Viewed Panel
// ============================================================================

interface WhoViewedCollapsibleProps {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  views?: ViewReceipt[];
  defaultExpanded?: boolean;
  className?: string;
}

export function WhoViewedCollapsible({
  resourceType,
  resourceId,
  views: viewsOverride,
  defaultExpanded = false,
  className,
}: WhoViewedCollapsibleProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [views, setViews] = React.useState<ViewReceipt[]>(viewsOverride || []);

  React.useEffect(() => {
    if (viewsOverride) {
      setViews(viewsOverride);
      return;
    }

    const stored = getViewReceipts(resourceType, resourceId);
    setViews(stored);
  }, [resourceType, resourceId, viewsOverride]);

  const uniqueViewers = [...new Map(views.map((v) => [v.userId, v])).values()];

  if (views.length === 0) {
    return null;
  }

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Header (always visible) */}
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Viewed by {uniqueViewers.length}
          </span>

          {/* Preview avatars when collapsed */}
          {!isExpanded && (
            <AvatarGroup>
              {uniqueViewers.slice(0, 3).map((view) => (
                <Avatar
                  key={view.userId}
                  size="xs"
                  user={{ name: view.userName }}
                  ring="white"
                />
              ))}
              {uniqueViewers.length > 3 && (
                <AvatarGroupCount count={uniqueViewers.length - 3} size="xs" />
              )}
            </AvatarGroup>
          )}
        </div>

        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <>
          <Separator />
          <ScrollArea className="max-h-[200px]">
            <div className="p-3 space-y-1">
              {uniqueViewers.map((view) => (
                <ViewReceiptItem
                  key={view.userId}
                  view={view}
                  compact
                />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

// ============================================================================
// View History Timeline
// ============================================================================

interface ViewHistoryTimelineProps {
  views: ViewReceipt[];
  showDevice?: boolean;
  className?: string;
}

export function ViewHistoryTimeline({
  views,
  showDevice = true,
  className,
}: ViewHistoryTimelineProps) {
  // Group views by date
  const groupedViews = React.useMemo(() => {
    const groups = new Map<string, ViewReceipt[]>();

    views.forEach((view) => {
      const dateKey = format(new Date(view.viewedAt), "yyyy-MM-dd");
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(view);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date: new Date(date),
        views: items.sort(
          (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
        ),
      }));
  }, [views]);

  if (views.length === 0) {
    return (
      <div className={cn("text-center py-6 text-sm text-muted-foreground", className)}>
        No view history
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {groupedViews.map(({ date, views: dayViews }) => (
        <div key={date.toISOString()}>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {format(date, "EEEE, MMMM d")}
          </div>

          <div className="relative pl-4 border-l-2 border-border space-y-3">
            {dayViews.map((view, index) => (
              <div
                key={`${view.userId}-${index}`}
                className="relative flex items-center gap-3"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />

                {/* View info */}
                <div className="flex items-center gap-2 flex-1">
                  <Avatar
                    size="xs"
                    user={{ name: view.userName }}
                  />
                  <span className="text-sm">{view.userName}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {showDevice && <DeviceIcon className="h-3 w-3" />}
                  <span>{format(new Date(view.viewedAt), "h:mm a")}</span>
                  {view.duration && (
                    <span className="text-[10px]">
                      ({formatViewDuration(view.duration)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default WhoViewedPanel;
