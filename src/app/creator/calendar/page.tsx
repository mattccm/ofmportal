"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "@/components/providers/branding-provider";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

type RequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED";

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

export default function CreatorCalendarPage() {
  const router = useRouter();
  const { branding } = useBranding();
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

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500";
      case "IN_PROGRESS":
        return "bg-blue-500";
      case "SUBMITTED":
        return "bg-violet-500";
      case "UNDER_REVIEW":
        return "bg-indigo-500";
      case "NEEDS_REVISION":
        return "bg-red-500";
      case "APPROVED":
        return "bg-emerald-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadgeColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "SUBMITTED":
        return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
      case "UNDER_REVIEW":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "NEEDS_REVISION":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          View your upcoming deadlines and requests
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayRequests = requestsByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasOverdue = dayRequests.some(
                  (r) =>
                    isPast(new Date(r.dueDate!)) &&
                    r.status !== "APPROVED" &&
                    r.status !== "SUBMITTED"
                );

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "relative aspect-square p-1 rounded-lg text-sm transition-all",
                      "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isSelected && "ring-2 ring-primary bg-primary/10",
                      isToday(day) && !isSelected && "bg-muted font-bold"
                    )}
                  >
                    <span className={cn(
                      "block w-6 h-6 mx-auto flex items-center justify-center rounded-full",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </span>

                    {/* Request indicators */}
                    {dayRequests.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayRequests.slice(0, 3).map((request, i) => (
                          <div
                            key={request.id}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              getStatusColor(request.status)
                            )}
                          />
                        ))}
                        {dayRequests.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">
                            +{dayRequests.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected date details */}
            {selectedDate && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-medium mb-3">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </h3>
                {selectedDateRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No requests due on this date
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateRequests.map((request) => (
                      <Link
                        key={request.id}
                        href={`/creator/requests/${request.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            getStatusColor(request.status)
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {request.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn("text-xs mt-1", getStatusBadgeColor(request.status))}
                          >
                            {request.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5" style={{ color: branding.primaryColor }} />
                Coming Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingRequests.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No upcoming deadlines
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingRequests.slice(0, 5).map((request) => {
                    const dueDate = new Date(request.dueDate!);
                    const isOverdue = isPast(dueDate) && request.status !== "APPROVED";

                    return (
                      <Link
                        key={request.id}
                        href={`/creator/requests/${request.id}`}
                        className="flex items-start gap-3 group"
                      >
                        <div className="w-10 text-center shrink-0">
                          <p className="text-lg font-bold" style={{ color: branding.primaryColor }}>
                            {format(dueDate, "d")}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {format(dueDate, "MMM")}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {request.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className={cn("text-[10px]", getStatusBadgeColor(request.status))}
                            >
                              {request.status.replace("_", " ")}
                            </Badge>
                            {isOverdue && (
                              <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { status: "PENDING", label: "Pending" },
                  { status: "IN_PROGRESS", label: "In Progress" },
                  { status: "NEEDS_REVISION", label: "Needs Revision" },
                  { status: "SUBMITTED", label: "Submitted" },
                  { status: "APPROVED", label: "Approved" },
                ].map((item) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        getStatusColor(item.status as RequestStatus)
                      )}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ color: branding.primaryColor }}
                  >
                    {requests.filter(
                      (r) =>
                        r.status === "PENDING" ||
                        r.status === "IN_PROGRESS" ||
                        r.status === "NEEDS_REVISION"
                    ).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-500">
                    {requests.filter((r) => r.status === "APPROVED").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
