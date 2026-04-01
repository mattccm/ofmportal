"use client";

import * as React from "react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import Link from "next/link";
import {
  Repeat,
  ChevronRight,
  Clock,
  Users,
  Play,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  RecurringRequest,
  FREQUENCY_LABELS,
  type RequestSettings,
} from "@/types/recurring-requests";

// ============================================
// TYPES
// ============================================

interface UpcomingRecurringWidgetProps {
  className?: string;
  limit?: number;
}

// ============================================
// UPCOMING ITEM
// ============================================

function UpcomingItem({
  recurringRequest,
  onRunNow,
}: {
  recurringRequest: RecurringRequest;
  onRunNow: () => void;
}) {
  const nextRunAt = recurringRequest.nextRunAt
    ? new Date(recurringRequest.nextRunAt)
    : null;

  const settings = recurringRequest.requestSettings as RequestSettings;

  const getDateLabel = () => {
    if (!nextRunAt) return "No upcoming run";
    if (isToday(nextRunAt)) return "Today";
    if (isTomorrow(nextRunAt)) return "Tomorrow";
    if (isThisWeek(nextRunAt)) return format(nextRunAt, "EEEE");
    return format(nextRunAt, "MMM d");
  };

  const totalCreators =
    (recurringRequest.creators?.length || 0) +
    (recurringRequest.creatorGroups?.reduce((sum, g) => sum + g.memberCount, 0) || 0);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          "bg-primary/10 text-primary"
        )}
      >
        <Repeat className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{recurringRequest.name}</p>
          {nextRunAt && isToday(nextRunAt) && (
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              Today
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{getDateLabel()}</span>
          {nextRunAt && <span>at {format(nextRunAt, "h:mm a")}</span>}
          <span className="text-muted-foreground/50">|</span>
          <span>{totalCreators} creator{totalCreators !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onRunNow();
        }}
        title="Run now"
      >
        <Play className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function ItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UpcomingRecurringWidget({
  className,
  limit = 5,
}: UpcomingRecurringWidgetProps) {
  const [recurringRequests, setRecurringRequests] = React.useState<
    RecurringRequest[]
  >([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch active recurring requests with upcoming runs
  const fetchUpcoming = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recurring-requests?active=true&limit=${limit + 5}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();

      // Filter to those with upcoming runs and sort by next run date
      const upcoming = data
        .filter((rr: RecurringRequest) => rr.isActive && rr.nextRunAt)
        .sort(
          (a: RecurringRequest, b: RecurringRequest) =>
            new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime()
        )
        .slice(0, limit);

      setRecurringRequests(upcoming);
    } catch (error) {
      console.error("Error fetching upcoming recurring requests:", error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  React.useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  // Run now handler
  const handleRunNow = async (rr: RecurringRequest) => {
    try {
      const response = await fetch(`/api/recurring-requests/${rr.id}/run`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to run");

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Created ${result.successCount} request${result.successCount !== 1 ? "s" : ""}`
        );
        fetchUpcoming(); // Refresh the list
      } else {
        toast.error("Failed to create requests");
      }
    } catch (error) {
      console.error("Error running recurring request:", error);
      toast.error("Failed to run recurring request");
    }
  };

  // Count stats
  const todayCount = recurringRequests.filter((rr) =>
    rr.nextRunAt ? isToday(new Date(rr.nextRunAt)) : false
  ).length;

  const thisWeekCount = recurringRequests.filter((rr) =>
    rr.nextRunAt ? isThisWeek(new Date(rr.nextRunAt)) : false
  ).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Upcoming Recurring Requests
            </CardTitle>
            <CardDescription className="text-xs">
              {todayCount > 0 && (
                <span className="text-primary font-medium">{todayCount} today</span>
              )}
              {todayCount > 0 && thisWeekCount > todayCount && " / "}
              {thisWeekCount > todayCount && (
                <span>{thisWeekCount - todayCount} more this week</span>
              )}
              {todayCount === 0 && thisWeekCount === 0 && "No upcoming runs scheduled"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/recurring-requests">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </>
        ) : recurringRequests.length === 0 ? (
          <div className="text-center py-6">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No upcoming recurring requests
            </p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <Link href="/dashboard/recurring-requests">
                Set up recurring requests
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {recurringRequests.map((rr) => (
              <UpcomingItem
                key={rr.id}
                recurringRequest={rr}
                onRunNow={() => handleRunNow(rr)}
              />
            ))}
            {recurringRequests.length >= limit && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                asChild
              >
                <Link href="/dashboard/recurring-requests">
                  View all recurring requests
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default UpcomingRecurringWidget;
