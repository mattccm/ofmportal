"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FIELD_STATE_ICON,
  FIELD_STATE_SHORT,
  FIELD_STATE_TEXT,
  StateLegend,
  requestStatusState,
  type FieldState,
} from "@/components/title-wall";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Bell,
  FileText,
  Flag,
  Eye,
  CalendarDays,
  MoreHorizontal,
  GripVertical,
  User,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  getHours,
  setHours,
  setMinutes,
} from "date-fns";

// TYPES

export type CalendarEventType = "request" | "deadline" | "reminder";
export type ViewMode = "month" | "week" | "day";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: CalendarEventType;
  status?: string;
  urgency?: string;
  creatorId?: string;
  creatorName?: string;
  requestId?: string;
  /** The request's state, when the event shows one (see /api/calendar/events) */
  state?: FieldState | null;
  color: string;
  metadata?: Record<string, unknown>;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onEventReschedule?: (eventId: string, newDate: Date) => void;
  onDateSelect?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
  isLoading?: boolean;
  initialDate?: Date;
  initialView?: ViewMode;
}

// HOW AN EVENT LOOKS
// Requests carry their state as the shared vocabulary's icon in its colour
// (plus the word for screen readers and in the detail panel). Due dates and
// reminders are not states: neutral ink with their own icon, and a due date
// turns red only when it is overdue. No coloured edges or tints.

export interface EventLook {
  Icon: typeof FileText;
  /** Icon colour utility (the only colour an event carries) */
  iconClass: string;
  /** What the colour and icon mean, for the accessible name and the detail panel */
  word: string;
  state: FieldState | null;
}

export function eventLook(event: CalendarEvent): EventLook {
  const overdue = Boolean(event.metadata?.isOverdue);
  if (event.type === "reminder") {
    return { Icon: Bell, iconClass: "text-ink-2", word: "Reminder", state: null };
  }
  if (event.type === "deadline") {
    return overdue
      ? { Icon: FIELD_STATE_ICON.overdue, iconClass: FIELD_STATE_TEXT.overdue, word: "Overdue", state: "overdue" }
      : { Icon: Flag, iconClass: "text-ink-2", word: "Due date", state: null };
  }
  const state = event.state !== undefined ? event.state : requestStatusState(event.status ?? "", overdue);
  if (!state) return { Icon: FileText, iconClass: "text-ink-2", word: "Request", state: null };
  return {
    Icon: FIELD_STATE_ICON[state],
    iconClass: FIELD_STATE_TEXT[state],
    word: FIELD_STATE_SHORT[state],
    state,
  };
}

// CALENDAR VIEW COMPONENT

