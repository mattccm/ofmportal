import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentApprovedEmail } from "@/lib/email";
import { sendContentApprovedSms } from "@/lib/sms";
import { dispatchWebhookEvent } from "@/lib/webhooks";

const approveSchema = z.object({
  uploadIds: z.array(z.string()).min(1),
  requestId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uploadIds, requestId } = approveSchema.parse(body);

    // Verify request belongs to agency
    const request = await db.contentRequest.findFirst({
      where: {
        id: requestId,
        agencyId: session.user.agencyId,
      },
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

      // All approved when nothing is still awaiting review
      // (REJECTED uploads don't block approval)
      const pendingUploads = await tx.upload.count({
        where: {
          requestId,
          status: "PENDING",
        },
      });

      let requestApproved = false;
      if (pendingUploads === 0) {
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
    if (approvedIds.length > 0) {
      dispatchWebhookEvent(session.user.agencyId, "upload.approved", {
        uploadIds: approvedIds,
        requestId,
        requestTitle: request.title,
        creatorId: request.creatorId,
        creatorName: request.creator.name,
        approvedBy: session.user.id,
      });
    }

    if (requestApproved) {
      // Fire webhook for fully approved request
      dispatchWebhookEvent(session.user.agencyId, "request.approved", {
        requestId,
        requestTitle: request.title,
        creatorId: request.creatorId,
        creatorName: request.creator.name,
        approvedBy: session.user.id,
      });

      // Notify creator
      try {
        await sendContentApprovedEmail({
          to: request.creator.email,
          creatorName: request.creator.name,
          requestTitle: request.title,
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
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "upload.approved",
          entityType: "Upload",
          entityId: approvedIds.join(","),
          metadata: {
            count: approvedIds.length,
            requestId,
          },
        },
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
