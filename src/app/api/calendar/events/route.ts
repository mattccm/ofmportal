import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const listEventsSchema = z.object({
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid start date format",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid end date format",
  }),
  creatorId: z.string().optional(),
  status: z.string().optional(),
  type: z.enum(["all", "request", "deadline", "reminder"]).optional(),
});

// ============================================
// EVENT TYPES
// ============================================

export type CalendarEventType = "request" | "deadline" | "reminder";

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
  color: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// COLOR MAPPING
// ============================================

const statusColors: Record<string, string> = {
  DRAFT: "#94a3b8",
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  SUBMITTED: "#8b5cf6",
  UNDER_REVIEW: "#f97316",
  NEEDS_REVISION: "#ef4444",
  APPROVED: "#10b981",
  CANCELLED: "#6b7280",
  ARCHIVED: "#9ca3af",
};

const reminderTypeColors: Record<string, string> = {
  UPCOMING: "#3b82f6",
  DUE_TODAY: "#f59e0b",
  OVERDUE: "#ef4444",
  ESCALATION: "#dc2626",
};

const urgencyColors: Record<string, string> = {
  LOW: "#94a3b8",
  NORMAL: "#3b82f6",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

// ============================================
// GET - Fetch calendar events
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = listEventsSchema.parse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      creatorId: searchParams.get("creatorId") || undefined,
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || "all",
    });

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    endDate.setHours(23, 59, 59, 999);

    const events: CalendarEvent[] = [];

    // Build base where clause for requests
    const requestWhere: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    if (params.creatorId) {
      requestWhere.creatorId = params.creatorId;
    }

    if (params.status) {
      requestWhere.status = params.status;
    }

    // ============================================
    // FETCH REQUEST EVENTS (creation dates)
    // ============================================
    if (params.type === "all" || params.type === "request") {
      const requests = await db.contentRequest.findMany({
        where: {
          ...requestWhere,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const request of requests) {
        events.push({
          id: `request-${request.id}`,
          title: request.title,
          description: request.description || undefined,
          date: request.createdAt.toISOString(),
          type: "request",
          status: request.status,
          urgency: request.urgency,
          creatorId: request.creatorId,
          creatorName: request.creator.name,
          requestId: request.id,
          color: statusColors[request.status] || "#6b7280",
          metadata: {
            requirements: request.requirements,
          },
        });
      }
    }

    // ============================================
    // FETCH DEADLINE EVENTS (due dates)
    // ============================================
    if (params.type === "all" || params.type === "deadline") {
      const deadlines = await db.contentRequest.findMany({
        where: {
          ...requestWhere,
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { dueDate: "asc" },
      });

      for (const request of deadlines) {
        if (request.dueDate) {
          const isOverdue = new Date(request.dueDate) < new Date();
          events.push({
            id: `deadline-${request.id}`,
            title: `Due: ${request.title}`,
            description: request.description || undefined,
            date: request.dueDate.toISOString(),
            type: "deadline",
            status: request.status,
            urgency: request.urgency,
            creatorId: request.creatorId,
            creatorName: request.creator.name,
            requestId: request.id,
            color: isOverdue ? "#ef4444" : urgencyColors[request.urgency] || "#3b82f6",
            metadata: {
              isOverdue,
            },
          });
        }
      }
    }

    // ============================================
    // FETCH REMINDER EVENTS
    // ============================================
    if (params.type === "all" || params.type === "reminder") {
      const reminderRequestWhere: Record<string, unknown> = {
        agencyId: session.user.agencyId,
      };

      if (params.creatorId) {
        reminderRequestWhere.creatorId = params.creatorId;
      }

      if (params.status) {
        reminderRequestWhere.status = params.status;
      }

      const reminderWhere: Record<string, unknown> = {
        request: reminderRequestWhere,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      const reminders = await db.reminder.findMany({
        where: reminderWhere,
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });

      for (const reminder of reminders) {
        events.push({
          id: `reminder-${reminder.id}`,
          title: `Reminder: ${reminder.request.title}`,
          description: `${reminder.type} reminder via ${reminder.channel}`,
          date: reminder.scheduledAt.toISOString(),
          type: "reminder",
          status: reminder.status,
          creatorId: reminder.request.creator.id,
          creatorName: reminder.request.creator.name,
          requestId: reminder.request.id,
          color: reminderTypeColors[reminder.type] || "#3b82f6",
          metadata: {
            reminderType: reminder.type,
            channel: reminder.channel,
            deliveryStatus: reminder.status,
            sentAt: reminder.sentAt?.toISOString(),
          },
        });
      }
    }

    // Sort all events by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      events,
      count: events.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Reschedule an event (update due date)
// ============================================

const rescheduleSchema = z.object({
  eventId: z.string(),
  newDate: z.string(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, newDate } = rescheduleSchema.parse(body);

    // Parse event ID to determine type
    const [eventType, ...idParts] = eventId.split("-");
    const id = idParts.join("-");
    const newDateObj = new Date(newDate);

    switch (eventType) {
      case "deadline": {
        // Update the request due date
        const request = await db.contentRequest.findFirst({
          where: {
            id,
            agencyId: session.user.agencyId,
          },
        });

        if (!request) {
          return NextResponse.json(
            { error: "Request not found" },
            { status: 404 }
          );
        }

        await db.contentRequest.update({
          where: { id },
          data: { dueDate: newDateObj },
        });

        // Log activity
        await db.activityLog.create({
          data: {
            userId: session.user.id,
            action: "request.rescheduled",
            entityType: "ContentRequest",
            entityId: id,
            metadata: {
              oldDueDate: request.dueDate?.toISOString(),
              newDueDate: newDateObj.toISOString(),
            },
          },
        });

        return NextResponse.json({
          message: "Due date updated successfully",
          newDate: newDateObj.toISOString(),
        });
      }

      case "reminder": {
        // Update the reminder scheduled date
        const reminder = await db.reminder.findFirst({
          where: {
            id,
            request: {
              agencyId: session.user.agencyId,
            },
            status: "PENDING",
          },
        });

        if (!reminder) {
          return NextResponse.json(
            { error: "Reminder not found or already sent" },
            { status: 404 }
          );
        }

        await db.reminder.update({
          where: { id },
          data: { scheduledAt: newDateObj },
        });

        return NextResponse.json({
          message: "Reminder rescheduled successfully",
          newDate: newDateObj.toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { error: "This event type cannot be rescheduled" },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error rescheduling event:", error);
    return NextResponse.json(
      { error: "Failed to reschedule event" },
      { status: 500 }
    );
  }
}
