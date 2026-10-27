import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, forbidden } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  sendContentApprovedEmail,
  sendRevisionRequestEmail,
} from "@/lib/email";
import { sendContentApprovedSms, sendRevisionRequestSms } from "@/lib/sms";
import { deliver } from "@/lib/messaging-server";

const reviewSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
  action: z.enum(["approve", "reject", "reset"]),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(["review.approve", "review.requestChanges"]);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const { uploadId, action, rating, notes } = reviewSchema.parse(body);
    if (action === "approve" && !access.has("review.approve")) return forbidden("review.approve");
    if (action === "reject" && !access.has("review.requestChanges")) return forbidden("review.requestChanges");

    // Verify upload belongs to agency
    const upload = await db.upload.findFirst({
      where: {
        id: uploadId,
        request: requestWhere(access),
      },
      include: {
        creator: true,
        request: true,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // For reset action, allow any status except PENDING
    if (action === "reset") {
      if (upload.status === "PENDING") {
        return NextResponse.json(
          { error: "Upload is already pending review" },
          { status: 400 }
        );
      }
    } else {
      // For approve/reject, only allow PENDING status
      if (upload.status !== "PENDING") {
        return NextResponse.json(
          { error: "Upload has already been reviewed" },
          { status: 400 }
        );
      }
    }

    const newStatus = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "PENDING";

    // Update upload
    const updatedUpload = await db.upload.update({
      where: { id: uploadId },
      data: {
        status: newStatus,
        rating: action === "reset" ? null : (rating || null),
        reviewNote: action === "reset" ? null : (notes || null),
        reviewedById: action === "reset" ? null : session.user.id,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: `upload.${action}d`,
        entityType: "Upload",
        entityId: uploadId,
        metadata: {
          fileName: upload.originalName,
          requestId: upload.requestId,
          creatorId: upload.creatorId,
          rating,
          hasNotes: !!notes,
        },
      },
    });

    // Create notification for creator (via the request) - skip for reset action
    if (action !== "reset") {
      await db.notification.create({
        data: {
          userId: session.user.id, // This will need to be adjusted based on your notification system
          type: action === "approve" ? "upload_approved" : "upload_rejected",
          title:
            action === "approve"
              ? "Content Approved"
              : "Revision Requested",
          message:
            action === "approve"
              ? `Your upload "${upload.originalName}" has been approved.`
              : `Your upload "${upload.originalName}" needs revision: ${notes || "No details provided"}`,
          link: `/dashboard/requests/${upload.requestId}`,
        },
      });
    }

    // Handle reset action - update request status back to in progress
    if (action === "reset") {
      await db.contentRequest.update({
        where: { id: upload.requestId },
        data: {
          status: "IN_PROGRESS",
        },
      });

      return NextResponse.json({
        success: true,
        upload: {
          id: updatedUpload.id,
          status: updatedUpload.status,
          rating: updatedUpload.rating,
          reviewNote: updatedUpload.reviewNote,
        },
      });
    }

    // Send notifications based on action
    if (action === "approve") {
      // Check if all uploads for this request are now approved
      const pendingUploads = await db.upload.count({
        where: {
          requestId: upload.requestId,
          status: { not: "APPROVED" },
        },
      });

      if (pendingUploads === 0) {
        // All uploads approved - update request status
        await db.contentRequest.update({
          where: { id: upload.requestId },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
          },
        });

        // Approval notification: email and/or text, as the request's plan says
        await deliver(
          "request.approved",
          { agencyId: upload.request.agencyId, creator: upload.creator, request: upload.request },
          {
            email: () =>
              sendContentApprovedEmail({
                to: upload.creator.email,
                creatorName: upload.creator.name,
                requestTitle: upload.request.title,
              }),
            sms: (to) =>
              sendContentApprovedSms({
                to,
                creatorName: upload.creator.name,
                requestTitle: upload.request.title,
              }),
          }
        );
      }
    } else {
      // Rejected - update request status to needs revision
      await db.contentRequest.update({
        where: { id: upload.requestId },
        data: {
          status: "NEEDS_REVISION",
        },
      });

      // Changes notification: email and/or text, as the request's plan says
      const portalLink = `${process.env.APP_URL}/creator/requests/${upload.requestId}`;
      await deliver(
        "request.changes",
        { agencyId: upload.request.agencyId, creator: upload.creator, request: upload.request },
        {
          email: () =>
            sendRevisionRequestEmail({
              to: upload.creator.email,
              creatorName: upload.creator.name,
              requestTitle: upload.request.title,
              feedback: notes || "Please review and resubmit.",
              portalLink,
            }),
          sms: (to) =>
            sendRevisionRequestSms({
              to,
              creatorName: upload.creator.name,
              requestTitle: upload.request.title,
              portalLink,
            }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      upload: {
        id: updatedUpload.id,
        status: updatedUpload.status,
        rating: updatedUpload.rating,
        reviewNote: updatedUpload.reviewNote,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error reviewing upload:", error);
    return NextResponse.json(
      { error: "Failed to review upload" },
      { status: 500 }
    );
  }
}
