import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl, SIGNED_URL_NO_STORE } from "@/lib/storage";
import { parseJsonBody } from "@/lib/api";
import { z } from "zod";
import { format } from "date-fns";

const bulkDownloadSchema = z.object({
  uploadIds: z.array(z.string()).min(1, "At least one upload ID is required"),
  format: z.enum(["zip", "urls", "individual"]).default("urls"),
  organization: z.enum(["flat", "by-creator", "by-request", "by-date"]).default("by-creator"),
  includeMetadata: z.boolean().default(true),
});

// Helper to sanitize filename for filesystem
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Generate folder path based on organization method
function getFolderPath(
  upload: {
    creator: { name: string };
    request: { title: string };
    uploadedAt: Date | null;
  },
  organization: string
): string {
  switch (organization) {
    case "by-creator":
      return sanitizeFilename(upload.creator.name);
    case "by-request":
      return sanitizeFilename(upload.request.title);
    case "by-date":
      if (upload.uploadedAt) {
        return format(new Date(upload.uploadedAt), "yyyy-MM-dd");
      }
      return "no-date";
    default:
      return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const { uploadIds, organization, includeMetadata } =
      bulkDownloadSchema.parse(parsed.data);

    // Fetch uploads with creator and request info
    const uploads = await db.upload.findMany({
      where: {
        id: { in: uploadIds },
        uploadStatus: "COMPLETED",
        request: {
          agencyId: session.user.agencyId,
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        request: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "No valid uploads found" },
        { status: 404 }
      );
    }

    // Audit trail: one row per upload so the activity feed can join on
    // entityId. Best-effort, never blocks the download.
    try {
      await db.activityLog.createMany({
        data: uploads.map((u) => ({
          userId: session.user.id,
          action: "content.download",
          entityType: "Upload",
          entityId: u.id,
          metadata: {
            creatorId: u.creatorId,
            requestId: u.requestId,
            fileName: u.originalName,
            count: uploads.length,
            bulk: true,
            organization,
          },
        })),
      });
    } catch (logError) {
      console.warn("Failed to log bulk content download:", logError);
    }

    // Generate download URLs for each file (NO bandwidth through Vercel!)
    const downloadFiles = await Promise.all(
      uploads.map(async (upload) => {
        // Presigned URL (not the public domain) so R2 sends Content-Disposition:
        // attachment and serves CORS, matching requests/[id]/download
        const url = await getDownloadPresignedUrl(upload.storageKey, upload.originalName);

        const folderPath = organization !== "flat" ? getFolderPath(upload, organization) : undefined;

        return {
          id: upload.id,
          url,
          fileName: upload.originalName,
          fileType: upload.fileType,
          fileSize: Number(upload.fileSize),
          fileSizeFormatted: formatBytes(Number(upload.fileSize)),
          folder: folderPath,
          creator: {
            id: upload.creator.id,
            name: upload.creator.name,
            email: upload.creator.email,
          },
          request: {
            id: upload.request.id,
            title: upload.request.title,
          },
          uploadedAt: upload.uploadedAt?.toISOString() || null,
          status: upload.status,
          rating: upload.rating,
          reviewNote: upload.reviewNote,
        };
      })
    );

    // Return URLs - client handles the downloads directly from R2
    // This uses ZERO Vercel bandwidth for file transfer
    return NextResponse.json(
      {
        success: true,
        message: "Download URLs generated. Files will download directly from storage.",
        files: downloadFiles,
        totalFiles: downloadFiles.length,
        totalSize: downloadFiles.reduce((acc, f) => acc + f.fileSize, 0),
        totalSizeFormatted: formatBytes(downloadFiles.reduce((acc, f) => acc + f.fileSize, 0)),
        // Include metadata if requested
        ...(includeMetadata && {
          metadata: {
            downloadedAt: new Date().toISOString(),
            downloadedBy: session.user.email,
            organization,
          },
        }),
      },
      { headers: { "Cache-Control": SIGNED_URL_NO_STORE } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating bulk download:", error);
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 }
    );
  }
}

// Support GET for simple downloads (using query params)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    const includeMetadata = searchParams.get("metadata") !== "false";

    if (!idsParam) {
      return NextResponse.json(
        { error: "No upload IDs provided" },
        { status: 400 }
      );
    }

    const uploadIds = idsParam.split(",").filter(Boolean);

    if (uploadIds.length === 0) {
      return NextResponse.json(
        { error: "No valid upload IDs provided" },
        { status: 400 }
      );
    }

    // Reuse POST logic
    const postBody = {
      uploadIds,
      format: "urls" as const,
      organization: "flat" as const,
      includeMetadata,
    };

    const postReq = new NextRequest(req.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    return POST(postReq);
  } catch (error) {
    console.error("Error in GET bulk download:", error);
    return NextResponse.json(
      { error: "Failed to process download request" },
      { status: 500 }
    );
  }
}
