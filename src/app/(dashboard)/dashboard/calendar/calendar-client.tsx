"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarView, CalendarEvent, CalendarEventType } from "@/components/calendar/calendar-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Filter,
  X,
  FileText,
  AlertCircle,
  Bell,
  Calendar,
  Clock,
  User,
  ExternalLink,
  Plus,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface CalendarClientProps {
  creators: Creator[];
}

// Status options for filtering
const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "NEEDS_REVISION", label: "Needs Revision" },
  { value: "APPROVED", label: "Approved" },
];

// Event type options for filtering
const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "request", label: "Requests" },
  { value: "deadline", label: "Deadlines" },
  { value: "reminder", label: "Reminders" },
];

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "badge-info" },
    PENDING: { label: "Pending", className: "badge-warning" },
    IN_PROGRESS: { label: "In Progress", className: "badge-info" },
    SUBMITTED: { label: "Submitted", className: "badge-purple" },
    UNDER_REVIEW: { label: "Under Review", className: "badge-warning" },
    NEEDS_REVISION: { label: "Needs Revision", className: "badge-error" },
    APPROVED: { label: "Approved", className: "badge-success" },
    CANCELLED: { label: "Cancelled", className: "badge-info" },
    ARCHIVED: { label: "Archived", className: "badge-info" },
  };

  const config = statusConfig[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// EVENT DETAIL PANEL
// ============================================

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onReschedule: (eventId: string, newDate: Date) => void;
  isOpen: boolean;
  isMobile: boolean;
}

function EventDetailPanel({ event, onClose, onReschedule, isOpen, isMobile }: EventDetailPanelProps) {
  const router = useRouter();

  if (!event) return null;

  const eventTypeIcons: Record<CalendarEventType, typeof FileText> = {
    request: FileText,
    deadline: AlertCircle,
    reminder: Bell,
  };

  const Icon = eventTypeIcons[event.type];

  const content = (
    <div className="space-y-6">
      {/* Event header */}
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${event.color}20` }}
        >
          <Icon className="h-6 w-6" style={{ color: event.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground capitalize">
            {event.type}
          </p>
        </div>
      </div>

      {/* Event details */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-foreground">
            {format(parseISO(event.date), "EEEE, MMMM d, yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-foreground">
            {format(parseISO(event.date), "h:mm a")}
          </span>
        </div>

        {event.creatorName && (
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">{event.creatorName}</span>
          </div>
        )}

        {event.status && (
          <div className="flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <StatusBadge status={event.status} />
          </div>
        )}

        {event.description && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {Boolean(event.metadata?.isOverdue) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">This deadline is overdue</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4 border-t border-border">
        {event.requestId && (
          <Button
            onClick={() => router.push(`/dashboard/requests/${event.requestId}`)}
            className="w-full justify-between"
          >
            View Request Details
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}

        {event.type !== "request" && (
          <Button
            variant="outline"
            onClick={() => {
              // For now, just show a toast - could open a date picker
              toast.info("Reschedule feature coming soon!");
            }}
            className="w-full justify-between"
          >
            Reschedule
            <Calendar className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={() => onClose()}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Event Details</SheetTitle>
            <SheetDescription>
              View and manage this calendar event
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 overflow-auto">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Event Details</DialogTitle>
          <DialogDescription>
            View and manage this calendar event
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN CALENDAR CLIENT COMPONENT
// ============================================

export function CalendarClient({ creators }: CalendarClientProps) {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Event detail panel
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventPanelOpen, setIsEventPanelOpen] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ============================================
  // FETCH EVENTS
  // ============================================

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get date range for current view (extend to cover month navigation)
      const startDate = subMonths(startOfMonth(currentDate), 1);
      const endDate = addMonths(endOfMonth(currentDate), 1);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (creatorFilter && creatorFilter !== "all") {
        params.append("creatorId", creatorFilter);
      }

      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (typeFilter && typeFilter !== "all") {
        params.append("type", typeFilter);
      }

      const response = await fetch(`/api/calendar/events?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      toast.error("Failed to load calendar events");
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, creatorFilter, statusFilter, typeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventPanelOpen(true);
  }, []);

  const handleEventReschedule = useCallback(async (eventId: string, newDate: Date) => {
    try {
      const response = await fetch("/api/calendar/events", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          newDate: newDate.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule event");
      }

      toast.success("Event rescheduled successfully");
      fetchEvents();
    } catch (error) {
      console.error("Error rescheduling event:", error);
      toast.error("Failed to reschedule event");
    }
  }, [fetchEvents]);

  const handleDateSelect = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleCreateEvent = useCallback((date: Date) => {
    // Navigate to create request page with date pre-filled
    const formattedDate = format(date, "yyyy-MM-dd");
    router.push(`/dashboard/requests/new?dueDate=${formattedDate}`);
  }, [router]);

  const clearFilters = useCallback(() => {
    setCreatorFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  }, []);

  const hasActiveFilters = creatorFilter !== "all" || statusFilter !== "all" || typeFilter !== "all";

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filters bar */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Mobile filter toggle */}
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 px-1.5">
                  {[creatorFilter, statusFilter, typeFilter].filter(f => f !== "all").length}
                </Badge>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/dashboard/requests/new")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>

          {/* Filter controls - always visible on desktop, toggle on mobile */}
          <div className={cn(
            "flex flex-col sm:flex-row gap-3 sm:items-center",
            !showFilters && "hidden sm:flex"
          )}>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Creators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Creators</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <AlertCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Desktop new request button */}
          <div className="hidden sm:flex sm:ml-auto">
            <Button
              variant="default"
              onClick={() => router.push("/dashboard/requests/new")}
              className="btn-gradient"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-[500px] lg:min-h-[600px]">
        <CalendarView
          events={events}
          onEventClick={handleEventClick}
          onEventReschedule={handleEventReschedule}
          onDateSelect={handleDateSelect}
          onCreateEvent={handleCreateEvent}
          isLoading={isLoading}
          initialDate={currentDate}
        />
      </div>

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => {
          setIsEventPanelOpen(false);
          setSelectedEvent(null);
        }}
        onReschedule={handleEventReschedule}
        isOpen={isEventPanelOpen}
        isMobile={isMobile}
      />
    </div>
  );
}
