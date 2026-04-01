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
import {
  generateOperationId,
  createUndoWindow,
  chunkArray,
  DEFAULT_REJECT_TEMPLATES,
} from "@/lib/bulk-operations";

// Enhanced schema supporting both simple and advanced bulk review
const bulkReviewSchema = z.object({
  uploadIds: z.array(z.string()).min(1, "At least one upload ID is required"),
  action: z.enum(["approve", "reject"]),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
  rejectTemplateId: z.string().optional(), // Quick reject template
  individualReviews: z.array(z.object({
    uploadId: z.string(),
    action: z.enum(["approve", "reject", "skip"]),
    rating: z.number().min(0).max(5).optional(),
    notes: z.string().optional(),
  })).optional(), // For per-item reviews
});

interface NotificationGroup {
  creator: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    preferredContact: string;
  };
  request: {
    id: string;
    title: string;
  };
  uploads: string[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkReviewSchema.parse(body);
    const { uploadIds, action, rating, notes, rejectTemplateId, individualReviews } = validatedData;

    const operationId = generateOperationId();
    const undoExpiresAt = createUndoWindow(30);

    // Get reject template message if using quick reject
    let rejectMessage = notes;
    if (rejectTemplateId && !notes) {
      const template = DEFAULT_REJECT_TEMPLATES.find(t => t.id === rejectTemplateId);
      if (template) {
        rejectMessage = template.message;
      }
    }

    // Verify all uploads belong to agency and are pending
    const uploads = await db.upload.findMany({
      where: {
        id: { in: uploadIds },
        status: "PENDING",
        request: {
          agencyId: session.user.agencyId,
        },
      },
      include: {
        creator: true,
        request: true,
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "No valid pending uploads found" },
        { status: 404 }
      );
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    // Update all uploads
    await db.upload.updateMany({
      where: {
        id: { in: uploads.map((u) => u.id) },
      },
      data: {
        status: newStatus,
        rating: rating || null,
        reviewNote: notes || null,
        reviewedById: session.user.id,
      },
    });

    // Log activity with enhanced metadata
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: `upload.bulk_${action}d`,
        entityType: "Upload",
        entityId: operationId,
        metadata: {
          operationId,
          count: uploads.length,
          uploadIds: uploads.map((u) => u.id),
          rating,
          hasNotes: !!rejectMessage,
          rejectTemplateId,
          undoExpiresAt: undoExpiresAt.toISOString(),
          canUndo: true,
        },
      },
    });

    // Group uploads by creator and request for notifications
    const notificationGroups: Map<string, NotificationGroup> = new Map();

    for (const upload of uploads) {
      const key = `${upload.creatorId}-${upload.requestId}`;
      if (!notificationGroups.has(key)) {
        notificationGroups.set(key, {
          creator: upload.creator,
          request: upload.request,
          uploads: [],
        });
      }
      notificationGroups.get(key)!.uploads.push(upload.originalName);
    }

    // Process each group for notifications
    const affectedRequestIds = new Set(uploads.map((u) => u.requestId));

    for (const requestId of affectedRequestIds) {
      if (action === "approve") {
        // Check if all uploads for this request are now approved
        const pendingUploads = await db.upload.count({
          where: {
            requestId,
            status: { not: "APPROVED" },
          },
        });

        if (pendingUploads === 0) {
          // All uploads approved - update request status
          await db.contentRequest.update({
            where: { id: requestId },
            data: {
              status: "APPROVED",
              reviewedAt: new Date(),
              reviewedBy: session.user.id,
            },
          });
        }
      } else {
        // Update request status to needs revision
        await db.contentRequest.update({
          where: { id: requestId },
          data: {
            status: "NEEDS_REVISION",
          },
        });
      }
    }

    // Send notifications to each creator
    const notificationPromises: Promise<void>[] = [];

    for (const [, group] of notificationGroups) {
      const { creator, request, uploads: uploadNames } = group;

      // Create in-app notification
      notificationPromises.push(
        db.notification
          .create({
            data: {
              userId: session.user.id, // Will need adjustment based on notification system
              type: action === "approve" ? "bulk_upload_approved" : "bulk_upload_rejected",
              title:
                action === "approve"
                  ? `${uploadNames.length} Upload(s) Approved`
                  : `${uploadNames.length} Upload(s) Need Revision`,
              message:
                action === "approve"
                  ? `Your uploads for "${request.title}" have been approved.`
                  : `Your uploads for "${request.title}" need revision: ${notes || "See details"}`,
              link: `/portal/requests/${request.id}`,
            },
          })
          .then(() => undefined)
      );

      // Send email notification
      if (action === "approve") {
        notificationPromises.push(
          sendContentApprovedEmail({
            to: creator.email,
            creatorName: creator.name,
            requestTitle: request.title,
          })
            .then(() => undefined)
            .catch((error) => {
              console.error(
                `Failed to send approval email to ${creator.email}:`,
                error
              );
            })
        );

        if (
          creator.phone &&
          (creator.preferredContact === "SMS" ||
            creator.preferredContact === "BOTH")
        ) {
          notificationPromises.push(
            sendContentApprovedSms({
              to: creator.phone,
              creatorName: creator.name,
              requestTitle: request.title,
            })
              .then(() => undefined)
              .catch((error) => {
                console.error(
                  `Failed to send approval SMS to ${creator.phone}:`,
                  error
                );
              })
          );
        }
      } else {
        const portalLink = `${process.env.NEXTAUTH_URL}/portal/requests/${request.id}`;

        notificationPromises.push(
          sendRevisionRequestEmail({
            to: creator.email,
            creatorName: creator.name,
            requestTitle: request.title,
            feedback: notes || "Please review and resubmit your content.",
            portalLink,
          })
            .then(() => undefined)
            .catch((error) => {
              console.error(
                `Failed to send revision email to ${creator.email}:`,
                error
              );
            })
        );

        if (
          creator.phone &&
          (creator.preferredContact === "SMS" ||
            creator.preferredContact === "BOTH")
        ) {
          notificationPromises.push(
            sendRevisionRequestSms({
              to: creator.phone,
              creatorName: creator.name,
              requestTitle: request.title,
              portalLink,
            })
              .then(() => undefined)
              .catch((error) => {
                console.error(
                  `Failed to send revision SMS to ${creator.phone}:`,
                  error
                );
              })
          );
        }
      }
    }

    // Wait for all notifications (don't block response)
    Promise.allSettled(notificationPromises).catch(console.error);

    return NextResponse.json({
      success: true,
      operationId,
      [action === "approve" ? "approved" : "rejected"]: uploads.length,
      affectedRequests: affectedRequestIds.size,
      notificationsSent: notificationGroups.size,
      canUndo: true,
      undoExpiresAt: undoExpiresAt.toISOString(),
      uploadIds: uploads.map((u) => u.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error bulk reviewing uploads:", error);
    return NextResponse.json(
      { error: "Failed to bulk review uploads" },
      { status: 500 }
    );
  }
}
