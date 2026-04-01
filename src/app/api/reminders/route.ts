import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const listRemindersSchema = z.object({
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  creatorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const bulkActionSchema = z.object({
  action: z.enum(["cancel", "reschedule", "sendNow"]),
  reminderIds: z.array(z.string()).min(1),
  rescheduleDate: z.string().optional(),
});

// ============================================
// GET - List all reminders for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = listRemindersSchema.parse({
      status: searchParams.get("status") || undefined,
      creatorId: searchParams.get("creatorId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    // Build the where clause
    const where: Record<string, unknown> = {
      request: {
        agencyId: session.user.agencyId,
      },
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.creatorId) {
      where.request = {
        ...where.request as Record<string, unknown>,
        creatorId: params.creatorId,
      };
    }

    if (params.startDate || params.endDate) {
      where.scheduledAt = {};
      if (params.startDate) {
        (where.scheduledAt as Record<string, unknown>).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        (where.scheduledAt as Record<string, unknown>).lte = new Date(params.endDate);
      }
    }

    const [reminders, total] = await Promise.all([
      db.reminder.findMany({
        where,
        include: {
          request: {
            select: {
              id: true,
              title: true,
              dueDate: true,
              status: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.reminder.count({ where }),
    ]);

    return NextResponse.json({
      reminders,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Bulk actions on reminders
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, reminderIds, rescheduleDate } = bulkActionSchema.parse(body);

    // Verify all reminders belong to this agency
    const reminders = await db.reminder.findMany({
      where: {
        id: { in: reminderIds },
        request: {
          agencyId: session.user.agencyId,
        },
      },
      include: {
        request: {
          select: {
            id: true,
            creator: {
              select: {
                email: true,
                phone: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (reminders.length !== reminderIds.length) {
      return NextResponse.json(
        { error: "One or more reminders not found or unauthorized" },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case "cancel":
        // Delete pending reminders
        result = await db.reminder.deleteMany({
          where: {
            id: { in: reminderIds },
            status: "PENDING",
          },
        });
        return NextResponse.json({
          message: `Cancelled ${result.count} reminder(s)`,
          cancelled: result.count,
        });

      case "reschedule":
        if (!rescheduleDate) {
          return NextResponse.json(
            { error: "Reschedule date is required" },
            { status: 400 }
          );
        }
        result = await db.reminder.updateMany({
          where: {
            id: { in: reminderIds },
            status: "PENDING",
          },
          data: {
            scheduledAt: new Date(rescheduleDate),
          },
        });
        return NextResponse.json({
          message: `Rescheduled ${result.count} reminder(s)`,
          rescheduled: result.count,
        });

      case "sendNow":
        // Mark reminders as ready to be sent by updating scheduledAt to now
        // The actual sending would be handled by the cron job or send endpoint
        result = await db.reminder.updateMany({
          where: {
            id: { in: reminderIds },
            status: "PENDING",
          },
          data: {
            scheduledAt: new Date(),
          },
        });
        return NextResponse.json({
          message: `${result.count} reminder(s) queued for immediate delivery`,
          queued: result.count,
        });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
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

    console.error("Error performing bulk action:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
