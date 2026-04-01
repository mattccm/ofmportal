"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  AlertTriangle,
  Zap,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ============================================
// TYPES
// ============================================

export interface ScheduledReminder {
  id?: string;
  scheduledAt: Date;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  daysFromDue: number;
  isEscalation: boolean;
  requestId?: string;
  requestTitle?: string;
  creatorName?: string;
  isBatched?: boolean;
  batchedCount?: number;
}

export interface ReminderPreviewCalendarProps {
  reminders: ScheduledReminder[];
  dueDate?: Date;
  className?: string;
  onReminderClick?: (reminder: ScheduledReminder) => void;
  showLegend?: boolean;
  title?: string;
  description?: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function ReminderIndicator({
  reminder,
  onClick,
}: {
  reminder: ScheduledReminder;
  onClick?: () => void;
}) {
  const getTypeConfig = (type: string, isEscalation: boolean) => {
    if (isEscalation) {
      return {
        color: "bg-red-500",
        icon: Zap,
        label: "SMS Escalation",
      };
    }
    switch (type) {
      case "UPCOMING":
        return {
          color: "bg-blue-500",
          icon: Mail,
          label: "Upcoming Reminder",
        };
      case "DUE_TODAY":
        return {
          color: "bg-amber-500",
          icon: AlertTriangle,
          label: "Due Today Reminder",
        };
      case "OVERDUE":
        return {
          color: "bg-orange-500",
          icon: Mail,
          label: "Overdue Reminder",
        };
      case "ESCALATION":
        return {
          color: "bg-red-500",
          icon: Zap,
          label: "Escalation",
        };
      default:
        return {
          color: "bg-gray-500",
          icon: Mail,
          label: "Reminder",
        };
    }
  };

  const config = getTypeConfig(reminder.type, reminder.isEscalation);
  const Icon = reminder.channel === "SMS" ? MessageSquare : config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "w-2 h-2 rounded-full transition-transform hover:scale-150",
              config.color
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Icon className="h-3 w-3" />
              {config.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(reminder.scheduledAt, "MMM d, yyyy 'at' h:mm a")}
            </div>
            {reminder.requestTitle && (
              <div className="text-xs">
                Request: {reminder.requestTitle}
              </div>
            )}
            {reminder.creatorName && (
              <div className="text-xs">
                Creator: {reminder.creatorName}
              </div>
            )}
            {reminder.isBatched && reminder.batchedCount && (
              <Badge variant="secondary" className="text-xs mt-1">
                +{reminder.batchedCount - 1} more requests
              </Badge>
            )}
            <div className="text-xs text-muted-foreground">
              {reminder.channel} - {reminder.daysFromDue === 0
                ? "Due date"
                : reminder.daysFromDue > 0
                ? `${reminder.daysFromDue} days overdue`
                : `${Math.abs(reminder.daysFromDue)} days before due`}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReminderPreviewCalendar({
  reminders,
  dueDate,
  className,
  onReminderClick,
  showLegend = true,
  title = "Reminder Schedule",
  description,
}: ReminderPreviewCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    // Start with dueDate month if available, otherwise first reminder, otherwise today
    if (dueDate) return dueDate;
    if (reminders.length > 0) return reminders[0].scheduledAt;
    return new Date();
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Group reminders by date
  const remindersByDate = React.useMemo(() => {
    const map = new Map<string, ScheduledReminder[]>();
    reminders.forEach((reminder) => {
      const dateKey = format(reminder.scheduledAt, "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(reminder);
    });
    return map;
  }, [reminders]);

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((weekDay) => (
            <div
              key={weekDay}
              className="text-center text-xs font-medium text-muted-foreground h-8 flex items-center justify-center"
            >
              {weekDay}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((date, index) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const dayReminders = remindersByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isTodayDate = isToday(date);
            const isDueDate = dueDate && isSameDay(date, dueDate);
            const isPastDate = isPast(date) && !isTodayDate;

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[48px] p-1 rounded-md border border-transparent",
                  "flex flex-col items-center",
                  !isCurrentMonth && "opacity-40",
                  isTodayDate && "bg-accent/50 border-accent",
                  isDueDate && "bg-amber-100/50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700",
                  isPastDate && isCurrentMonth && "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium mb-1",
                    isTodayDate && "text-primary font-bold",
                    isDueDate && "text-amber-700 dark:text-amber-400 font-bold"
                  )}
                >
                  {format(date, "d")}
                </span>
                {dayReminders.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                    {dayReminders.slice(0, 4).map((reminder, i) => (
                      <ReminderIndicator
                        key={i}
                        reminder={reminder}
                        onClick={() => onReminderClick?.(reminder)}
                      />
                    ))}
                    {dayReminders.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">
                        +{dayReminders.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Due Date Indicator */}
        {dueDate && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700" />
            <span className="text-muted-foreground">
              Due: {format(dueDate, "MMMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-wrap gap-4 pt-2 border-t text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Upcoming</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Due Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Escalation</span>
            </div>
          </div>
        )}

        {/* Summary */}
        {reminders.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {reminders.length} reminder{reminders.length !== 1 ? "s" : ""} scheduled
            {reminders.filter((r) => r.isEscalation).length > 0 && (
              <span className="text-red-500 ml-1">
                ({reminders.filter((r) => r.isEscalation).length} escalation
                {reminders.filter((r) => r.isEscalation).length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
        )}

        {reminders.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No reminders scheduled
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReminderPreviewCalendar;
