"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Countdown,
  StateIcon,
  StateLegend,
  formatDay,
  requestStatusState,
  stateShort,
  type FieldState,
} from "@/components/title-wall";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { isRequestOverdue } from "@/lib/request-status";

// Approved, cancelled and archived requests never reach the creator
type RequestStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION";

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: RequestStatus;
  urgency: string;
  createdAt: string;
  _count: {
    uploads: number;
    comments: number;
  };
}

/** Phone day cells: a dot per request in its state's colour (the key shows each state's icon and word) */
const DOT_CLASS: Record<FieldState, string> = {
  waiting: "outline outline-[1.5px] -outline-offset-[1.5px] outline-waiting",
  overdue: "bg-late",
  changes: "bg-changes",
  ready: "bg-ready",
  approved: "bg-approved",
};

export default function CreatorCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    fetchRequests();
  }, [router]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get calendar days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Group requests by due date
  const requestsByDate = useMemo(() => {
    const grouped: Record<string, Request[]> = {};

    requests.forEach((request) => {
      if (request.dueDate) {
        const dateKey = format(new Date(request.dueDate), "yyyy-MM-dd");
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(request);
      }
    });

    return grouped;
  }, [requests]);

  // Get requests for selected date
  const selectedDateRequests = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return requestsByDate[dateKey] || [];
  }, [selectedDate, requestsByDate]);

  // Upcoming requests (next 7 days)
  const upcomingRequests = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return requests
      .filter((r) => {
        if (!r.dueDate) return false;
        const dueDate = new Date(r.dueDate);
        return dueDate >= now && dueDate <= sevenDaysFromNow;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [requests]);

  /** One state per request, from the shared state vocabulary */
  const stateOf = (r: Request): FieldState => requestStatusState(r.status, isRequestOverdue(r)) ?? "waiting";
  const dotClass = (r: Request) => DOT_CLASS[stateOf(r)];
  const stateWord = (r: Request) => stateShort(stateOf(r), "creator");

  if (loading) {
    return (
      <div className="px-4 pt-5 lg:px-6 lg:pt-10" role="status" aria-label="Loading your calendar">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-4 h-80 w-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    );
  }

  const open = requests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS" || r.status === "NEEDS_REVISION");
  const late = open.filter((r) => isRequestOverdue(r));
  const next = [...open]
    .filter((r) => r.dueDate && !isRequestOverdue(r))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  const lede =
    open.length === 0
      ? "Nothing due. New deadlines appear here."
      : [
          late.length ? `${late.length} late` : null,
          next ? `next due ${formatDay(next.dueDate!)}` : null,
        ]
          .filter(Boolean)
          .join(", ")
          .replace(/^./, (c) => c.toUpperCase()) + ".";

  const renderRow = (request: Request) => {
    const ACT = request.status === "PENDING" || request.status === "IN_PROGRESS" || request.status === "NEEDS_REVISION";
    return (
      <Link
        href={`/creator/requests/${request.id}`}
        className="flex items-center gap-3 rounded-[10px] bg-tile p-3.5 transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <StateIcon state={stateOf(request)} className="size-4" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{request.title}</span>
          <span className="block text-[14px] text-ink-2">
            {request.dueDate && ACT && isRequestOverdue(request) ? (
              <Countdown due={request.dueDate} />
            ) : (
              <>
                {stateWord(request)}
                {request.dueDate && ACT ? (
                  <>
                    {" · "}
                    <Countdown due={request.dueDate} />
                  </>
                ) : null}
              </>
            )}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-icon" aria-hidden="true" />
      </Link>
    );
  };

  return (
    <div className="px-4 pt-5 lg:px-6 lg:pt-10">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] lg:text-[26px]">Calendar</h1>
      <p className="mt-1 text-[15px] leading-normal text-ink-2">{lede}</p>

      {/* From 1024px: the month on the left, the chosen day and the week ahead on the right */}
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-10">
        <section aria-labelledby="month-h" className="mt-4 rounded-[var(--tw-r-tile)] bg-tile p-3 lg:mt-0 lg:p-4">
          <div className="flex items-center gap-1 px-1">
            <h2 id="month-h" className="flex-1 text-[17px] font-semibold" aria-live="polite">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-9"
              aria-label="Previous month"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" className="h-11 px-3 md:h-9" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-9"
              aria-label="Next month"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-7" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-1.5 text-center text-[13px] text-ink-2 lg:pl-2.5 lg:text-left">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayRequests = requestsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = !!selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  aria-pressed={isSelected}
                  aria-label={`${format(day, "EEEE d MMMM")}${dayRequests.length ? `, ${dayRequests.length} due` : ""}${today ? ", today" : ""}`}
                  className={cn(
                    "relative flex min-h-11 flex-col items-center justify-start rounded-md pb-2 pt-1.5 text-[15px] tabular-nums transition-colors",
                    "lg:min-h-[92px] lg:items-stretch lg:px-1.5 lg:text-[14px]",
                    "hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    !isCurrentMonth && "text-ink-2",
                    isSelected && "!bg-tile-hi"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full lg:self-start",
                      today && "bg-ink font-semibold text-ground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayRequests.length > 0 && (
                    <>
                      <span className="mt-1 flex gap-[3px] lg:hidden" aria-hidden="true">
                        {dayRequests.slice(0, 3).map((request) => (
                          <span key={request.id} className={cn("size-1.5 rounded-full", dotClass(request))} />
                        ))}
                      </span>
                      {/* Desktop: the titles due that day */}
                      <span className="mt-1 hidden min-w-0 flex-col gap-1 text-left lg:flex" aria-hidden="true">
                        {dayRequests.slice(0, 2).map((request) => (
                          <span key={request.id} className="flex min-w-0 items-center gap-1.5 text-[12px] leading-tight">
                            <StateIcon state={stateOf(request)} className="size-3" />
                            <span className="truncate">{request.title}</span>
                          </span>
                        ))}
                        {dayRequests.length > 2 && (
                          <span className="text-[12px] leading-tight text-ink-2">{dayRequests.length - 2} more</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <StateLegend
            className="mt-3 px-1"
            kind="icons"
            audience="creator"
            states={["waiting", "overdue", "changes", "ready"]}
          />
        </section>

        <div className="lg:space-y-8">
          {selectedDate && (
            <section aria-labelledby="day-h" className="mt-6 lg:mt-0">
              <h2 id="day-h" className="mb-2 text-[17px] font-semibold">
                {format(selectedDate, "EEEE d MMMM")}
              </h2>
              {selectedDateRequests.length === 0 ? (
                <p className="text-[15px] text-ink-2">Nothing due this day.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedDateRequests.map((r) => (
                    <li key={r.id}>
                      {renderRow(r)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="soon-h" className="mt-6 lg:mt-0">
            <h2 id="soon-h" className="mb-2 text-[17px] font-semibold">
              Due in the next 7 days
            </h2>
            {late.length + upcomingRequests.length === 0 ? (
              <p className="text-[15px] leading-normal text-ink-2">Nothing due this week.</p>
            ) : (
              <ul className="space-y-2">
                {[...late, ...upcomingRequests.filter((r) => !late.includes(r))].slice(0, 8).map((r) => (
                  <li key={r.id}>
                    {renderRow(r)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
