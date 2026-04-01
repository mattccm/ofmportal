import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/storage";
import { z } from "zod";
import archiver from "archiver";
import { Readable } from "stream";
import { format } from "date-fns";

const bulkDownloadSchema = z.object({
  uploadIds: z.array(z.string()).min(1, "At least one upload ID is required"),
  format: z.enum(["zip", "folder", "individual"]).default("zip"),
  organization: z.enum(["flat", "by-creator", "by-request", "by-date"]).default("by-creator"),
  includeMetadata: z.boolean().default(true),
});

// Helper to sanitize filename for filesystem
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

// Helper to generate CSV content for metadata
function generateMetadataCsv(
  uploads: Array<{
    id: string;
    originalName: string;
    fileType: string;
    fileSize: bigint;
    status: string;
    uploadedAt: Date | null;
    creator: { name: string; email: string };
    request: { title: string };
    reviewNote?: string | null;
    rating?: number | null;
  }>
): string {
  const headers = [
    "File Name",
    "File Type",
    "File Size (bytes)",
    "File Size (formatted)",
    "Status",
    "Uploaded At",
    "Creator Name",
    "Creator Email",
    "Request Title",
    "Rating",
    "Review Notes",
    "Upload ID",
  ];

  const rows = uploads.map((upload) => {
    const size = Number(upload.fileSize);
    const formattedSize = formatBytes(size);

    return [
      `"${upload.originalName.replace(/"/g, '""')}"`,
      upload.fileType,
      size.toString(),
      formattedSize,
      upload.status,
      upload.uploadedAt ? format(new Date(upload.uploadedAt), "yyyy-MM-dd HH:mm:ss") : "",
      `"${upload.creator.name.replace(/"/g, '""')}"`,
      upload.creator.email,
      `"${upload.request.title.replace(/"/g, '""')}"`,
      upload.rating?.toString() || "",
      `"${(upload.reviewNote || "").replace(/"/g, '""')}"`,
      upload.id,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
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

// Handle unique filenames within folders
function getUniqueFilename(
  existingNames: Map<string, number>,
  folderPath: string,
  originalName: string
): string {
  const fullPath = folderPath ? `${folderPath}/${originalName}` : originalName;
  const count = existingNames.get(fullPath) || 0;
  existingNames.set(fullPath, count + 1);

  if (count === 0) {
    return originalName;
  }

  // Add number suffix to duplicate filenames
  const lastDotIndex = originalName.lastIndexOf(".");
  if (lastDotIndex > 0) {
    const name = originalName.substring(0, lastDotIndex);
    const ext = originalName.substring(lastDotIndex);
    return `${name} (${count})${ext}`;
  }
  return `${originalName} (${count})`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uploadIds, format: downloadFormat, organization, includeMetadata } =
      bulkDownloadSchema.parse(body);

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

    // Log the download activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.bulk_download",
        entityType: "Upload",
        entityId: uploads.map((u) => u.id).join(","),
        metadata: {
          count: uploads.length,
          uploadIds: uploads.map((u) => u.id),
          format: downloadFormat,
          organization,
          includeMetadata,
        },
      },
    });

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Balanced compression
    });

    // Collect chunks for the response
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      archive.on("error", reject);
    });

    // Track filenames to handle duplicates
    const existingNames = new Map<string, number>();

    // Add files to archive
    const useFolders = downloadFormat === "folder" && organization !== "flat";

    for (const upload of uploads) {
      try {
        const url = await getDownloadPresignedUrl(upload.storageKey);
        const response = await fetch(url);

        if (response.ok && response.body) {
          // Convert web ReadableStream to Node.js Readable
          const reader = response.body.getReader();
          const nodeStream = new Readable({
            async read() {
              try {
                const { done, value } = await reader.read();
                if (done) {
                  this.push(null);
                } else {
                  this.push(Buffer.from(value));
                }
              } catch (err) {
                this.destroy(err as Error);
              }
            },
          });

          // Determine the path within the archive
          let archivePath: string;
          if (useFolders) {
            const folderPath = getFolderPath(upload, organization);
            const uniqueName = getUniqueFilename(existingNames, folderPath, upload.originalName);
            archivePath = `${folderPath}/${uniqueName}`;
          } else {
            const uniqueName = getUniqueFilename(existingNames, "", upload.originalName);
            archivePath = uniqueName;
          }

          archive.append(nodeStream, { name: archivePath });
        }
      } catch (error) {
        console.error(`Failed to add file ${upload.originalName}:`, error);
        // Continue with other files
      }
    }

    // Add metadata CSV if requested
    if (includeMetadata) {
      const csvContent = generateMetadataCsv(uploads);
      archive.append(csvContent, { name: "metadata.csv" });
    }

    // Finalize the archive
    archive.finalize();

    // Wait for archive to complete
    const zipBuffer = await archivePromise;

    // Generate descriptive filename
    const dateStr = format(new Date(), "yyyy-MM-dd_HHmm");
    const filename = `uploads_${dateStr}.zip`;

    // Return the ZIP file as a streaming response
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
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

    // Reuse POST logic by creating a mock request
    const postBody = {
      uploadIds,
      format: "zip" as const,
      organization: "flat" as const,
      includeMetadata,
    };

    // Create a new request with the body
    const postReq = new NextRequest(req.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    // Note: In production, you might want to refactor to share logic
    // For now, redirect to POST handler
    return POST(postReq);
  } catch (error) {
    console.error("Error in GET bulk download:", error);
    return NextResponse.json(
      { error: "Failed to process download request" },
      { status: 500 }
    );
  }
}
