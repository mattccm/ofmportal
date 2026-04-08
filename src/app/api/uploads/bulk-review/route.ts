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
import { deleteFile } from "@/lib/storage";
import { broadcastAgencyNotification, broadcastRequestUpdate } from "@/lib/realtime-broadcast";

// Enhanced schema supporting both simple and advanced bulk review
const bulkReviewSchema = z.object({
  uploadIds: z.array(z.string()).min(1, "At least one upload ID is required"),
  action: z.enum(["approve", "reject", "delete"]),
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

    // For delete action, we can delete any upload regardless of status (except we might want to preserve approved ones)
    // For approve/reject, we only allow pending uploads
    const whereClause = action === "delete"
      ? {
          id: { in: uploadIds },
          request: {
            agencyId: session.user.agencyId,
          },
        }
      : {
          id: { in: uploadIds },
          status: "PENDING" as const,
          request: {
            agencyId: session.user.agencyId,
          },
        };

    const uploads = await db.upload.findMany({
      where: whereClause,
      include: {
        creator: true,
        request: true,
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: action === "delete" ? "No valid uploads found" : "No valid pending uploads found" },
        { status: 404 }
      );
    }

    // Handle delete action separately
    if (action === "delete") {
      // Delete files from storage
      const storageErrors: string[] = [];
      for (const upload of uploads) {
        try {
          await deleteFile(upload.storageKey);
          if (upload.thumbnailKey) {
            await deleteFile(upload.thumbnailKey);
          }
        } catch (storageError) {
          console.error(`Failed to delete file from storage: ${upload.storageKey}`, storageError);
          storageErrors.push(upload.originalName);
        }
      }

      // Delete from database
      await db.upload.deleteMany({
        where: {
          id: { in: uploads.map((u) => u.id) },
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "upload.bulk_deleted",
          entityType: "Upload",
          entityId: operationId,
          metadata: {
            operationId,
            count: uploads.length,
            uploadIds: uploads.map((u) => u.id),
            storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
          },
        },
      });

      // Broadcast deletion to affected requests (fire and forget)
      const affectedRequestIds = Array.from(new Set(uploads.map((u) => u.requestId)));
      for (const reqId of affectedRequestIds) {
        broadcastRequestUpdate(reqId, {
          type: "upload_status",
          data: { action: "deleted", count: uploads.filter((u) => u.requestId === reqId).length },
        }).catch(() => {});
      }
      broadcastAgencyNotification(session.user.agencyId, {
        type: "uploads_deleted",
        title: "Uploads Deleted",
        message: `${uploads.length} upload(s) permanently deleted`,
        entityType: "Upload",
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        operationId,
        deleted: uploads.length,
        storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
      });
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

    // Process request status updates in batch
    const affectedRequestIds = Array.from(new Set(uploads.map((u) => u.requestId)));

    if (action === "approve") {
      // Batch fetch pending upload counts for all affected requests
      const pendingCounts = await db.upload.groupBy({
        by: ["requestId"],
        where: {
          requestId: { in: affectedRequestIds },
          status: { not: "APPROVED" },
        },
        _count: { id: true },
      });

      // Create a map of requestId -> pending count
      const pendingCountMap = new Map(
        pendingCounts.map((p) => [p.requestId, p._count.id])
      );

      // Find requests with zero pending uploads (fully approved)
      const fullyApprovedRequestIds = affectedRequestIds.filter(
        (id) => !pendingCountMap.has(id) || pendingCountMap.get(id) === 0
      );

      // Batch update all fully approved requests
      if (fullyApprovedRequestIds.length > 0) {
        await db.contentRequest.updateMany({
          where: { id: { in: fullyApprovedRequestIds } },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
          },
        });
      }
    } else {
      // Batch update all affected requests to needs revision
      await db.contentRequest.updateMany({
        where: { id: { in: affectedRequestIds } },
        data: {
          status: "NEEDS_REVISION",
        },
      });
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

    // Send notifications in background - allSettled never rejects, so no .catch needed
    // Await to ensure notifications are sent before the serverless function exits
    const notificationResults = await Promise.allSettled(notificationPromises);
    const failedNotifications = notificationResults.filter((r) => r.status === "rejected").length;
    if (failedNotifications > 0) {
      console.error(`[Bulk Review] ${failedNotifications} notification(s) failed to send`);
    }

    // Broadcast upload status changes to affected requests (fire and forget)
    for (const reqId of affectedRequestIds) {
      broadcastRequestUpdate(reqId, {
        type: "upload_status",
        data: { action, count: uploads.filter((u) => u.requestId === reqId).length },
      }).catch(() => {});
    }
    broadcastAgencyNotification(session.user.agencyId, {
      type: `uploads_${action}d`,
      title: `Uploads ${action === "approve" ? "Approved" : "Rejected"}`,
      message: `${uploads.length} upload(s) ${action}d`,
      entityType: "Upload",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      operationId,
      [action === "approve" ? "approved" : "rejected"]: uploads.length,
      affectedRequests: affectedRequestIds.length,
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
