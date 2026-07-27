import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { format, differenceInDays } from "date-fns";

/**
 * POST /api/creators/[id]/reminder
 * Quick action: send an email reminder to a creator for their active
 * (outstanding) content requests. Reuses the same email send path as
 * /api/reminders/send.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Match the permission model used by /api/reminders/send
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Scope the creator to the caller's agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Find the creator's outstanding requests to remind about
    const activeRequests = await db.contentRequest.findMany({
      where: {
        creatorId: creator.id,
        agencyId: session.user.agencyId,
        status: { in: ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"] },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    });

    if (activeRequests.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No active requests to remind about",
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    const today = new Date();
    let sent = 0;
    let failed = 0;

    for (const request of activeRequests) {
      const portalLink = `${appUrl}/portal/${creator.id}/requests/${request.id}`;
      const dueDate = request.dueDate
        ? format(request.dueDate, "MMMM d, yyyy")
        : "No due date";
      const daysUntilDue = request.dueDate
        ? differenceInDays(request.dueDate, today)
        : 0;

      let reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE" = "UPCOMING";
      if (daysUntilDue === 0) {
        reminderType = "DUE_TODAY";
      } else if (daysUntilDue < 0) {
        reminderType = "OVERDUE";
      }

      // Record the reminder before sending (mirrors /api/reminders/send)
      const reminder = await db.reminder.create({
        data: {
          requestId: request.id,
          type: reminderType,
          channel: "EMAIL",
          scheduledAt: new Date(),
        },
      });

      try {
        await sendReminderEmail({
          to: creator.email,
          creatorName: creator.name,
          requestTitle: request.title,
          dueDate,
          daysUntilDue,
          portalLink,
          agencyId: session.user.agencyId,
        });

        await db.reminder.update({
          where: { id: reminder.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        await db.activityLog.create({
          data: {
            userId: session.user.id,
            action: "reminder.sent",
            entityType: "Reminder",
            entityId: reminder.id,
            metadata: {
              requestId: request.id,
              creatorId: creator.id,
              creatorName: creator.name,
              type: reminderType,
              channel: "EMAIL",
            },
          },
        });

        sent++;
      } catch (error) {
        console.error("Failed to send creator reminder:", error);
        await db.reminder.update({
          where: { id: reminder.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        failed++;
      }
    }

    const success = sent > 0;

    return NextResponse.json(
      {
        success,
        sent,
        failed,
        message: success
          ? `Reminder sent for ${sent} request${sent === 1 ? "" : "s"}`
          : "Failed to send reminder",
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error("Error sending creator reminder:", error);
    return NextResponse.json(
      { error: "Failed to send reminder" },
      { status: 500 }
    );
  }
}