export function CalendarView({
  events,
  onEventClick,
  onEventReschedule,
  onDateSelect,
  onCreateEvent,
  isLoading = false,
  initialDate = new Date(),
  initialView = "month",
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  // Touch handling state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [, setIsTouchDragging] = useState(false);

  // NAVIGATION

  const navigatePrevious = useCallback(() => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  }, [currentDate, viewMode]);

  const navigateNext = useCallback(() => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  }, [currentDate, viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // DRAG AND DROP HANDLERS

  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    e.dataTransfer.setData("text/plain", event.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedEvent(event);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");

    if (eventId && onEventReschedule) {
      onEventReschedule(eventId, date);
    }

    setDraggedEvent(null);
    setDragOverDate(null);
  }, [onEventReschedule]);

  // TOUCH GESTURE HANDLERS

  const handleTouchStart = useCallback((e: React.TouchEvent, event?: CalendarEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    if (event) {
      // Long press to start drag
      const longPressTimer = setTimeout(() => {
        setIsTouchDragging(true);
        setDraggedEvent(event);
      }, 500);

      // Store timer ID for cleanup
      (e.target as HTMLElement).dataset.longPressTimer = String(longPressTimer);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;

    // Clear long press timer if moved too much
    const longPressTimer = (e.target as HTMLElement).dataset.longPressTimer;
    if (longPressTimer && Math.abs(deltaX) > 10) {
      clearTimeout(Number(longPressTimer));
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const longPressTimer = (e.target as HTMLElement).dataset.longPressTimer;
    if (longPressTimer) {
      clearTimeout(Number(longPressTimer));
    }

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Swipe detection for navigation
    if (Math.abs(deltaX) > 50 && deltaTime < 300) {
      if (deltaX > 0) {
        navigatePrevious();
      } else {
        navigateNext();
      }
    }

    touchStartRef.current = null;
    setIsTouchDragging(false);
    setDraggedEvent(null);
  }, [navigatePrevious, navigateNext]);

  // EVENT HELPERS

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = parseISO(event.date);
      return isSameDay(eventDate, date);
    });
  }, [events]);

  const getEventsForHour = useCallback((date: Date, hour: number): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = parseISO(event.date);
      return isSameDay(eventDate, date) && getHours(eventDate) === hour;
    });
  }, [events]);

  // RENDER HELPERS

  const renderEventCard = (event: CalendarEvent, compact = false) => {
    const look = eventLook(event);
    const Icon = look.Icon;
    const isDragging = draggedEvent?.id === event.id;

    return (
      <div
        key={event.id}
        draggable={!!onEventReschedule}
        onDragStart={(e) => handleDragStart(e, event)}
        onTouchStart={(e) => handleTouchStart(e, event)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          onEventClick?.(event);
        }}
        className={cn(
          "group relative cursor-pointer rounded-lg border bg-card p-2 transition-colors duration-200",
          "hover:bg-tile-hi",
          isDragging && "opacity-50",
          compact && "p-1.5"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tile-hi">
            <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", look.iconClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-foreground truncate",
              compact ? "text-xs" : "text-sm"
            )}>
              <span className="sr-only">{look.word}: </span>
              {event.title}
            </p>
            {!compact && event.creatorName && (
              <div className="flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">
                  {event.creatorName}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {format(parseISO(event.date), "h:mm a")}
              </span>
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label={`More actions for ${event.title}`}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEventClick?.(event)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {event.type !== "request" && (
                  <DropdownMenuItem onClick={() => {
                    // Could open a date picker modal
                    onEventClick?.(event);
                  }}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Reschedule
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {!compact && (
          <div className="absolute top-1/2 -translate-y-1/2 -left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };

  // MONTH VIEW

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

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

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div className="flex flex-col h-full">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-muted-foreground"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-rows-6">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((day) => {
                const dayEvents = getEventsForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDragOver = dragOverDate && isSameDay(day, dragOverDate);
                const dayIsToday = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    onDragOver={(e) => handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    onClick={() => {
                      onDateSelect?.(day);
                      if (viewMode === "month") {
                        setCurrentDate(day);
                        setViewMode("day");
                      }
                    }}
                    className={cn(
                      "min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 border-r border-border last:border-r-0 cursor-pointer transition-colors",
                      !isCurrentMonth && "bg-muted/30",
                      isDragOver && "bg-primary/10 ring-2 ring-primary ring-inset",
                      "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                          !isCurrentMonth && "text-muted-foreground",
                          dayIsToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-xs hidden sm:flex"
                        >
                          {dayEvents.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((event) => {
                        const look = eventLook(event);
                        const Icon = look.Icon;
                        return (
                          <div
                            key={event.id}
                            draggable={!!onEventReschedule}
                            onDragStart={(e) => handleDragStart(e, event)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className={cn(
                              "flex min-w-0 cursor-pointer items-center gap-1 rounded bg-tile-hi px-1.5 py-0.5 text-xs font-medium text-foreground transition-colors",
                              "hover:bg-raised",
                              draggedEvent?.id === event.id && "opacity-50"
                            )}
                          >
                            <Icon aria-hidden="true" className={cn("size-3 shrink-0", look.iconClass)} />
                            <span className="sr-only">{look.word}: </span>
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // WEEK VIEW

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col h-full overflow-auto">
        {/* Day headers */}
        <div className="sticky top-0 z-20 bg-background border-b border-border">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div className="p-2 border-r border-border" />
            {days.map((day) => {
              const dayIsToday = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode("day");
                  }}
                  className={cn(
                    "p-2 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-accent/50",
                    dayIsToday && "bg-primary/5"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex h-8 w-8 items-center justify-center rounded-full mx-auto text-sm font-semibold",
                      dayIsToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hour grid */}
        <div className="flex-1">
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border"
            >
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r border-border">
                {format(setHours(new Date(), hour), "h a")}
              </div>
              {days.map((day) => {
                const hourEvents = getEventsForHour(day, hour);
                const cellDate = setHours(setMinutes(day, 0), hour);
                const isDragOver = dragOverDate && isSameDay(cellDate, dragOverDate) && getHours(dragOverDate) === hour;

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    onDragOver={(e) => handleDragOver(e, cellDate)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cellDate)}
                    onClick={() => onCreateEvent?.(cellDate)}
                    className={cn(
                      "min-h-[60px] p-1 border-r border-border last:border-r-0 cursor-pointer",
                      isDragOver && "bg-primary/10 ring-2 ring-primary ring-inset",
                      "hover:bg-accent/30"
                    )}
                  >
                    <div className="space-y-1">
                      {hourEvents.map((event) => renderEventCard(event, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // DAY VIEW

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayIsToday = isToday(currentDate);

    return (
      <div className="flex flex-col h-full overflow-auto">
        {/* Day header */}
        <div className="sticky top-0 z-20 bg-background border-b border-border p-4 text-center">
          <div className="text-sm text-muted-foreground">
            {format(currentDate, "EEEE")}
          </div>
          <div
            className={cn(
              "mt-1 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold",
              dayIsToday && "bg-primary text-primary-foreground"
            )}
          >
            {format(currentDate, "d")}
          </div>
        </div>

        {/* Hour grid */}
        <div className="flex-1">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(currentDate, hour);
            const cellDate = setHours(setMinutes(currentDate, 0), hour);
            const isDragOver = dragOverDate && getHours(dragOverDate) === hour;
            const isCurrentHour = dayIsToday && new Date().getHours() === hour;

            return (
              <div
                key={hour}
                onDragOver={(e) => handleDragOver(e, cellDate)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, cellDate)}
                onClick={() => onCreateEvent?.(cellDate)}
                className={cn(
                  "grid grid-cols-[80px_1fr] border-b border-border cursor-pointer",
                  isDragOver && "bg-primary/10",
                  isCurrentHour && "bg-primary/5",
                  "hover:bg-accent/30"
                )}
              >
                <div className={cn(
                  "p-3 text-sm text-right pr-4 border-r border-border",
                  isCurrentHour ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {format(setHours(new Date(), hour), "h:mm a")}
                </div>
                <div className="min-h-[80px] p-2">
                  <div className="space-y-2">
                    {hourEvents.map((event) => renderEventCard(event))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // MAIN RENDER

  return (
    <div
      className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button aria-label="Previous"
            variant="outline"
            size="sm"
            onClick={navigatePrevious}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button aria-label="Next"
            variant="outline"
            size="sm"
            onClick={navigateNext}
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {viewMode === "month" && format(currentDate, "MMMM yyyy")}
            {viewMode === "week" && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d, yyyy")}`}
            {viewMode === "day" && format(currentDate, "MMMM d, yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="text-sm"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Today
          </Button>

          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded-none text-sm capitalize px-3",
                  viewMode === mode && "bg-primary text-primary-foreground"
                )}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 overflow-auto relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}
          </>
        )}
      </div>

      {/* Key: requests in the state vocabulary, then the neutral event types */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border p-3">
        <StateLegend kind="icons" />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] leading-normal text-ink-2" aria-label="Other events">
          <li className="inline-flex items-center gap-1.5">
            <Flag aria-hidden="true" className="size-3.5 text-ink-2" />
            Due date
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Bell aria-hidden="true" className="size-3.5 text-ink-2" />
            Reminder
          </li>
        </ul>
      </div>
    </div>
  );
}
