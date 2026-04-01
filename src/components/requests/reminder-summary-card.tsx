"use client";

import * as React from "react";
import {
  Bell,
  Clock,
  MessageSquare,
  Mail,
  Loader2,
  AlertCircle,
  Info,
  Zap,
  Check,
  X,
  RotateCcw,
  Calendar,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================
// TYPES
// ============================================

interface ReminderItem {
  id: string;
  scheduledAt: string;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  status: "PENDING" | "SENT" | "FAILED";
  isEscalation: boolean;
}

interface ReminderSummaryData {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  nextReminder: string | null;
  schedule: ReminderItem[];
}

interface ReminderPreviewData {
  remindersCreated: number;
  reminders: Array<{
    scheduledAt: string;
    type: string;
    channel: string;
    daysFromDue: number;
    isEscalation: boolean;
  }>;
  config: {
    source: string;
    ruleId?: string;
    overrideId?: string;
  };
}

interface ReminderSummaryCardProps {
  requestId: string;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusColor(status: ReminderItem["status"]) {
  switch (status) {
    case "PENDING":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "SENT":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "FAILED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getTypeIcon(type: ReminderItem["type"]) {
  switch (type) {
    case "UPCOMING":
      return Clock;
    case "DUE_TODAY":
      return Bell;
    case "OVERDUE":
      return AlertCircle;
    case "ESCALATION":
      return Zap;
    default:
      return Bell;
  }
}

function getTypeLabel(type: ReminderItem["type"]) {
  switch (type) {
    case "UPCOMING":
      return "Upcoming";
    case "DUE_TODAY":
      return "Due Today";
    case "OVERDUE":
      return "Overdue";
    case "ESCALATION":
      return "Escalation";
    default:
      return type;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReminderSummaryCard({ requestId, className }: ReminderSummaryCardProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [data, setData] = React.useState<{
    summary: ReminderSummaryData;
    preview: ReminderPreviewData | null;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch reminder data
  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/requests/${requestId}/schedule-reminders`);

      if (!response.ok) {
        throw new Error("Failed to fetch reminder data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching reminder data:", err);
      setError("Unable to load reminder information");
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reschedule reminders
  const handleReschedule = async () => {
    try {
      setIsRescheduling(true);

      const response = await fetch(`/api/requests/${requestId}/schedule-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelExisting: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule reminders");
      }

      const result = await response.json();
      toast.success(`${result.remindersCreated} reminders scheduled`);
      fetchData();
    } catch (err) {
      console.error("Error rescheduling reminders:", err);
      toast.error("Failed to reschedule reminders");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Cancel reminders
  const handleCancel = async () => {
    try {
      setIsRescheduling(true);

      const response = await fetch(`/api/requests/${requestId}/schedule-reminders`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel reminders");
      }

      const result = await response.json();
      toast.success(`${result.cancelledCount} reminders cancelled`);
      fetchData();
    } catch (err) {
      console.error("Error cancelling reminders:", err);
      toast.error("Failed to cancel reminders");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading reminders...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("card-elevated border-red-200 dark:border-red-800", className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { summary } = data;
  const hasReminders = summary.schedule.length > 0;
  const pendingReminders = summary.schedule.filter((r) => r.status === "PENDING");
  const sentReminders = summary.schedule.filter((r) => r.status === "SENT");

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base">Reminders</CardTitle>
              <CardDescription>
                {hasReminders
                  ? `${summary.pending} pending, ${summary.sent} sent`
                  : "No reminders scheduled"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasReminders && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancel}
                      disabled={isRescheduling || summary.pending === 0}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel pending reminders</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className="h-8 w-8"
                  >
                    {isRescheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasReminders ? "Reschedule reminders" : "Schedule reminders"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Next reminder highlight */}
        {summary.nextReminder && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Next Reminder</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(summary.nextReminder), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        )}

        {/* Reminder list */}
        {hasReminders && (
          <div className="space-y-2">
            {summary.schedule.slice(0, 5).map((reminder) => {
              const TypeIcon = getTypeIcon(reminder.type);
              return (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center",
                        reminder.status === "SENT"
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : reminder.status === "FAILED"
                          ? "bg-red-100 dark:bg-red-900/30"
                          : "bg-blue-100 dark:bg-blue-900/30"
                      )}
                    >
                      {reminder.status === "SENT" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : reminder.status === "FAILED" ? (
                        <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      ) : (
                        <TypeIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(reminder.scheduledAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getTypeLabel(reminder.type)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      {reminder.channel === "SMS" ? (
                        <MessageSquare className="h-3 w-3" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {reminder.channel}
                    </Badge>
                    {reminder.isEscalation && (
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Escalation
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {summary.schedule.length > 5 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{summary.schedule.length - 5} more reminders
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasReminders && (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-xl bg-muted mx-auto flex items-center justify-center mb-3">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No Reminders Scheduled</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Click the button above to schedule automatic reminders
            </p>
            <Button size="sm" onClick={handleReschedule} disabled={isRescheduling}>
              {isRescheduling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Schedule Reminders
            </Button>
          </div>
        )}

        {/* Stats summary */}
        {hasReminders && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {summary.pending}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {summary.sent}
              </p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                {summary.failed}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReminderSummaryCard;
