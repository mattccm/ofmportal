import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess } from "@/lib/access/server";
import { sendReminderEmail } from "@/lib/email";
import { format, differenceInDays } from "date-fns";
import { getAppUrl } from "@/lib/app-url";

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
    const gate = await requireAccess("reminders.send");
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    // Scope the creator to the caller's agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
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

    const appUrl = getAppUrl();
    const today = new Date();
    let sent = 0;
    let failed = 0;

    for (const request of activeRequests) {
      const portalLink = `${appUrl}/creator/requests/${request.id}`;
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
