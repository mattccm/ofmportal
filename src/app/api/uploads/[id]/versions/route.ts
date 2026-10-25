import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { getViewPresignedUrl, getPublicFileUrl, SIGNED_URL_NO_STORE } from "@/lib/storage";

// Types for version history
interface UploadVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    avatar: string | null;
  };
  notes: string | null;
  metadata: Record<string, unknown>;
  status: "CURRENT" | "PREVIOUS" | "RESTORED";
  isCurrent: boolean;
}

/**
 * GET /api/uploads/[id]/versions
 * Get version history for an upload
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("review.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const { id } = await params;

    // Get the upload and verify ownership
    const upload = await db.upload.findFirst({
      where: {
        id,
        request: requestWhere(access),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Get version history from activity logs
    // In this implementation, we track versions through activity logs
    // In a production system, you might have a separate UploadVersion table
    const versionLogs = await db.activityLog.findMany({
      where: {
        entityType: "Upload",
        entityId: id,
        action: { in: ["upload.version_created", "upload.completed", "upload.version_restored"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Build version history
    // Current upload is always version 1 (most recent)
    const versions: UploadVersion[] = [];

    // Add current version (creator content: signed inline view URL)
    // Previews stay hidden from people who can't reveal them
    const canReveal = access.has("review.reveal");
    let currentPreviewUrl = canReveal ? getPublicFileUrl(upload.storageKey) : null;
    if (!currentPreviewUrl && canReveal) {
      currentPreviewUrl = await getViewPresignedUrl(upload.storageKey).catch(() => null);
    }

    versions.push({
      id: upload.id,
      versionNumber: versionLogs.length + 1,
      fileName: upload.fileName,
      originalName: upload.originalName,
      fileType: upload.fileType,
      fileSize: Number(upload.fileSize),
      storageKey: upload.storageKey,
      thumbnailUrl: upload.thumbnailUrl,
      previewUrl: currentPreviewUrl,
      uploadedAt: upload.uploadedAt || upload.createdAt,
      uploadedBy: {
        id: upload.creator.id,
        name: upload.creator.name,
        avatar: upload.creator.avatar,
      },
      notes: (upload.metadata as Record<string, unknown>)?.versionNotes as string | null || null,
      metadata: upload.metadata as Record<string, unknown>,
      status: "CURRENT",
      isCurrent: true,
    });

    // Add previous versions from activity logs
    for (let i = 0; i < versionLogs.length; i++) {
      const log = versionLogs[i];
      const metadata = log.metadata as Record<string, unknown>;

      if (metadata?.previousVersion) {
        const prevVersion = metadata.previousVersion as Record<string, unknown>;
        const prevStorageKey = prevVersion.storageKey as string;
        let prevPreviewUrl: string | null = null;
        if (prevStorageKey && canReveal) {
          prevPreviewUrl = getPublicFileUrl(prevStorageKey);
          if (!prevPreviewUrl) {
            prevPreviewUrl = await getViewPresignedUrl(prevStorageKey).catch(() => null);
          }
        }

        versions.push({
          id: `${upload.id}-v${versionLogs.length - i}`,
          versionNumber: versionLogs.length - i,
          fileName: prevVersion.fileName as string || upload.fileName,
          originalName: prevVersion.originalName as string || upload.originalName,
          fileType: prevVersion.fileType as string || upload.fileType,
          fileSize: Number(prevVersion.fileSize || upload.fileSize),
          storageKey: prevStorageKey || "",
          thumbnailUrl: prevVersion.thumbnailUrl as string | null || null,
          previewUrl: prevPreviewUrl,
          uploadedAt: new Date(prevVersion.uploadedAt as string || log.createdAt),
          uploadedBy: log.user
            ? {
                id: log.user.id,
                name: log.user.name,
                avatar: log.user.avatar,
              }
            : {
                id: upload.creator.id,
                name: upload.creator.name,
                avatar: upload.creator.avatar,
              },
          notes: prevVersion.notes as string | null || null,
          metadata: prevVersion.metadata as Record<string, unknown> || {},
          status: log.action === "upload.version_restored" ? "RESTORED" : "PREVIOUS",
          isCurrent: false,
        });
      }
    }

    return NextResponse.json(
      {
        versions,
        currentVersionId: upload.id,
        totalVersions: versions.length,
      },
      { headers: { "Cache-Control": SIGNED_URL_NO_STORE } }
    );
  } catch (error) {
    console.error("Error fetching version history:", error);
    return NextResponse.json(
      { error: "Failed to fetch version history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads/[id]/versions
 * Create a new version (on re-upload)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("requests.upload");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id } = await params;
    const body = await req.json();
    const { storageKey, fileName, originalName, fileType, fileSize, notes, metadata } = body;

    // Validate required fields
    if (!storageKey || !fileName || !originalName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the current upload
    const currentUpload = await db.upload.findFirst({
      where: {
        id,
        request: requestWhere(access),
      },
      include: {
        request: {
          select: {
            id: true,
            agencyId: true,
          },
        },
      },
    });

    if (!currentUpload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Store the previous version info in activity log
    const previousVersion = {
      storageKey: currentUpload.storageKey,
      fileName: currentUpload.fileName,
      originalName: currentUpload.originalName,
      fileType: currentUpload.fileType,
      fileSize: Number(currentUpload.fileSize),
      thumbnailUrl: currentUpload.thumbnailUrl,
      thumbnailKey: currentUpload.thumbnailKey,
      uploadedAt: currentUpload.uploadedAt,
      metadata: currentUpload.metadata,
      notes: (currentUpload.metadata as Record<string, unknown>)?.versionNotes || null,
    };

    // Update the upload with new version data
    const updatedUpload = await db.upload.update({
      where: { id },
      data: {
        storageKey,
        fileName,
        originalName,
        fileType,
        fileSize: BigInt(fileSize),
        uploadedAt: new Date(),
        status: "PENDING", // Reset status for new version
        reviewedById: null,
        reviewNote: null,
        rating: null,
        metadata: {
          ...(metadata || {}),
          versionNotes: notes || null,
        },
        // Clear thumbnail - will be regenerated
        thumbnailKey: null,
        thumbnailUrl: null,
      },
    });

    // Log the version creation
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.version_created",
        entityType: "Upload",
        entityId: id,
        metadata: {
          previousVersion,
          newVersion: {
            storageKey,
            fileName,
            originalName,
            fileType,
            fileSize,
            notes,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      upload: {
        ...updatedUpload,
        fileSize: Number(updatedUpload.fileSize),
      },
      message: "New version created successfully",
    });
  } catch (error) {
    console.error("Error creating new version:", error);
    return NextResponse.json(
      { error: "Failed to create new version" },
      { status: 500 }
    );
  }
}
