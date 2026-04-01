import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
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
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  recipientIds: z.array(z.string()).min(1, "At least one recipient is required"),
  scheduledFor: z.string().nullable().optional(),
});

// Process variables in email content
function processVariables(
  text: string,
  variables: Record<string, string>
): string {
  let processed = text;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    processed = processed.replace(regex, value || "");
  });

  return processed;
}

// Convert markdown-like syntax to HTML
function convertToHtml(text: string): string {
  let html = text;

  // Escape HTML entities
  html = html.replace(/&/g, "&amp;");
  html = html.replace(/</g, "&lt;");
  html = html.replace(/>/g, "&gt;");

  // Convert markdown-like syntax
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Underline: <u>text</u> (already HTML)
  html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>");

  // Code: `text`
  html = html.replace(/`(.*?)`/g, "<code style=\"background: #f0f0f0; padding: 2px 6px; border-radius: 4px;\">$1</code>");

  // Headers
  html = html.replace(/^## (.*$)/gm, "<h2 style=\"font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em;\">$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1 style=\"font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em;\">$1</h1>");

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gm, "<blockquote style=\"border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666;\">$1</blockquote>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr style=\"border: none; border-top: 1px solid #ddd; margin: 1.5em 0;\">");

  // Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href=\"$2\" style=\"color: #667eea; text-decoration: none;\">$1</a>");

  // Lists
  html = html.replace(/^- (.*$)/gm, "<li style=\"margin-left: 1.5em;\">$1</li>");
  html = html.replace(/^(\d+)\. (.*$)/gm, "<li style=\"margin-left: 1.5em;\">$2</li>");

  // Wrap consecutive list items
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin: 0.5em 0;">${match}</ul>`);

  // Convert newlines to paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      // Don't wrap if it's already a block element
      if (
        p.startsWith("<h1") ||
        p.startsWith("<h2") ||
        p.startsWith("<ul") ||
        p.startsWith("<ol") ||
        p.startsWith("<blockquote") ||
        p.startsWith("<hr")
      ) {
        return p;
      }
      return `<p style="margin: 0 0 1em 0;">${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html;
}

// Generate email HTML template
function generateEmailHtml(content: string, agencyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${agencyName}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          ${content}
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Sent via Content Portal
          </p>
        </div>
      </body>
    </html>
  `;
}

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
        status: scheduledFor ? "SCHEDULED" : "PENDING",
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

    // Create email queue entries
    const queueItems = await Promise.all(
      creators.map((creator) =>
        db.emailQueueItem.create({
          data: {
            bulkEmailId: bulkEmail.id,
            creatorId: creator.id,
            email: creator.email,
            status: "PENDING",
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
        const variables: Record<string, string> = {
          "creator.name": creator.name,
          "creator.email": creator.email,
          "creator.phone": creator.phone || "",
          "agency.name": agency.name,
          "portal.link": `${portalBaseUrl}/portal`,
          "request.title": "", // Not available in bulk email
          "request.dueDate": "",
          "request.status": "",
          "date.today": new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          "sender.name": sender?.name || session.user.name || "",
          "sender.email": sender?.email || session.user.email || "",
        };

        // Process subject and body
        const processedSubject = processVariables(validatedData.subject, variables);
        const processedBody = processVariables(validatedData.body, variables);

        // Convert body to HTML
        const htmlContent = convertToHtml(processedBody);
        const fullHtml = generateEmailHtml(htmlContent, agency.name);

        // Send the email
        await sendEmail({
          to: creator.email,
          subject: processedSubject,
          html: fullHtml,
          text: processedBody,
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
