import { NextRequest, NextResponse, after } from "next/server";
import { requireAccess, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendRevisionRequestEmail } from "@/lib/email";
import { sendRevisionRequestSms } from "@/lib/sms";
import { dispatchWebhookEvent } from "@/lib/webhooks";

const rejectSchema = z.object({
  uploadIds: z.array(z.string()).min(1),
  requestId: z.string(),
  reason: z.string().min(1, "Rejection reason is required"),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("review.requestChanges");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const { uploadIds, requestId, reason } = rejectSchema.parse(body);

    // Verify request belongs to agency
    const request = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id: requestId }] },
      include: {
        creator: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Update uploads and request status atomically so retries and
    // concurrent rejections can't double-fire notifications
    const rejectedIds = await db.$transaction(async (tx) => {
      // Only transition uploads not already rejected (idempotent)
      const toReject = await tx.upload.findMany({
        where: {
          id: { in: uploadIds },
          requestId,
          status: { not: "REJECTED" },
        },
        select: { id: true },
      });
      let rejectedIds = toReject.map((u) => u.id);

      if (rejectedIds.length > 0) {
        const updateResult = await tx.upload.updateMany({
          where: {
            id: { in: rejectedIds },
            status: { not: "REJECTED" },
          },
          data: {
            status: "REJECTED",
          },
        });
        if (updateResult.count === 0) {
          rejectedIds = [];
        }
      }

      if (rejectedIds.length > 0) {
        // Add comment with rejection reason
        await tx.comment.create({
          data: {
            requestId,
            userId: session.user.id,
            message: `Uploads rejected: ${reason}`,
            isInternal: false,
          },
        });

        // Update request status
        await tx.contentRequest.update({
          where: { id: requestId },
          data: {
            status: "NEEDS_REVISION",
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
          },
        });
      }

      return rejectedIds;
    });

    if (rejectedIds.length > 0) {
      // Fire webhook for rejected uploads
      // after() keeps the serverless function alive until delivery finishes
      const agencyId = session.user.agencyId;
      const userId = session.user.id;
      after(() =>
        dispatchWebhookEvent(agencyId, "upload.rejected", {
          uploadIds: rejectedIds,
          requestId,
          requestTitle: request.title,
          creatorId: request.creatorId,
          creatorName: request.creator.name,
          reason,
          rejectedBy: userId,
        })
      );

      // Notify creator
      const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${requestId}`;

      try {
        await sendRevisionRequestEmail({
          to: request.creator.email,
          creatorName: request.creator.name,
          requestTitle: request.title,
          feedback: reason,
          portalLink,
          agencyId: session.user.agencyId,
        });

        if (
          request.creator.phone &&
          (request.creator.preferredContact === "SMS" ||
            request.creator.preferredContact === "BOTH")
        ) {
          await sendRevisionRequestSms({
            to: request.creator.phone,
            creatorName: request.creator.name,
            requestTitle: request.title,
            portalLink,
          });
        }
      } catch (error) {
        console.error("Failed to send rejection notification:", error);
      }

      // Log activity
      // One row per upload so the activity feed can join on entityId
      await db.activityLog.createMany({
        data: rejectedIds.map((id) => ({
          userId: session.user.id,
          action: "upload.rejected",
          entityType: "Upload",
          entityId: id,
          metadata: {
            count: rejectedIds.length,
            requestId,
            reason,
          },
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error rejecting uploads:", error);
    return NextResponse.json(
      { error: "Failed to reject uploads" },
      { status: 500 }
    );
  }
}
