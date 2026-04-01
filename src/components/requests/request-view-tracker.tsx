"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Eye, EyeOff, Clock, User, Users, UserCheck, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ViewReceipt, RequestViewData } from "@/types/read-receipts";
import {
  getViewReceipts,
  subscribeToViewReceipts,
  addViewReceipt,
  getViewKey,
  formatViewDuration,
  getDeviceType,
  generateId,
} from "@/lib/realtime-simulation";

// ============================================================================
// Tooltip Wrapper
// ============================================================================

function ViewTooltip({
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
// Device Icon Component
// ============================================================================

function DeviceIcon({ deviceType }: { deviceType?: string }) {
  if (!deviceType) return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;

  const icons: Record<string, React.ReactNode> = {
    desktop: <Monitor className="h-3.5 w-3.5 text-muted-foreground" />,
    mobile: <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />,
    tablet: <Tablet className="h-3.5 w-3.5 text-muted-foreground" />,
  };

  return icons[deviceType] || icons.desktop;
}

// ============================================================================
// Hook for tracking request views
// ============================================================================

interface UseRequestViewTrackerOptions {
  requestId: string;
  userId?: string;
  userName?: string;
  autoTrackView?: boolean;
  trackDuration?: boolean;
}

interface UseRequestViewTrackerReturn {
  views: ViewReceipt[];
  isLoading: boolean;
  creatorViewed: ViewReceipt | null;
  teamViews: ViewReceipt[];
  uniqueViewers: number;
  trackView: () => void;
  updateViewDuration: (duration: number) => void;
}

export function useRequestViewTracker({
  requestId,
  userId,
  userName = "User",
  autoTrackView = true,
  trackDuration = true,
}: UseRequestViewTrackerOptions): UseRequestViewTrackerReturn {
  const [views, setViews] = React.useState<ViewReceipt[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const viewStartRef = React.useRef<number | null>(null);
  const hasTrackedRef = React.useRef(false);

  // Fetch views
  React.useEffect(() => {
    const stored = getViewReceipts("request", requestId);
    setViews(stored);
    setIsLoading(false);

    // Subscribe to updates
    const key = getViewKey("request", requestId);
    const unsubscribe = subscribeToViewReceipts(key, (updated) => {
      setViews(updated);
    });

    return () => unsubscribe();
  }, [requestId]);

  // Track view
  const trackView = React.useCallback(() => {
    if (!userId || hasTrackedRef.current) return;

    const view: ViewReceipt = {
      resourceType: "request",
      resourceId: requestId,
      userId,
      userName,
      viewedAt: new Date(),
    };

    addViewReceipt(view);
    hasTrackedRef.current = true;
    viewStartRef.current = Date.now();
  }, [requestId, userId, userName]);

  // Update view duration
  const updateViewDuration = React.useCallback(
    (duration: number) => {
      if (!userId) return;

      const existingView = views.find((v) => v.userId === userId);
      if (existingView) {
        addViewReceipt({
          ...existingView,
          duration: (existingView.duration || 0) + duration,
        });
      }
    },
    [views, userId]
  );

  // Auto-track view on mount
  React.useEffect(() => {
    if (autoTrackView && userId) {
      trackView();
    }
  }, [autoTrackView, userId, trackView]);

  // Track duration on unmount
  React.useEffect(() => {
    return () => {
      if (trackDuration && viewStartRef.current && userId) {
        const duration = Date.now() - viewStartRef.current;
        updateViewDuration(duration);
      }
    };
  }, [trackDuration, userId, updateViewDuration]);

  // Categorize views
  const { creatorViewed, teamViews } = React.useMemo(() => {
    // In a real app, you'd check user roles
    // For now, we'll assume the first viewer is the creator
    const sorted = [...views].sort(
      (a, b) => new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime()
    );

    return {
      creatorViewed: sorted[0] || null,
      teamViews: sorted.slice(1),
    };
  }, [views]);

  const uniqueViewers = new Set(views.map((v) => v.userId)).size;

  return {
    views,
    isLoading,
    creatorViewed,
    teamViews,
    uniqueViewers,
    trackView,
    updateViewDuration,
  };
}

// ============================================================================
// Request View Status Badge
// ============================================================================

interface RequestViewStatusProps {
  requestId: string;
  creatorName?: string;
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export function RequestViewStatus({
  requestId,
  creatorName,
  variant = "default",
  className,
}: RequestViewStatusProps) {
  const { views, creatorViewed, uniqueViewers, isLoading } = useRequestViewTracker({
    requestId,
    autoTrackView: false,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        <Eye className="h-3 w-3 mr-1 opacity-50" />
        Loading...
      </Badge>
    );
  }

  // Compact variant - just icon and count
  if (variant === "compact") {
    if (uniqueViewers === 0) {
      return (
        <ViewTooltip content="Not viewed yet" side="top">
          <Badge variant="outline" className={cn("text-muted-foreground", className)}>
            <EyeOff className="h-3 w-3" />
          </Badge>
        </ViewTooltip>
      );
    }

    return (
      <ViewTooltip
        content={
          <div className="space-y-1">
            <span>Viewed by {uniqueViewers}</span>
            {creatorViewed && (
              <div className="text-muted-foreground">
                Creator viewed {formatDistanceToNow(new Date(creatorViewed.viewedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        }
        side="top"
      >
        <Badge
          variant="secondary"
          className={cn(
            creatorViewed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "",
            className
          )}
        >
          <Eye className="h-3 w-3 mr-1" />
          {uniqueViewers}
        </Badge>
      </ViewTooltip>
    );
  }

  // Detailed variant - show full info
  if (variant === "detailed") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {creatorViewed ? (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 w-fit"
          >
            <UserCheck className="h-3 w-3 mr-1" />
            Creator viewed
            {creatorName && ` (${creatorName})`}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground w-fit">
            <EyeOff className="h-3 w-3 mr-1" />
            Not viewed by creator
          </Badge>
        )}

        {uniqueViewers > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{uniqueViewers} total view{uniqueViewers !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  if (!creatorViewed) {
    return (
      <Badge
        variant="outline"
        className={cn("text-muted-foreground border-muted-foreground/30", className)}
      >
        <EyeOff className="h-3 w-3 mr-1 opacity-50" />
        Not viewed
      </Badge>
    );
  }

  return (
    <ViewTooltip
      content={
        <div className="space-y-1">
          <span className="font-medium">Viewed</span>
          <div className="text-muted-foreground">
            {format(new Date(creatorViewed.viewedAt), "MMM d, h:mm a")}
          </div>
        </div>
      }
      side="top"
    >
      <Badge
        variant="secondary"
        className={cn(
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          className
        )}
      >
        <Eye className="h-3 w-3 mr-1" />
        Viewed
      </Badge>
    </ViewTooltip>
  );
}

// ============================================================================
// Request View Tracker Panel
// ============================================================================

interface RequestViewTrackerProps {
  requestId: string;
  requestTitle?: string;
  creatorId?: string;
  creatorName?: string;
  showHistory?: boolean;
  onViewerClick?: (userId: string) => void;
  className?: string;
}

export function RequestViewTracker({
  requestId,
  requestTitle,
  creatorId,
  creatorName,
  showHistory = true,
  onViewerClick,
  className,
}: RequestViewTrackerProps) {
  const { views, creatorViewed, teamViews, uniqueViewers, isLoading } = useRequestViewTracker({
    requestId,
    autoTrackView: false,
  });

  // Sort views by most recent
  const sortedViews = React.useMemo(() => {
    return [...views].sort(
      (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
    );
  }, [views]);

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-4 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4" />
          View Activity
        </CardTitle>
        {requestTitle && (
          <CardDescription className="truncate">{requestTitle}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Creator View Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                creatorViewed
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-muted"
              )}
            >
              <UserCheck
                className={cn(
                  "h-5 w-5",
                  creatorViewed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium">
                {creatorName || "Creator"}
              </p>
              <p className="text-xs text-muted-foreground">
                {creatorViewed
                  ? `Viewed ${formatDistanceToNow(new Date(creatorViewed.viewedAt), { addSuffix: true })}`
                  : "Has not viewed yet"}
              </p>
            </div>
          </div>

          {creatorViewed && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Viewed
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">{uniqueViewers}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Unique Viewers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">{views.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total Views
              </p>
            </div>
          </div>
        </div>

        {/* View History */}
        {showHistory && views.length > 0 && (
          <>
            <Separator />

            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                View History
              </h4>

              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {sortedViews.map((view, index) => (
                    <div
                      key={`${view.userId}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors",
                        onViewerClick && "cursor-pointer"
                      )}
                      onClick={() => onViewerClick?.(view.userId)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          user={{ name: view.userName }}
                        />
                        <div>
                          <p className="text-sm font-medium">{view.userName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(view.viewedAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {view.duration && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <Clock className="h-2.5 w-2.5 mr-1" />
                            {formatViewDuration(view.duration)}
                          </Badge>
                        )}
                        <DeviceIcon deviceType={getDeviceType()} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {views.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No views yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Request View Inline Indicator
// ============================================================================

interface RequestViewInlineProps {
  requestId: string;
  showCreatorStatus?: boolean;
  showCount?: boolean;
  className?: string;
}

export function RequestViewInline({
  requestId,
  showCreatorStatus = true,
  showCount = true,
  className,
}: RequestViewInlineProps) {
  const { creatorViewed, uniqueViewers } = useRequestViewTracker({
    requestId,
    autoTrackView: false,
  });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showCreatorStatus && (
        <ViewTooltip
          content={creatorViewed ? "Creator has viewed" : "Creator has not viewed"}
          side="top"
        >
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              creatorViewed ? "bg-emerald-500" : "bg-muted-foreground/30"
            )}
          />
        </ViewTooltip>
      )}

      {showCount && uniqueViewers > 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {uniqueViewers}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Auto View Tracker (invisible component that just tracks)
// ============================================================================

interface AutoViewTrackerProps {
  requestId: string;
  userId: string;
  userName: string;
}

export function AutoViewTracker({
  requestId,
  userId,
  userName,
}: AutoViewTrackerProps) {
  useRequestViewTracker({
    requestId,
    userId,
    userName,
    autoTrackView: true,
    trackDuration: true,
  });

  // This component doesn't render anything
  return null;
}

export default RequestViewTracker;
