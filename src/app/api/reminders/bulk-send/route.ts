import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  bulkReminderSchema,
  generateOperationId,
  chunkArray,
  type ReminderFilter,
} from "@/lib/bulk-operations";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { format, subDays, addHours, addDays, startOfDay } from "date-fns";
import { z } from "zod";

interface ReminderResult {
  requestId: string;
  requestTitle: string;
  creatorId: string;
  creatorName: string;
  success: boolean;
  channels: string[];
  error?: string;
}

function getFilterWhereClause(filter: ReminderFilter, agencyId: string) {
  const now = new Date();
  const today = startOfDay(now);

  const baseWhere = {
    agencyId,
    status: { in: ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"] as ("PENDING" | "IN_PROGRESS" | "NEEDS_REVISION")[] },
  };

  switch (filter) {
    case "overdue":
      return {
        ...baseWhere,
        dueDate: { lt: today },
      };

    case "due_within_24h":
      return {
        ...baseWhere,
        dueDate: {
          gte: now,
          lte: addHours(now, 24),
        },
      };

    case "due_within_48h":
      return {
        ...baseWhere,
        dueDate: {
          gte: now,
          lte: addHours(now, 48),
        },
      };

    case "due_within_week":
      return {
        ...baseWhere,
        dueDate: {
          gte: now,
          lte: addDays(now, 7),
        },
      };

    case "no_activity_7d":
      return {
        ...baseWhere,
        updatedAt: { lt: subDays(now, 7) },
      };

    default:
      return baseWhere;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkReminderSchema.parse(body);

    const operationId = generateOperationId();
    const results: ReminderResult[] = [];

    // Get requests based on filter
    let requests;

    if (validatedData.filter === "custom" && validatedData.requestIds) {
      // Custom filter with specific request IDs
      requests = await db.contentRequest.findMany({
        where: {
          id: { in: validatedData.requestIds },
          agencyId: session.user.agencyId,
          status: { in: ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"] },
        },
        include: {
          creator: true,
        },
      });
    } else {
      // Predefined filter
      const whereClause = getFilterWhereClause(
        validatedData.filter,
        session.user.agencyId
      );

      requests = await db.contentRequest.findMany({
        where: whereClause,
        include: {
          creator: true,
        },
        orderBy: { dueDate: "asc" },
        take: 500, // Limit for safety
      });
    }

    if (requests.length === 0) {
      return NextResponse.json({
        success: true,
        operationId,
        sent: 0,
        failed: 0,
        total: 0,
        results: [],
        message: "No matching requests found",
      });
    }

    // Process reminders in chunks
    const chunks = chunkArray(requests, 50);

    for (const chunk of chunks) {
      const reminderPromises = chunk.map(async (request) => {
        const channels: string[] = [];
        let success = true;
        let error: string | undefined;

        const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
        const dueDate = request.dueDate
          ? format(request.dueDate, "MMMM d, yyyy")
          : "No specific due date";
        const daysUntilDue = request.dueDate
          ? Math.ceil(
              (request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        try {
          // Send email if enabled
          if (validatedData.channels.includes("email")) {
            await sendReminderEmail({
              to: request.creator.email,
              creatorName: request.creator.name,
              requestTitle: request.title,
              dueDate,
              daysUntilDue,
              portalLink,
              customMessage: validatedData.message,
            });
            channels.push("email");
          }

          // Send SMS if enabled and creator has phone
          if (
            validatedData.channels.includes("sms") &&
            request.creator.phone &&
            (request.creator.preferredContact === "SMS" ||
              request.creator.preferredContact === "BOTH")
          ) {
            await sendReminderSms({
              to: request.creator.phone,
              creatorName: request.creator.name,
              requestTitle: request.title,
              daysUntilDue,
              portalLink,
            });
            channels.push("sms");
          }

          // Create reminder record
          const reminderType =
            daysUntilDue < 0
              ? "OVERDUE"
              : daysUntilDue === 0
              ? "DUE_TODAY"
              : "UPCOMING";

          for (const channel of channels) {
            await db.reminder.create({
              data: {
                requestId: request.id,
                type: reminderType,
                channel: channel.toUpperCase() as "EMAIL" | "SMS",
                scheduledAt: new Date(),
                sentAt: new Date(),
                status: "SENT",
              },
            });
          }
        } catch (e) {
          success = false;
          error = e instanceof Error ? e.message : "Unknown error";
          console.error(`Failed to send reminder for request ${request.id}:`, e);
        }

        return {
          requestId: request.id,
          requestTitle: request.title,
          creatorId: request.creator.id,
          creatorName: request.creator.name,
          success,
          channels,
          error,
        };
      });

      const chunkResults = await Promise.all(reminderPromises);
      results.push(...chunkResults);
    }

    // Log the bulk operation
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "reminder.bulkSend",
        entityType: "Reminder",
        entityId: operationId,
        metadata: {
          operationId,
          filter: validatedData.filter,
          channels: validatedData.channels,
          totalRequests: requests.length,
          successCount,
          failedCount,
          customMessage: validatedData.message ? true : false,
        },
      },
    });

    return NextResponse.json({
      success: failedCount === 0,
      operationId,
      sent: successCount,
      failed: failedCount,
      total: requests.length,
      results,
      errors: results.filter((r) => !r.success).map((r) => r.error),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending bulk reminders:", error);
    return NextResponse.json(
      { error: "Failed to send bulk reminders" },
      { status: 500 }
    );
  }
}

// Preview endpoint - get list of requests that would be reminded
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const filter = searchParams.get("filter") as ReminderFilter | null;

    if (!filter) {
      return NextResponse.json(
        { error: "Filter parameter is required" },
        { status: 400 }
      );
    }

    const whereClause = getFilterWhereClause(filter, session.user.agencyId);

    const requests = await db.contentRequest.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            preferredContact: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    });

    const preview = requests.map((request) => ({
      id: request.id,
      title: request.title,
      status: request.status,
      dueDate: request.dueDate?.toISOString() || null,
      daysUntilDue: request.dueDate
        ? Math.ceil(
            (request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null,
      creator: {
        id: request.creator.id,
        name: request.creator.name,
        email: request.creator.email,
        hasPhone: !!request.creator.phone,
        preferredContact: request.creator.preferredContact,
      },
    }));

    return NextResponse.json({
      filter,
      count: preview.length,
      requests: preview,
    });
  } catch (error) {
    console.error("Error previewing bulk reminders:", error);
    return NextResponse.json(
      { error: "Failed to preview bulk reminders" },
      { status: 500 }
    );
  }
}
