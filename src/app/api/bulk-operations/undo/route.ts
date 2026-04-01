import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { UploadApprovalStatus, RequestStatus } from "@prisma/client";
import {
  type BulkOperationType,
  isUndoWindowValid,
} from "@/lib/bulk-operations";

// Schema for undo request

const undoSchema = z.object({
  operationId: z.string(),
  type: z.enum(["request_create", "upload_review", "status_update", "reminder_send", "archive"] as const),
  affectedIds: z.array(z.string()).min(1),
  previousStates: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = undoSchema.parse(body);
    const { operationId, type, affectedIds, previousStates } = validatedData;

    // Find the original operation in activity logs
    const originalOperation = await db.activityLog.findFirst({
      where: {
        OR: [
          { id: operationId },
          {
            metadata: {
              path: ["operationId"],
              equals: operationId,
            },
          },
        ],
      },
    });

    if (!originalOperation) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    const metadata = originalOperation.metadata as Record<string, unknown> || {};

    // Check if undo window is still valid
    const undoExpiresAt = metadata.undoExpiresAt as string;
    if (undoExpiresAt && !isUndoWindowValid(undoExpiresAt)) {
      return NextResponse.json(
        { error: "Undo window has expired" },
        { status: 400 }
      );
    }

    // Check if already undone
    if (metadata.undone) {
      return NextResponse.json(
        { error: "Operation has already been undone" },
        { status: 400 }
      );
    }

    let undoneCount = 0;
    const errors: string[] = [];

    // Perform undo based on operation type
    switch (type) {
      case "request_create": {
        // Delete the created requests
        for (const requestId of affectedIds) {
          try {
            await db.contentRequest.delete({
              where: { id: requestId },
            });
            undoneCount++;
          } catch (error) {
            errors.push(`Failed to delete request ${requestId}`);
          }
        }
        break;
      }

      case "upload_review": {
        // Revert upload statuses to PENDING
        for (let i = 0; i < affectedIds.length; i++) {
          const uploadId = affectedIds[i];
          const previousState = previousStates?.[i];

          try {
            await db.upload.update({
              where: { id: uploadId },
              data: {
                status: (previousState?.status as UploadApprovalStatus) || UploadApprovalStatus.PENDING,
                rating: null,
                reviewNote: null,
                reviewedById: null,
              },
            });
            undoneCount++;
          } catch (error) {
            errors.push(`Failed to revert upload ${uploadId}`);
          }
        }
        break;
      }

      case "status_update": {
        // Revert request statuses
        for (let i = 0; i < affectedIds.length; i++) {
          const requestId = affectedIds[i];
          const previousState = previousStates?.[i];

          if (!previousState?.status) {
            errors.push(`No previous state for request ${requestId}`);
            continue;
          }

          try {
            await db.contentRequest.update({
              where: { id: requestId },
              data: {
                status: previousState.status as RequestStatus,
              },
            });
            undoneCount++;
          } catch (error) {
            errors.push(`Failed to revert status for request ${requestId}`);
          }
        }
        break;
      }

      case "archive": {
        // Unarchive requests
        for (let i = 0; i < affectedIds.length; i++) {
          const requestId = affectedIds[i];
          const previousState = previousStates?.[i];

          try {
            await db.contentRequest.update({
              where: { id: requestId },
              data: {
                status: (previousState?.status as RequestStatus) || RequestStatus.APPROVED,
              },
            });
            undoneCount++;
          } catch (error) {
            errors.push(`Failed to unarchive request ${requestId}`);
          }
        }
        break;
      }

      case "reminder_send": {
        // Can't really undo sent reminders, but we can mark the operation as undone
        // and potentially suppress any scheduled follow-ups
        undoneCount = affectedIds.length;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported operation type for undo" },
          { status: 400 }
        );
    }

    // Update the original operation to mark as undone
    await db.activityLog.update({
      where: { id: originalOperation.id },
      data: {
        metadata: {
          ...metadata,
          undone: true,
          undoneAt: new Date().toISOString(),
          undoneBy: session.user.id,
          undoneCount,
        },
      },
    });

    // Log the undo action
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "bulk.undo",
        entityType: "BulkOperation",
        entityId: operationId,
        metadata: {
          originalOperationId: operationId,
          operationType: type,
          undoneCount,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
    });

    return NextResponse.json({
      success: errors.length === 0,
      undoneCount,
      totalItems: affectedIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error undoing bulk operation:", error);
    return NextResponse.json(
      { error: "Failed to undo operation" },
      { status: 500 }
    );
  }
}
