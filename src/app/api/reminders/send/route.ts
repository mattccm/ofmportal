import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";

// Note: customMessage support would need to be added to sendReminderEmail/sendReminderSms
// For now, we use the default templates

// ============================================
// VALIDATION SCHEMAS
// ============================================

const sendReminderSchema = z.object({
  reminderId: z.string().optional(),
  requestId: z.string().optional(),
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
  customMessage: z.string().optional(),
}).refine(
  (data) => data.reminderId || data.requestId,
  { message: "Either reminderId or requestId is required" }
);

// ============================================
// POST - Manually send a reminder
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { reminderId, requestId, channel, customMessage } = sendReminderSchema.parse(body);

    let reminder;
    let request;

    if (reminderId) {
      // Send existing reminder
      reminder = await db.reminder.findFirst({
        where: {
          id: reminderId,
          request: {
            agencyId: session.user.agencyId,
          },
        },
        include: {
          request: {
            include: {
              creator: true,
            },
          },
        },
      });

      if (!reminder) {
        return NextResponse.json(
          { error: "Reminder not found" },
          { status: 404 }
        );
      }

      request = reminder.request;
    } else if (requestId) {
      // Create and send new reminder for request
      request = await db.contentRequest.findFirst({
        where: {
          id: requestId,
          agencyId: session.user.agencyId,
        },
        include: {
          creator: true,
        },
      });

      if (!request) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }
    }

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
    const dueDate = request.dueDate ? format(request.dueDate, "MMMM d, yyyy") : "No due date";
    const daysUntilDue = request.dueDate ? differenceInDays(request.dueDate, new Date()) : 0;

    const results: { email?: boolean; sms?: boolean; errors: string[] } = {
      errors: [],
    };

    // Determine reminder type for new reminders
    let reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION" = "UPCOMING";
    if (daysUntilDue === 0) {
      reminderType = "DUE_TODAY";
    } else if (daysUntilDue < 0) {
      reminderType = "OVERDUE";
    }

    // Send email reminder
    if (channel === "EMAIL" || channel === "BOTH") {
      const emailReminder = reminder && reminder.channel === "EMAIL"
        ? reminder
        : await db.reminder.create({
            data: {
              requestId: request.id,
              type: reminderType,
              channel: "EMAIL",
              scheduledAt: new Date(),
            },
          });

      try {
        await sendReminderEmail({
          to: request.creator.email,
          creatorName: request.creator.name,
          requestTitle: request.title,
          dueDate,
          daysUntilDue,
          portalLink,
        });

        await db.reminder.update({
          where: { id: emailReminder.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        results.email = true;
      } catch (error) {
        console.error("Failed to send email reminder:", error);
        await db.reminder.update({
          where: { id: emailReminder.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        results.email = false;
        results.errors.push(`Email: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Send SMS reminder
    if (channel === "SMS" || channel === "BOTH") {
      if (!request.creator.phone) {
        results.sms = false;
        results.errors.push("SMS: Creator does not have a phone number");
      } else {
        const smsReminder = reminder && reminder.channel === "SMS"
          ? reminder
          : await db.reminder.create({
              data: {
                requestId: request.id,
                type: reminderType,
                channel: "SMS",
                scheduledAt: new Date(),
              },
            });

        try {
          await sendReminderSms({
            to: request.creator.phone,
            creatorName: request.creator.name,
            requestTitle: request.title,
            daysUntilDue,
            portalLink,
          });

          await db.reminder.update({
            where: { id: smsReminder.id },
            data: { status: "SENT", sentAt: new Date() },
          });

          results.sms = true;
        } catch (error) {
          console.error("Failed to send SMS reminder:", error);
          await db.reminder.update({
            where: { id: smsReminder.id },
            data: {
              status: "FAILED",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          results.sms = false;
          results.errors.push(`SMS: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    }

    // Determine overall status
    const success = (results.email === true || results.sms === true);
    const partial = (results.email === true && results.sms === false) ||
                   (results.email === false && results.sms === true);

    return NextResponse.json({
      success,
      partial,
      results,
      message: success
        ? partial
          ? "Reminder partially sent"
          : "Reminder sent successfully"
        : "Failed to send reminder",
    }, { status: success ? 200 : 500 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending reminder:", error);
    return NextResponse.json(
      { error: "Failed to send reminder" },
      { status: 500 }
    );
  }
}
