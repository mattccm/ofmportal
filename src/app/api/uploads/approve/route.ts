import { NextRequest, NextResponse, after } from "next/server";
import { requireAccess, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentApprovedEmail } from "@/lib/email";
import { sendContentApprovedSms } from "@/lib/sms";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { getRequiredFileFieldIds } from "@/lib/upload-finalize";

const approveSchema = z.object({
  uploadIds: z.array(z.string()).min(1),
  requestId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("review.approve");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const { uploadIds, requestId } = approveSchema.parse(body);

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

    // Update uploads and decide the request transition atomically so
    // concurrent approvals can't double-fire request.approved
    const { approvedIds, requestApproved } = await db.$transaction(async (tx) => {
      // Only transition uploads not already approved (idempotent)
      const toApprove = await tx.upload.findMany({
        where: {
          id: { in: uploadIds },
          requestId,
          status: { not: "APPROVED" },
        },
        select: { id: true },
      });
      let approvedIds = toApprove.map((u) => u.id);

      if (approvedIds.length > 0) {
        const updateResult = await tx.upload.updateMany({
          where: {
            id: { in: approvedIds },
            status: { not: "APPROVED" },
          },
          data: {
            status: "APPROVED",
          },
        });
        if (updateResult.count === 0) {
          approvedIds = [];
        }
      }

      // A request is fully approved only when EVERY required upload slot
      // (file field) has at least one approved upload. Approving a single
      // upload must NOT flip the whole request to APPROVED while other
      // required slots are still empty or unreviewed.
      //
      //   1. No upload may still be awaiting review (PENDING).
      //   2. Every required file field must have an APPROVED upload — compared
      //      against the required *slot* set, not just the Upload rows that
      //      happen to exist, so a missing required slot blocks approval.
      // REJECTED uploads don't count as approved and don't block approval when
      // the slot they belong to is optional.
      const requiredFieldIds = getRequiredFileFieldIds(request.fields);

      const pendingUploads = await tx.upload.count({
        where: {
          requestId,
          status: "PENDING",
        },
      });

      const approvedUploads = await tx.upload.findMany({
        where: {
          requestId,
          status: "APPROVED",
        },
        select: { fieldId: true },
      });
      const approvedFieldIds = new Set(
        approvedUploads
          .map((u) => u.fieldId)
          .filter((id): id is string => id !== null)
      );

      const allRequiredApproved = requiredFieldIds.every((id) =>
        approvedFieldIds.has(id)
      );

      // For ad-hoc requests with no file-field slots, requiredFieldIds is empty
      // (allRequiredApproved is vacuously true); we then fall back to requiring
      // that at least one upload exists and nothing is left pending.
      const requestFullyApproved =
        approvedUploads.length > 0 && pendingUploads === 0 && allRequiredApproved;

      let requestApproved = false;
      if (requestFullyApproved) {
        const requestTransition = await tx.contentRequest.updateMany({
          where: {
            id: requestId,
            status: { not: "APPROVED" },
          },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
          },
        });
        requestApproved = requestTransition.count > 0;
      }

      return { approvedIds, requestApproved };
    });

    // Fire webhook for approved uploads
    // after() keeps the serverless function alive until delivery finishes
    const agencyId = session.user.agencyId;
    const userId = session.user.id;
    if (approvedIds.length > 0) {
      after(() =>
        dispatchWebhookEvent(agencyId, "upload.approved", {
          uploadIds: approvedIds,
          requestId,
          requestTitle: request.title,
          creatorId: request.creatorId,
          creatorName: request.creator.name,
          approvedBy: userId,
        })
      );
    }

    if (requestApproved) {
      // Fire webhook for fully approved request
      after(() =>
        dispatchWebhookEvent(agencyId, "request.approved", {
          requestId,
          requestTitle: request.title,
          creatorId: request.creatorId,
          creatorName: request.creator.name,
          approvedBy: userId,
        })
      );

      // Notify creator
      try {
        await sendContentApprovedEmail({
          to: request.creator.email,
          creatorName: request.creator.name,
          requestTitle: request.title,
          portalLink: `${process.env.APP_URL}/portal/${request.creator.id}/requests/${requestId}`,
          agencyId: session.user.agencyId,
        });

        if (
          request.creator.phone &&
          (request.creator.preferredContact === "SMS" ||
            request.creator.preferredContact === "BOTH")
        ) {
          await sendContentApprovedSms({
            to: request.creator.phone,
            creatorName: request.creator.name,
            requestTitle: request.title,
          });
        }
      } catch (error) {
        console.error("Failed to send approval notification:", error);
      }
    }

    // Log activity
    if (approvedIds.length > 0) {
      // One row per upload so the activity feed can join on entityId
      await db.activityLog.createMany({
        data: approvedIds.map((id) => ({
          userId: session.user.id,
          action: "upload.approved",
          entityType: "Upload",
          entityId: id,
          metadata: {
            count: approvedIds.length,
            requestId,
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

    console.error("Error approving uploads:", error);
    return NextResponse.json(
      { error: "Failed to approve uploads" },
      { status: 500 }
    );
  }
}
