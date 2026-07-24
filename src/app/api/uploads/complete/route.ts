import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { fileExists } from "@/lib/storage";
import { dispatchWebhookEvent } from "@/lib/webhooks";

const completeUploadSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    console.log("[UploadComplete] Request received - session:", !!session, "creatorToken:", !!creatorToken);

    const body = await req.json();
    const { uploadId } = completeUploadSchema.parse(body);
    console.log("[UploadComplete] Upload ID:", uploadId);

    // Get the upload record
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: {
        request: {
          include: {
            creator: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    // Verify authorization
    if (session?.user?.agencyId) {
      if (upload.request.agencyId !== session.user.agencyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!creator) {
        console.error("[UploadComplete] Creator not found or session expired");
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
      }

      if (creator.id !== upload.creatorId) {
        console.error("[UploadComplete] Creator mismatch - session creator:", creator.id, "upload creator:", upload.creatorId);
        return NextResponse.json({ error: "Not authorized to complete this upload" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify file exists in storage (with retry for eventual consistency)
    let exists = await fileExists(upload.storageKey);

    // If not found, wait a moment and try again (R2 eventual consistency)
    if (!exists) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      exists = await fileExists(upload.storageKey);
    }

    if (!exists) {
      console.error(`[UploadComplete] File verification failed for ${upload.storageKey}`);
      return NextResponse.json(
        { error: "File not found in storage. Please retry the upload." },
        { status: 400 }
      );
    }

    // Update upload status (only if not already completed, so retries are idempotent)
    const transition = await db.upload.updateMany({
      where: {
        id: uploadId,
        uploadStatus: { not: "COMPLETED" },
      },
      data: {
        uploadStatus: "COMPLETED",
        uploadProgress: 100,
        uploadedAt: new Date(),
      },
    });
    const transitioned = transition.count > 0;

    const updatedUpload = await db.upload.findUnique({
      where: { id: uploadId },
    });

    if (!updatedUpload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (transitioned) {
      // Fire webhook events
      dispatchWebhookEvent(upload.request.agencyId, "upload.completed", {
        uploadId: updatedUpload.id,
        fileName: updatedUpload.originalName,
        fileSize: Number(updatedUpload.fileSize),
        requestId: upload.requestId,
        creatorId: upload.creatorId,
        creatorName: upload.request.creator.name,
      });

      // Also fire creator.uploaded
      dispatchWebhookEvent(upload.request.agencyId, "creator.uploaded", {
        creatorId: upload.creatorId,
        creatorName: upload.request.creator.name,
        uploadId: updatedUpload.id,
        fileName: updatedUpload.originalName,
        requestId: upload.requestId,
      });

      // Check if all uploads for this request are complete
      // and update request status if needed
      const pendingUploads = await db.upload.count({
        where: {
          requestId: upload.requestId,
          uploadStatus: { not: "COMPLETED" },
        },
      });

      if (pendingUploads === 0) {
        // Check total uploads for this request
        const totalUploads = await db.upload.count({
          where: {
            requestId: upload.requestId,
            uploadStatus: "COMPLETED",
          },
        });

        if (totalUploads > 0) {
          // Update request status to IN_PROGRESS if it was PENDING
          await db.contentRequest.updateMany({
            where: {
              id: upload.requestId,
              status: "PENDING",
            },
            data: {
              status: "IN_PROGRESS",
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      upload: {
        ...updatedUpload,
        fileSize: Number(updatedUpload.fileSize),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("[UploadComplete] Error completing upload:", error);
    console.error("[UploadComplete] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to complete upload", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
