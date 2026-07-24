import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, buildBulkEmailVariables, renderBulkEmail } from "@/lib/email";
import { z } from "zod";

// Email variables that can be used in templates
const EMAIL_VARIABLES = [
  { key: "creator.name", label: "Creator Name" },
  { key: "creator.email", label: "Creator Email" },
  { key: "creator.phone", label: "Creator Phone" },
  { key: "agency.name", label: "Agency Name" },
  { key: "portal.link", label: "Portal Link" },
  { key: "request.title", label: "Request Title" },
  { key: "request.dueDate", label: "Due Date" },
  { key: "request.status", label: "Request Status" },
  { key: "date.today", label: "Today's Date" },
  { key: "sender.name", label: "Sender Name" },
  { key: "sender.email", label: "Sender Email" },
] as const;

// Request schema
const sendEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  body: z.string().min(1, "Email body is required").max(50000, "Email body too long"),
  recipientIds: z.array(z.string()).min(1, "At least one recipient is required").max(500, "Too many recipients"),
  scheduledFor: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = sendEmailSchema.parse(body);

    // Get agency details
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { name: true },
    });

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Get sender details
    const sender = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    // Get recipients
    const creators = await db.creator.findMany({
      where: {
        id: { in: validatedData.recipientIds },
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (creators.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients found" },
        { status: 400 }
      );
    }

    // Check if this is a scheduled send
    const scheduledFor = validatedData.scheduledFor
      ? new Date(validatedData.scheduledFor)
      : null;

    if (scheduledFor && scheduledFor <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Create bulk email record
    const bulkEmail = await db.bulkEmail.create({
      data: {
        agencyId: session.user.agencyId,
        senderId: session.user.id,
        subject: validatedData.subject,
        body: validatedData.body,
        recipientCount: creators.length,
        // Mark immediate sends as SENDING up front so an overlapping cron run
        // doesn't also pick up these recipients (the cron only claims PENDING
        // items whose bulk email is SENDING/PENDING).
        status: scheduledFor ? "SCHEDULED" : "SENDING",
        scheduledFor,
      },
    });

    // If scheduled, just save and return
    if (scheduledFor) {
      // Create email queue entries for scheduled processing
      await db.emailQueueItem.createMany({
        data: creators.map((creator) => ({
          bulkEmailId: bulkEmail.id,
          creatorId: creator.id,
          email: creator.email,
          status: "PENDING",
        })),
      });

      // Log activity
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "email.scheduled",
          entityType: "BulkEmail",
          entityId: bulkEmail.id,
          metadata: {
            recipientCount: creators.length,
            scheduledFor: scheduledFor.toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        scheduledFor: scheduledFor.toISOString(),
        recipientCount: creators.length,
        bulkEmailId: bulkEmail.id,
      });
    }

    // Send emails immediately
    const portalBaseUrl = process.env.APP_URL || "https://portal.example.com";
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Create email queue entries already claimed as SENDING so the cron's
    // atomic PENDING->SENDING claim can never re-send them.
    const queueItems = await Promise.all(
      creators.map((creator) =>
        db.emailQueueItem.create({
          data: {
            bulkEmailId: bulkEmail.id,
            creatorId: creator.id,
            email: creator.email,
            status: "SENDING",
          },
        })
      )
    );

    // Process each recipient
    for (let i = 0; i < creators.length; i++) {
      const creator = creators[i];
      const queueItem = queueItems[i];

      try {
        // Prepare variables for this recipient
        const variables = buildBulkEmailVariables({
          creatorName: creator.name,
          creatorEmail: creator.email,
          creatorPhone: creator.phone,
          agencyName: agency.name,
          portalLink: `${portalBaseUrl}/portal`,
          senderName: sender?.name || session.user.name,
          senderEmail: sender?.email || session.user.email,
        });

        // Render subject + body through the shared pipeline
        const rendered = renderBulkEmail(
          validatedData.subject,
          validatedData.body,
          variables,
          agency.name
        );

        // Send the email
        await sendEmail({
          to: creator.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        // Update queue item
        await db.emailQueueItem.update({
          where: { id: queueItem.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        results.sent++;
      } catch (error) {
        console.error(`Failed to send email to ${creator.email}:`, error);

        // Update queue item with error
        await db.emailQueueItem.update({
          where: { id: queueItem.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        results.failed++;
        results.errors.push(`${creator.email}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Update bulk email status
    await db.bulkEmail.update({
      where: { id: bulkEmail.id },
      data: {
        status: results.failed === creators.length ? "FAILED" : "SENT",
        sentAt: new Date(),
        sentCount: results.sent,
        failedCount: results.failed,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "email.sent_bulk",
        entityType: "BulkEmail",
        entityId: bulkEmail.id,
        metadata: {
          sent: results.sent,
          failed: results.failed,
          subject: validatedData.subject,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      bulkEmailId: bulkEmail.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error sending bulk email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

// GET - Fetch bulk email history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");

    const validStatuses = ["PENDING", "SCHEDULED", "SENDING", "SENT", "FAILED"];
    const where = {
      agencyId: session.user.agencyId,
      ...(status && validStatuses.includes(status) && { status: status as "PENDING" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED" }),
    };

    const [emails, total] = await Promise.all([
      db.bulkEmail.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: {
            select: { name: true, email: true },
          },
          _count: {
            select: { queueItems: true },
          },
        },
      }),
      db.bulkEmail.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bulk emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
