import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/uploads/[id]/versions/restore
 * Restore a previous version of an upload
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to restore versions
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions to restore versions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: "Version ID is required" },
        { status: 400 }
      );
    }

    // Get the current upload
    const currentUpload = await db.upload.findFirst({
      where: {
        id,
        request: {
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!currentUpload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Find the version to restore from activity logs
    // Version ID format: "{uploadId}-v{versionNumber}"
    const versionNumber = parseInt(versionId.split("-v").pop() || "0");

    if (!versionNumber) {
      return NextResponse.json(
        { error: "Invalid version ID" },
        { status: 400 }
      );
    }

    // Get version history to find the specific version
    const versionLogs = await db.activityLog.findMany({
      where: {
        entityType: "Upload",
        entityId: id,
        action: { in: ["upload.version_created", "upload.version_restored"] },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate which log entry corresponds to the requested version
    const logIndex = versionLogs.length - versionNumber;

    if (logIndex < 0 || logIndex >= versionLogs.length) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    const versionLog = versionLogs[logIndex];
    const versionMetadata = versionLog.metadata as Record<string, unknown>;
    const previousVersion = versionMetadata?.previousVersion as Record<string, unknown>;

    if (!previousVersion || !previousVersion.storageKey) {
      return NextResponse.json(
        { error: "Version data not available" },
        { status: 404 }
      );
    }

    // Store current version before restoring
    const currentVersion = {
      storageKey: currentUpload.storageKey,
      fileName: currentUpload.fileName,
      originalName: currentUpload.originalName,
      fileType: currentUpload.fileType,
      fileSize: Number(currentUpload.fileSize),
      thumbnailUrl: currentUpload.thumbnailUrl,
      thumbnailKey: currentUpload.thumbnailKey,
      uploadedAt: currentUpload.uploadedAt,
      metadata: currentUpload.metadata,
    };

    // Restore the previous version
    const restoredUpload = await db.upload.update({
      where: { id },
      data: {
        storageKey: previousVersion.storageKey as string,
        fileName: previousVersion.fileName as string,
        originalName: previousVersion.originalName as string,
        fileType: previousVersion.fileType as string,
        fileSize: BigInt(previousVersion.fileSize as number),
        thumbnailKey: previousVersion.thumbnailKey as string | null,
        thumbnailUrl: previousVersion.thumbnailUrl as string | null,
        uploadedAt: new Date(),
        status: "PENDING", // Reset status for restored version
        reviewedById: null,
        reviewNote: null,
        rating: null,
        metadata: {
          ...(previousVersion.metadata as Record<string, unknown> || {}),
          restoredFrom: versionNumber,
          restoredAt: new Date().toISOString(),
        },
      },
    });

    // Log the restore action
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.version_restored",
        entityType: "Upload",
        entityId: id,
        metadata: {
          previousVersion: currentVersion,
          restoredVersion: {
            versionNumber,
            ...previousVersion,
          },
        },
      },
    });

    // Create a notification for the creator
    const upload = await db.upload.findUnique({
      where: { id },
      include: {
        creator: true,
        request: true,
      },
    });

    if (upload?.creator) {
      // Note: Creators don't have a userId, so we'd need to notify differently
      // For now, we'll just log the activity
    }

    return NextResponse.json({
      success: true,
      upload: {
        ...restoredUpload,
        fileSize: Number(restoredUpload.fileSize),
      },
      restoredVersion: versionNumber,
      message: `Successfully restored to version ${versionNumber}`,
    });
  } catch (error) {
    console.error("Error restoring version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
