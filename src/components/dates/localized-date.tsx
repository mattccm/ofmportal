"use client";

import * as React from "react";
import { Clock, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateTime,
  formatDate,
  formatTime,
  getRelativeTime,
  getSmartRelativeDate,
  isToday,
  isYesterday,
  isTomorrow,
  formatDueDate,
  getDueDateStatus,
  getTimezoneAbbreviation,
  getTimezoneOffsetString,
  toISOStringInTimezone,
} from "@/lib/timezone-utils";
import { useTimezone } from "@/components/providers/timezone-provider";

// ============================================
// TYPES
// ============================================

interface LocalizedDateProps {
  /** The date to display (Date object, ISO string, or timestamp) */
  date: Date | string | number;
  /** Override the user's timezone preference */
  timezone?: string;
  /** Show relative time (e.g., "2 hours ago") instead of absolute */
  relative?: boolean;
  /** Show only time, no date */
  timeOnly?: boolean;
  /** Show only date, no time */
  dateOnly?: boolean;
  /** Include timezone abbreviation in display */
  showTimezone?: boolean;
  /** Custom date format for dateOnly mode */
  dateFormat?: "short" | "medium" | "long" | "full";
  /** Custom time format */
  timeFormat?: "short" | "medium";
  /** Use 24-hour format */
  hour24?: boolean;
  /** Show hover tooltip with full date details */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom prefix text */
  prefix?: string;
  /** Custom suffix text */
  suffix?: string;
}

