import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { fileExists } from "@/lib/storage";

const completeUploadSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    const body = await req.json();
    const { uploadId } = completeUploadSchema.parse(body);

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
          sessionExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!creator || creator.id !== upload.creatorId) {
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify file exists in storage
    const exists = await fileExists(upload.storageKey);
    if (!exists) {
      return NextResponse.json(
        { error: "File not found in storage. Upload may have failed." },
        { status: 400 }
      );
    }

    // Update upload status
    const updatedUpload = await db.upload.update({
      where: { id: uploadId },
      data: {
        uploadStatus: "COMPLETED",
        uploadProgress: 100,
        uploadedAt: new Date(),
      },
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

    return NextResponse.json({
      success: true,
      upload: updatedUpload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error completing upload:", error);
    return NextResponse.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}
