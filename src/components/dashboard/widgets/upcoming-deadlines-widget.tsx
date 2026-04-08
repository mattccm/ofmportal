"use client";

import Link from "next/link";
import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import { Calendar, ChevronRight, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { useWidgetData } from "../widget-data-provider";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UpcomingDeadline {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  creator: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

// ============================================
// HELPERS
// ============================================

function getUrgencyConfig(dueDate: Date) {
  const now = new Date();
  const daysUntilDue = differenceInDays(dueDate, now);

  if (daysUntilDue < 0) {
    return {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500",
      label: `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue`,
      urgency: "critical",
    };
  }
  if (isToday(dueDate)) {
    return {
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200 dark:border-orange-800",
      text: "text-orange-700 dark:text-orange-400",
      dot: "bg-orange-500",
      label: "Due today",
      urgency: "high",
    };
  }
  if (isTomorrow(dueDate)) {
    return {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
      label: "Due tomorrow",
      urgency: "medium",
    };
  }
  if (daysUntilDue <= 3) {
    return {
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      border: "border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-700 dark:text-yellow-400",
      dot: "bg-yellow-500",
      label: `${daysUntilDue} days left`,
      urgency: "medium",
    };
  }
  return {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: `${daysUntilDue} days left`,
    urgency: "low",
  };
}

// ============================================
// COMPONENT
// ============================================

export function UpcomingDeadlinesWidget({ config, size }: WidgetProps) {
  // Use batched widget data from context (single API call for all widgets)
  const { data, isLoading, error, refresh } = useWidgetData();
  const widgetData = data["upcoming-deadlines"] as { deadlines: UpcomingDeadline[] } | undefined;
  const deadlines = widgetData?.deadlines || [];

  const displayCount = size === "small" ? 4 : size === "medium" ? 6 : 10;

  // Group deadlines by date for calendar-style view
  const groupedDeadlines = deadlines.slice(0, displayCount).reduce((acc, deadline) => {
    const date = format(new Date(deadline.dueDate), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(deadline);
    return acc;
  }, {} as Record<string, UpcomingDeadline[]>);

  const sortedDates = Object.keys(groupedDeadlines).sort();

  return (
    <WidgetCard
      title="Upcoming Deadlines"
      icon={<Calendar className="h-5 w-5 text-blue-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      helpKey="dashboard.upcoming-deadlines"
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/requests?filter=due-soon">
            View all
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-foreground">No upcoming deadlines</p>
          <p className="text-xs text-muted-foreground mt-1">All on track!</p>
        </div>
      ) : size === "small" ? (
        // Simple list for small size
        <div className="space-y-1">
          {deadlines.slice(0, displayCount).map((deadline) => {
            const dueDate = new Date(deadline.dueDate);
            const urgencyConfig = getUrgencyConfig(dueDate);

            return (
              <Link
                key={deadline.id}
                href={`/dashboard/requests/${deadline.id}`}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border transition-colors group",
                  urgencyConfig.border,
                  urgencyConfig.bg,
                  "hover:opacity-90"
                )}
              >
                <div className={cn("h-2 w-2 rounded-full shrink-0", urgencyConfig.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deadline.title}</p>
                  <p className={cn("text-xs", urgencyConfig.text)}>{urgencyConfig.label}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        // Calendar-style grouped view for medium/large
        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const date = new Date(dateKey);
            const items = groupedDeadlines[dateKey];
            const urgencyConfig = getUrgencyConfig(date);

            return (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex flex-col items-center justify-center text-center",
                      urgencyConfig.bg,
                      urgencyConfig.border,
                      "border"
                    )}
                  >
                    <span className={cn("text-[10px] font-medium uppercase", urgencyConfig.text)}>
                      {format(date, "MMM")}
                    </span>
                    <span className={cn("text-sm font-bold -mt-0.5", urgencyConfig.text)}>
                      {format(date, "d")}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{format(date, "EEEE")}</p>
                    <p className={cn("text-xs", urgencyConfig.text)}>{urgencyConfig.label}</p>
                  </div>
                </div>

                {/* Items for this date */}
                <div className="space-y-1 pl-12">
                  {items.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/dashboard/requests/${deadline.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar
                        user={{ name: deadline.creator.name, image: deadline.creator.avatar }}
                        size="xs"
                      />
                      <span className="text-sm truncate group-hover:text-primary transition-colors">
                        {deadline.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
