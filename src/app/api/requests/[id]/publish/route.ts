import { NextRequest, NextResponse, after } from "next/server";
import { requireAccess, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { deliver } from "@/lib/messaging-server";
import { invalidateCache } from "@/lib/cache";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { getAppUrl } from "@/lib/app-url";
import { dueLong } from "@/lib/due";

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
    const gate = await requireAccess("requests.create");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id } = await params;
    const agencyId = session.user.agencyId;

    const existing = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
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
    const dueDate = dueLong(existing, "No specific due date");

    // Notify the creator. Failures are logged and never undo the publish.
    let emailSent = false;
    if (!creator.archivedAt) {
      // Email and/or text, as the request's messaging plan says
      const sent = await deliver(
        "request.new",
        { agencyId, creator, request: existing },
        {
          email: () =>
            sendContentRequestEmail({
              to: creator.email,
              creatorName: creator.name,
              agencyName: session.user.agencyName,
              requestTitle: existing.title,
              dueDate,
              portalLink,
              agencyId,
            }),
          sms: (to) =>
            sendContentRequestSms({
              to,
              creatorName: creator.name,
              requestTitle: existing.title,
              portalLink,
            }),
        }
      );
      emailSent = sent.email;
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
