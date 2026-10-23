import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { finalizeUpload } from "@/lib/upload-finalize";
import { parseJsonBody } from "@/lib/api";

const completeUploadSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    console.log("[UploadComplete] Request received - session:", !!session, "creatorToken:", !!creatorToken);

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const { uploadId } = completeUploadSchema.parse(body.data);
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
          archivedAt: null,
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

    // Run the shared post-upload bookkeeping (storage verification, status
    // transition, webhooks, request roll-up).
    const result = await finalizeUpload(upload);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      upload: result.upload,
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
