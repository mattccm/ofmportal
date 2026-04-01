import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { z } from "zod";
import { format } from "date-fns";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const testReminderSchema = z.object({
  channel: z.enum(["EMAIL", "SMS"]).default("EMAIL"),
  // Optional: test with specific creator
  creatorId: z.string().optional(),
  // Optional: custom recipient for testing
  testEmail: z.string().email().optional(),
  testPhone: z.string().optional(),
});

// ============================================
// POST - Send a test reminder
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role - only OWNER, ADMIN, or MANAGER can send test reminders
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { channel, creatorId, testEmail, testPhone } = testReminderSchema.parse(body);

    // Get agency info
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { name: true },
    });

    // Get the user sending the test
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Determine recipient
    let recipientEmail = testEmail || user.email;
    let recipientPhone = testPhone || user.phone;
    let recipientName = user.name;

    // If testing with a specific creator
    if (creatorId) {
      const creator = await db.creator.findFirst({
        where: {
          id: creatorId,
          agencyId: session.user.agencyId,
        },
        select: { name: true, email: true, phone: true },
      });

      if (creator) {
        recipientEmail = creator.email;
        recipientPhone = creator.phone;
        recipientName = creator.name;
      }
    }

    // Create test data
    const testRequestTitle = "Sample Content Request (Test)";
    const testDueDate = format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), "MMMM d, yyyy");
    const testDaysUntilDue = 3;
    const testPortalLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/portal/test`;

    const result: {
      success: boolean;
      channel: string;
      recipient: string;
      error?: string;
    } = {
      success: false,
      channel,
      recipient: channel === "EMAIL" ? recipientEmail : (recipientPhone || "No phone"),
    };

    try {
      if (channel === "EMAIL") {
        await sendReminderEmail({
          to: recipientEmail,
          creatorName: recipientName,
          requestTitle: testRequestTitle,
          dueDate: testDueDate,
          daysUntilDue: testDaysUntilDue,
          portalLink: testPortalLink,
          isTest: true,
        });
        result.success = true;
      } else if (channel === "SMS") {
        if (!recipientPhone) {
          result.error = "No phone number available for SMS test";
        } else {
          await sendReminderSms({
            to: recipientPhone,
            creatorName: recipientName,
            requestTitle: testRequestTitle,
            daysUntilDue: testDaysUntilDue,
            portalLink: testPortalLink,
            isTest: true,
          });
          result.success = true;
        }
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : "Failed to send test reminder";
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "reminder.test_sent",
        entityType: "Reminder",
        entityId: "test",
        metadata: {
          channel,
          recipient: result.recipient,
          success: result.success,
          error: result.error,
        },
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test ${channel.toLowerCase()} reminder sent successfully to ${result.recipient}`,
        result,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send test reminder",
          result,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending test reminder:", error);
    return NextResponse.json(
      { error: "Failed to send test reminder" },
      { status: 500 }
    );
  }
}
