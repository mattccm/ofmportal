import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, buildBulkEmailVariables, renderBulkEmail, finalizeBulkEmails } from "@/lib/email";
import { verifyCronAuth } from "@/lib/cron-auth";

/**
 * Cron: Process scheduled and pending email queue items
 *
 * Handles:
 * 1. Scheduled bulk emails whose scheduledFor time has passed
 * 2. Pending queue items that haven't been sent yet
 *
 * Configured in vercel.json to run every 5 minutes.
 */

const BATCH_SIZE = 20; // Process 20 emails per cron run
const DELAY_BETWEEN_EMAILS_MS = 500; // 500ms between sends to avoid rate limits

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = { processed: 0, sent: 0, failed: 0, errors: [] as string[] };

    // Step 1: Activate scheduled bulk emails whose time has come
    const scheduledEmails = await db.bulkEmail.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: new Date() },
      },
      take: 10,
    });

    if (scheduledEmails.length > 0) {
      await db.bulkEmail.updateMany({
        where: { id: { in: scheduledEmails.map((e) => e.id) } },
        data: { status: "SENDING" },
      });
    }

    // Step 2: Find pending queue items (from SENDING or PENDING bulk emails)
    const pendingItems = await db.emailQueueItem.findMany({
      where: {
        status: "PENDING",
        bulkEmail: {
          status: { in: ["SENDING", "PENDING"] },
        },
      },
      include: {
        bulkEmail: {
          select: {
            id: true,
            subject: true,
            body: true,
            agencyId: true,
            sender: {
              select: { name: true, email: true },
            },
          },
        },
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (pendingItems.length === 0) {
      // Still finalise bulk emails whose last items were sent by an earlier run
      const finalized = await finalizeBulkEmails();
      return NextResponse.json({
        message: "No pending emails to process",
        activated: scheduledEmails.length,
        finalized,
      });
    }

    // Load the context needed to render each item the same way the immediate
    // send path does (BulkEmail has no agency relation and EmailQueueItem has
    // no creator relation, so batch-load both by id).
    const agencyIds = [...new Set(pendingItems.map((i) => i.bulkEmail.agencyId))];
    const creatorIds = [...new Set(pendingItems.map((i) => i.creatorId))];

    const [agencies, creators] = await Promise.all([
      db.agency.findMany({
        where: { id: { in: agencyIds } },
        select: { id: true, name: true },
      }),
      db.creator.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);

    const agencyNameById = new Map(agencies.map((a) => [a.id, a.name]));
    const creatorById = new Map(creators.map((c) => [c.id, c]));
    const portalBaseUrl = process.env.APP_URL || "https://portal.example.com";

    // Step 3: Process each email
    for (const item of pendingItems) {
      // Atomically claim the item so an overlapping run can't send it too
      const claim = await db.emailQueueItem.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "SENDING" },
      });
      if (claim.count === 0) continue;

      results.processed++;

      try {
        // Render this queue item the same way the immediate path does:
        // per-recipient variable substitution -> markdown -> template wrapper.
        const agencyName = agencyNameById.get(item.bulkEmail.agencyId) || "";
        const creator = creatorById.get(item.creatorId);

        const variables = buildBulkEmailVariables({
          creatorName: creator?.name || "",
          creatorEmail: creator?.email || item.email,
          creatorPhone: creator?.phone,
          agencyName,
          portalLink: `${portalBaseUrl}/creator/dashboard`,
          senderName: item.bulkEmail.sender?.name,
          senderEmail: item.bulkEmail.sender?.email,
        });

        const rendered = await renderBulkEmail(
          item.bulkEmail.subject,
          item.bulkEmail.body,
          variables,
          item.bulkEmail.agencyId,
          agencyName
        );

        await sendEmail({
          to: item.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          fromName: rendered.fromName,
          replyTo: rendered.replyTo,
        });

        await db.emailQueueItem.update({
          where: { id: item.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        results.sent++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";

        await db.emailQueueItem.update({
          where: { id: item.id },
          data: { status: "FAILED", error: errorMsg },
        });

        results.failed++;
        results.errors.push(`${item.email}: ${errorMsg}`);
      }

      // Delay between sends to avoid rate limits
      if (results.processed < pendingItems.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));
      }
    }

    // Step 4: Mark finished bulk emails SENT/FAILED. Runs across every
    // SENDING bulk email, not just this batch's, so none stay stuck in SENDING.
    const finalized = await finalizeBulkEmails();

    return NextResponse.json({
      message: "Email queue processed",
      ...results,
      finalized,
    });
  } catch (error) {
    console.error("Email queue cron error:", error);
    return NextResponse.json(
      { error: "Failed to process email queue" },
      { status: 500 }
    );
  }
}
