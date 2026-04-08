"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronRight,
  Mail,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { useWidgetData } from "../widget-data-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface Reminder {
  id: string;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  scheduledAt: string;
  status: "PENDING" | "SENT" | "FAILED";
  request: {
    id: string;
    title: string;
    creator: {
      id: string;
      name: string;
    };
  };
}

interface ReminderSummary {
  pending: number;
  sentToday: number;
  failed: number;
  reminders: Reminder[];
}

// ============================================
// HELPERS
// ============================================

function getTypeConfig(type: string) {
  switch (type) {
    case "OVERDUE":
    case "ESCALATION":
      return {
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
        label: type === "OVERDUE" ? "Overdue" : "Escalation",
      };
    case "DUE_TODAY":
      return {
        bg: "bg-orange-50 dark:bg-orange-900/20",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-200 dark:border-orange-800",
        label: "Due Today",
      };
    default:
      return {
        bg: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800",
        label: "Upcoming",
      };
  }
}

// ============================================
// COMPONENT
// ============================================

export function ReminderSummaryWidget({ config, size }: WidgetProps) {
  // Use batched widget data from context (single API call for all widgets)
  const { data: allWidgetData, isLoading, error, refresh } = useWidgetData();
  const summaryData = allWidgetData["reminder-summary"] as ReminderSummary | undefined;
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSendNow = async (reminderId: string) => {
    setSendingId(reminderId);
    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId }),
      });

      if (response.ok) {
        toast.success("Reminder sent successfully");
        refresh();
      } else {
        throw new Error("Failed to send reminder");
      }
    } catch (err) {
      toast.error("Failed to send reminder");
    } finally {
      setSendingId(null);
    }
  };

  const displayCount = size === "small" ? 3 : size === "medium" ? 5 : 8;

  return (
    <WidgetCard
      title="Reminders"
      icon={<Bell className="h-5 w-5 text-amber-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/reminders">
            Manage
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {summaryData && (
        <>
          {/* Summary Stats */}
          <div className="flex items-center gap-4 mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{summaryData.pending}</p>
                <p className="text-[10px] text-muted-foreground">Scheduled</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{summaryData.sentToday}</p>
                <p className="text-[10px] text-muted-foreground">Sent today</p>
              </div>
            </div>
            {summaryData.failed > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">{summaryData.failed}</p>
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                </div>
              </div>
            )}
          </div>

          {/* Pending Reminders List */}
          {summaryData.reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-sm text-muted-foreground">No pending reminders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {summaryData.reminders.slice(0, displayCount).map((reminder) => {
                const typeConfig = getTypeConfig(reminder.type);

                return (
                  <div
                    key={reminder.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border",
                      typeConfig.border,
                      typeConfig.bg
                    )}
                  >
                    {/* Channel Icon */}
                    <div className="shrink-0">
                      {reminder.channel === "EMAIL" ? (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reminder.request.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{reminder.request.creator.name}</span>
                        <span>·</span>
                        <span>{format(new Date(reminder.scheduledAt), "MMM d, h:mm a")}</span>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", typeConfig.text)}>
                      {typeConfig.label}
                    </Badge>

                    {/* Send Now Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSendNow(reminder.id);
                      }}
                      disabled={sendingId === reminder.id}
                      title="Send now"
                    >
                      {sendingId === reminder.id ? (
                        <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                );
              })}

              {summaryData.reminders.length > displayCount && (
                <div className="pt-1 text-center">
                  <Link
                    href="/dashboard/reminders"
                    className="text-xs text-primary hover:underline"
                  >
                    +{summaryData.reminders.length - displayCount} more reminders
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}
