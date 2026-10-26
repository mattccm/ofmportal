import { NextRequest, NextResponse } from "next/server";
import { forbidden, requestWhere, requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { z } from "zod";
import { dueLong, calendarDaysUntilDue } from "@/lib/due";

// Note: customMessage support would need to be added to sendReminderEmail/sendReminderSms
// For now, we use the default templates

// VALIDATION SCHEMAS

const sendReminderSchema = z.object({
  reminderId: z.string().optional(),
  requestId: z.string().optional(),
  // Left out: the creator's preferred contact method, decided here so the
  // browser never needs to know it
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).optional(),
  customMessage: z.string().max(2000, "Message too long").optional(),
}).refine(
  (data) => data.reminderId || data.requestId,
  { message: "Either reminderId or requestId is required" }
);

// POST - Manually send a reminder

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(["reminders.send", "requests.remind"]);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const body = await req.json();
    const { reminderId, requestId, channel: askedChannel, customMessage } = sendReminderSchema.parse(body);

    // Sending a scheduled reminder early is a Reminders action; reminding
    // from a request (overview, creator page) is covered by requests.remind
    if (reminderId && !access.has("reminders.send")) return forbidden("reminders.send");

    let reminder;
    let request;

    if (reminderId) {
      // Send existing reminder
      reminder = await db.reminder.findFirst({
        where: {
          id: reminderId,
          request: requestWhere(access),
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
          AND: [requestWhere(access), { id: requestId }],
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

    const channel = askedChannel ?? request.creator.preferredContact ?? "EMAIL";

    const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
    const dueDate = dueLong(request, "No due date");
    const daysUntilDue = calendarDaysUntilDue(request, request.creator.timezone) ?? 0;

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
          agencyId: session.user.agencyId,
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
