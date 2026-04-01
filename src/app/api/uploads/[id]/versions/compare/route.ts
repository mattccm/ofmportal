import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/storage";

interface ComparisonResult {
  left: {
    versionNumber: number;
    fileName: string;
    originalName: string;
    fileType: string;
    fileSize: number;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    uploadedAt: Date;
    metadata: Record<string, unknown>;
  };
  right: {
    versionNumber: number;
    fileName: string;
    originalName: string;
    fileType: string;
    fileSize: number;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    uploadedAt: Date;
    metadata: Record<string, unknown>;
  };
  differences: {
    key: string;
    label: string;
    leftValue: unknown;
    rightValue: unknown;
    changeType: "added" | "removed" | "changed" | "unchanged";
  }[];
}

/**
 * POST /api/uploads/[id]/versions/compare
 * Compare two versions of an upload
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { leftVersionId, rightVersionId } = body;

    if (!leftVersionId || !rightVersionId) {
      return NextResponse.json(
        { error: "Both version IDs are required" },
        { status: 400 }
      );
    }

    // Get the upload
    const upload = await db.upload.findFirst({
      where: {
        id,
        request: {
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Get version history
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

    // Helper to get version data
    const getVersionData = async (
      versionId: string
    ): Promise<ComparisonResult["left"] | null> => {
      // Check if it's the current version
      if (versionId === id) {
        const previewUrl = await getDownloadPresignedUrl(upload.storageKey).catch(() => null);
        return {
          versionNumber: versionLogs.length + 1,
          fileName: upload.fileName,
          originalName: upload.originalName,
          fileType: upload.fileType,
          fileSize: Number(upload.fileSize),
          previewUrl,
          thumbnailUrl: upload.thumbnailUrl,
          uploadedAt: upload.uploadedAt || upload.createdAt,
          metadata: upload.metadata as Record<string, unknown>,
        };
      }

      // Parse version number from ID
      const versionNumber = parseInt(versionId.split("-v").pop() || "0");
      if (!versionNumber) return null;

      // Find the corresponding log entry
      const logIndex = versionLogs.length - versionNumber;
      if (logIndex < 0 || logIndex >= versionLogs.length) return null;

      const log = versionLogs[logIndex];
      const metadata = log.metadata as Record<string, unknown>;
      const prevVersion = metadata?.previousVersion as Record<string, unknown>;

      if (!prevVersion) return null;

      const storageKey = prevVersion.storageKey as string;
      const previewUrl = storageKey
        ? await getDownloadPresignedUrl(storageKey).catch(() => null)
        : null;

      return {
        versionNumber,
        fileName: prevVersion.fileName as string,
        originalName: prevVersion.originalName as string,
        fileType: prevVersion.fileType as string,
        fileSize: Number(prevVersion.fileSize),
        previewUrl,
        thumbnailUrl: prevVersion.thumbnailUrl as string | null,
        uploadedAt: new Date(prevVersion.uploadedAt as string || log.createdAt),
        metadata: (prevVersion.metadata as Record<string, unknown>) || {},
      };
    };

    // Get both versions
    const [leftVersion, rightVersion] = await Promise.all([
      getVersionData(leftVersionId),
      getVersionData(rightVersionId),
    ]);

    if (!leftVersion || !rightVersion) {
      return NextResponse.json(
        { error: "One or both versions not found" },
        { status: 404 }
      );
    }

    // Calculate differences
    const differences: ComparisonResult["differences"] = [];

    // Compare basic properties
    const propertiesToCompare = [
      { key: "fileName", label: "File Name" },
      { key: "originalName", label: "Original Name" },
      { key: "fileType", label: "File Type" },
      { key: "fileSize", label: "File Size" },
    ];

    for (const prop of propertiesToCompare) {
      const leftVal = leftVersion[prop.key as keyof typeof leftVersion];
      const rightVal = rightVersion[prop.key as keyof typeof rightVersion];

      let changeType: ComparisonResult["differences"][0]["changeType"] = "unchanged";
      if (leftVal !== rightVal) {
        changeType = "changed";
      }

      differences.push({
        key: prop.key,
        label: prop.label,
        leftValue: leftVal,
        rightValue: rightVal,
        changeType,
      });
    }

    // Compare metadata
    const allMetadataKeys = new Set([
      ...Object.keys(leftVersion.metadata || {}),
      ...Object.keys(rightVersion.metadata || {}),
    ]);

    const metadataLabelMap: Record<string, string> = {
      width: "Width (px)",
      height: "Height (px)",
      duration: "Duration (s)",
      bitrate: "Bitrate",
      fps: "Frame Rate",
      codec: "Codec",
      colorSpace: "Color Space",
      versionNotes: "Version Notes",
    };

    for (const key of allMetadataKeys) {
      // Skip internal metadata
      if (key.startsWith("_") || key === "restoredFrom" || key === "restoredAt") continue;

      const leftVal = leftVersion.metadata?.[key];
      const rightVal = rightVersion.metadata?.[key];

      let changeType: ComparisonResult["differences"][0]["changeType"] = "unchanged";
      if (leftVal === undefined && rightVal !== undefined) {
        changeType = "added";
      } else if (leftVal !== undefined && rightVal === undefined) {
        changeType = "removed";
      } else if (leftVal !== rightVal) {
        changeType = "changed";
      }

      if (changeType !== "unchanged") {
        differences.push({
          key: `metadata.${key}`,
          label: metadataLabelMap[key] || key.charAt(0).toUpperCase() + key.slice(1),
          leftValue: leftVal ?? null,
          rightValue: rightVal ?? null,
          changeType,
        });
      }
    }

    const result: ComparisonResult = {
      left: leftVersion,
      right: rightVersion,
      differences,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error comparing versions:", error);
    return NextResponse.json(
      { error: "Failed to compare versions" },
      { status: 500 }
    );
  }
}
