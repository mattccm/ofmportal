import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  sendContentApprovedEmail,
  sendRevisionRequestEmail,
} from "@/lib/email";
import { sendContentApprovedSms, sendRevisionRequestSms } from "@/lib/sms";

const reviewSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
  action: z.enum(["approve", "reject", "reset"]),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uploadId, action, rating, notes } = reviewSchema.parse(body);

    // Verify upload belongs to agency
    const upload = await db.upload.findFirst({
      where: {
        id: uploadId,
        request: {
          agencyId: session.user.agencyId,
        },
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
          link: `/portal/requests/${upload.requestId}`,
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

        // Send approval notification
        try {
          await sendContentApprovedEmail({
            to: upload.creator.email,
            creatorName: upload.creator.name,
            requestTitle: upload.request.title,
          });

          if (
            upload.creator.phone &&
            (upload.creator.preferredContact === "SMS" ||
              upload.creator.preferredContact === "BOTH")
          ) {
            await sendContentApprovedSms({
              to: upload.creator.phone,
              creatorName: upload.creator.name,
              requestTitle: upload.request.title,
            });
          }
        } catch (error) {
          console.error("Failed to send approval notification:", error);
        }
      }
    } else {
      // Rejected - update request status to needs revision
      await db.contentRequest.update({
        where: { id: upload.requestId },
        data: {
          status: "NEEDS_REVISION",
        },
      });

      // Send rejection notification
      try {
        const portalLink = `${process.env.NEXTAUTH_URL}/portal/requests/${upload.requestId}`;

        await sendRevisionRequestEmail({
          to: upload.creator.email,
          creatorName: upload.creator.name,
          requestTitle: upload.request.title,
          feedback: notes || "Please review and resubmit.",
          portalLink,
        });

        if (
          upload.creator.phone &&
          (upload.creator.preferredContact === "SMS" ||
            upload.creator.preferredContact === "BOTH")
        ) {
          await sendRevisionRequestSms({
            to: upload.creator.phone,
            creatorName: upload.creator.name,
            requestTitle: upload.request.title,
            portalLink,
          });
        }
      } catch (error) {
        console.error("Failed to send revision notification:", error);
      }
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
