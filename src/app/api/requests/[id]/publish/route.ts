import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { format } from "date-fns";
import { invalidateCache } from "@/lib/cache";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { getAppUrl } from "@/lib/app-url";

/**
 * POST - Publish a draft request.
 *
 * Moves DRAFT -> PENDING and runs the same side effects as creating a
 * non-draft request: creator email/SMS, request.created webhook and
 * auto-reminder scheduling.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;

    const existing = await db.contentRequest.findFirst({
      where: { id, agencyId },
      include: { creator: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Atomically claim the draft so a double click can't publish (and notify) twice
    const claim = await db.contentRequest.updateMany({
      where: { id, agencyId, status: "DRAFT" },
      data: { status: "PENDING" },
    });

    if (claim.count === 0) {
      return NextResponse.json(
        { error: "Only draft requests can be published" },
        { status: 400 }
      );
    }

    const creator = existing.creator;
    const portalLink = `${getAppUrl()}/creator/requests/${id}`;
    const dueDate = existing.dueDate
      ? format(existing.dueDate, "MMMM d, yyyy")
      : "No specific due date";

    // Notify the creator. Failures are logged and never undo the publish.
    let emailSent = false;
    if (!creator.archivedAt) {
      try {
        await sendContentRequestEmail({
          to: creator.email,
          creatorName: creator.name,
          agencyName: session.user.agencyName,
          requestTitle: existing.title,
          dueDate,
          portalLink,
          agencyId,
        });
        emailSent = true;
      } catch (error) {
        console.error("Failed to send publish email:", error);
      }

      if (creator.phone && (creator.preferredContact === "SMS" || creator.preferredContact === "BOTH")) {
        try {
          await sendContentRequestSms({
            to: creator.phone,
            creatorName: creator.name,
            requestTitle: existing.title,
            portalLink,
          });
        } catch (error) {
          console.error("Failed to send publish SMS:", error);
        }
      }
    }

    // after() keeps the serverless function alive until delivery finishes
    after(() =>
      dispatchWebhookEvent(agencyId, "request.created", {
        requestId: existing.id,
        title: existing.title,
        creatorId: existing.creatorId,
        creatorName: creator.name,
        dueDate: existing.dueDate?.toISOString() || null,
        urgency: existing.urgency,
      })
    );

    // Schedule auto-reminders now that the request is live
    if (existing.dueDate) {
      try {
        await scheduleRemindersForRequest(id);
      } catch (error) {
        console.error("Failed to schedule auto-reminders:", error);
      }
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.published",
        entityType: "ContentRequest",
        entityId: id,
        metadata: {
          title: existing.title,
          creatorName: creator.name,
        },
      },
    });

    invalidateCache.request(id, agencyId);

    return NextResponse.json({ success: true, status: "PENDING", emailSent });
  } catch (error) {
    console.error("Error publishing request:", error);
    return NextResponse.json(
      { error: "Failed to publish request" },
      { status: 500 }
    );
  }
}