interface DueDateDisplayProps {
  /** The due date to display */
  dueDate: Date | string | number;
  /** Override the user's timezone preference */
  timezone?: string;
  /** Show the time component */
  showTime?: boolean;
  /** Use relative time format */
  relative?: boolean;
  /** Show status badge */
  showStatus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface ActivityTimestampProps {
  /** The timestamp of the activity */
  timestamp: Date | string | number;
  /** Override the user's timezone preference */
  timezone?: string;
  /** Action description (e.g., "uploaded", "commented") */
  action?: string;
  /** Actor name */
  actor?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================
// DATE TOOLTIP CONTENT
// ============================================

function DateTooltipContent({
  date,
  timezone,
  hour24,
}: {
  date: Date | string | number;
  timezone: string;
  hour24?: boolean;
}) {
  const inputDate = new Date(date);
  const tzAbbr = getTimezoneAbbreviation(timezone, inputDate);
  const tzOffset = getTimezoneOffsetString(timezone, inputDate);
  const isoString = toISOStringInTimezone(inputDate, timezone);

  return (
    <div className="space-y-2 text-sm">
      {/* Full date and time */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {formatDateTime(inputDate, timezone, {
            dateStyle: "full",
            timeStyle: "medium",
            hour12: !hour24,
            showTimezone: true,
          })}
        </span>
      </div>

      {/* Timezone info */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          {tzAbbr} ({tzOffset})
        </span>
      </div>

      {/* Relative time */}
      <div className="text-muted-foreground">
        {getRelativeTime(inputDate)}
      </div>

      {/* ISO string for technical reference */}
      <div className="pt-2 border-t text-xs text-muted-foreground font-mono">
        {isoString}
      </div>
    </div>
  );
}

// ============================================
// LOCALIZED DATE COMPONENT
// ============================================

export function LocalizedDate({
  date,
  timezone: overrideTimezone,
  relative = false,
  timeOnly = false,
  dateOnly = false,
  showTimezone = false,
  dateFormat = "medium",
  timeFormat = "short",
  hour24,
  showTooltip = true,
  className,
  prefix,
  suffix,
}: LocalizedDateProps) {
  const { timezone: userTimezone, preferences } = useTimezone();
  const timezone = overrideTimezone || userTimezone;
  const use24Hour = hour24 ?? preferences.use24HourFormat;

  const [displayText, setDisplayText] = React.useState<string>("");
  const inputDate = React.useMemo(() => new Date(date), [date]);

  // Update display text
  React.useEffect(() => {
    const updateDisplay = () => {
      let text: string;

      if (relative) {
        text = getRelativeTime(inputDate);
      } else if (timeOnly) {
        text = formatTime(inputDate, timezone, {
          hour12: !use24Hour,
          showTimezone,
        });
      } else if (dateOnly) {
        text = formatDate(inputDate, timezone, preferences.dateFormat);
      } else {
        text = formatDateTime(inputDate, timezone, {
          dateStyle: dateFormat,
          timeStyle: timeFormat,
          hour12: !use24Hour,
          showTimezone,
        });
      }

      setDisplayText(text);
    };

    updateDisplay();

    // Update relative time every minute
    if (relative) {
      const interval = setInterval(updateDisplay, 60000);
      return () => clearInterval(interval);
    }
  }, [
    inputDate,
    timezone,
    relative,
    timeOnly,
    dateOnly,
    showTimezone,
    dateFormat,
    timeFormat,
    use24Hour,
    preferences.dateFormat,
  ]);

  const content = (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <time dateTime={inputDate.toISOString()}>{displayText}</time>
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 hover:underline cursor-help",
            className
          )}
        >
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          <time dateTime={inputDate.toISOString()}>{displayText}</time>
          {suffix && <span className="text-muted-foreground">{suffix}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <DateTooltipContent date={inputDate} timezone={timezone} hour24={use24Hour} />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// DUE DATE DISPLAY COMPONENT
// ============================================

export function DueDateDisplay({
  dueDate,
  timezone: overrideTimezone,
  showTime = true,
  relative = true,
  showStatus = true,
  className,
}: DueDateDisplayProps) {
  const { timezone: userTimezone } = useTimezone();
  const timezone = overrideTimezone || userTimezone;

  const [displayData, setDisplayData] = React.useState<{
    text: string;
    status: ReturnType<typeof getDueDateStatus>;
  }>({ text: "", status: "upcoming" });

  const inputDate = React.useMemo(() => new Date(dueDate), [dueDate]);

  // Update display
  React.useEffect(() => {
    const updateDisplay = () => {
      const data = formatDueDate(inputDate, timezone, {
        showTime,
        showRelative: relative,
      });
      setDisplayData(data);
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 60000);
    return () => clearInterval(interval);
  }, [inputDate, timezone, showTime, relative]);

  const statusConfig = {
    overdue: {
      variant: "destructive" as const,
      icon: AlertCircle,
      className: "text-destructive",
    },
    "due-today": {
      variant: "secondary" as const,
      icon: Clock,
      className: "text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
    },
    "due-soon": {
      variant: "outline" as const,
      icon: Clock,
      className: "text-amber-600 dark:text-amber-500",
    },
    upcoming: {
      variant: "outline" as const,
      icon: Calendar,
      className: "text-muted-foreground",
    },
    "no-date": {
      variant: "outline" as const,
      icon: Calendar,
      className: "text-muted-foreground",
    },
  };

  const config = statusConfig[displayData.status];
  const Icon = config.icon;

  const content = (
    <span className={cn("inline-flex items-center gap-1.5", className, config.className)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{displayData.text}</span>
    </span>
  );

  if (!showStatus) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="hover:underline cursor-help">
            {content}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <DateTooltipContent date={inputDate} timezone={timezone} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant={config.variant}
          className={cn("cursor-help gap-1.5", className)}
        >
          <Icon className="h-3 w-3" />
          {displayData.text}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <DateTooltipContent date={inputDate} timezone={timezone} />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// ACTIVITY TIMESTAMP COMPONENT
// ============================================

export function ActivityTimestamp({
  timestamp,
  timezone: overrideTimezone,
  action,
  actor,
  className,
}: ActivityTimestampProps) {
  const { timezone: userTimezone, preferences } = useTimezone();
  const timezone = overrideTimezone || userTimezone;

  const [relativeTime, setRelativeTime] = React.useState<string>("");
  const inputDate = React.useMemo(() => new Date(timestamp), [timestamp]);

  // Update relative time
  React.useEffect(() => {
    const updateTime = () => {
      setRelativeTime(getRelativeTime(inputDate));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [inputDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline cursor-help",
            className
          )}
        >
          {actor && <span className="font-medium text-foreground">{actor}</span>}
          {action && <span>{action}</span>}
          <time dateTime={inputDate.toISOString()}>{relativeTime}</time>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <DateTooltipContent
          date={inputDate}
          timezone={timezone}
          hour24={preferences.use24HourFormat}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// SCHEDULED ITEM DISPLAY
// ============================================

export function ScheduledItemDate({
  date,
  timezone: overrideTimezone,
  label = "Scheduled for",
  showTime = true,
  className,
}: {
  date: Date | string | number;
  timezone?: string;
  label?: string;
  showTime?: boolean;
  className?: string;
}) {
  const { timezone: userTimezone, preferences } = useTimezone();
  const timezone = overrideTimezone || userTimezone;
  const inputDate = React.useMemo(() => new Date(date), [date]);

  const [displayText, setDisplayText] = React.useState<string>("");

  React.useEffect(() => {
    const text = getSmartRelativeDate(inputDate, timezone, {
      showTime,
      hour12: !preferences.use24HourFormat,
    });
    setDisplayText(text);
  }, [inputDate, timezone, showTime, preferences.use24HourFormat]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 text-sm hover:underline cursor-help",
            className
          )}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {label && <span className="text-muted-foreground">{label} </span>}
            <span className="font-medium">{displayText}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <DateTooltipContent
          date={inputDate}
          timezone={timezone}
          hour24={preferences.use24HourFormat}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// CALENDAR EVENT DATE RANGE
// ============================================

export function CalendarEventRange({
  startDate,
  endDate,
  timezone: overrideTimezone,
  allDay = false,
  className,
}: {
  startDate: Date | string | number;
  endDate: Date | string | number;
  timezone?: string;
  allDay?: boolean;
  className?: string;
}) {
  const { timezone: userTimezone, preferences } = useTimezone();
  const timezone = overrideTimezone || userTimezone;

  const start = React.useMemo(() => new Date(startDate), [startDate]);
  const end = React.useMemo(() => new Date(endDate), [endDate]);

  const [displayText, setDisplayText] = React.useState<string>("");

  React.useEffect(() => {
    const startDateStr = formatDate(start, timezone, preferences.dateFormat);
    const endDateStr = formatDate(end, timezone, preferences.dateFormat);
    const sameDay = startDateStr === endDateStr;

    if (allDay) {
      if (sameDay) {
        setDisplayText(startDateStr);
      } else {
        setDisplayText(`${startDateStr} - ${endDateStr}`);
      }
    } else {
      const startTime = formatTime(start, timezone, {
        hour12: !preferences.use24HourFormat,
      });
      const endTime = formatTime(end, timezone, {
        hour12: !preferences.use24HourFormat,
      });

      if (sameDay) {
        setDisplayText(`${startDateStr}, ${startTime} - ${endTime}`);
      } else {
        setDisplayText(
          `${startDateStr} ${startTime} - ${endDateStr} ${endTime}`
        );
      }
    }
  }, [start, end, timezone, allDay, preferences.dateFormat, preferences.use24HourFormat]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 text-sm hover:underline cursor-help",
            className
          )}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{displayText}</span>
          <Badge variant="outline" className="text-xs">
            {getTimezoneAbbreviation(timezone, start)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Start</p>
            <DateTooltipContent
              date={start}
              timezone={timezone}
              hour24={preferences.use24HourFormat}
            />
          </div>
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-1">End</p>
            <DateTooltipContent
              date={end}
              timezone={timezone}
              hour24={preferences.use24HourFormat}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// SIMPLE RELATIVE TIME (NO TOOLTIP)
// ============================================

export function RelativeTime({
  date,
  className,
  updateInterval = 60000,
}: {
  date: Date | string | number;
  className?: string;
  updateInterval?: number;
}) {
  const [relativeTime, setRelativeTime] = React.useState<string>("");
  const inputDate = React.useMemo(() => new Date(date), [date]);

  React.useEffect(() => {
    const updateTime = () => {
      setRelativeTime(getRelativeTime(inputDate));
    };
    updateTime();
    const interval = setInterval(updateTime, updateInterval);
    return () => clearInterval(interval);
  }, [inputDate, updateInterval]);

  return (
    <time dateTime={inputDate.toISOString()} className={className}>
      {relativeTime}
    </time>
  );
}

export default LocalizedDate;
