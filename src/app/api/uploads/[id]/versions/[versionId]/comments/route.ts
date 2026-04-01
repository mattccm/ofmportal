import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/uploads/[id]/versions/[versionId]/comments
 * Get comments for a specific version
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, versionId } = await params;

    // Verify upload belongs to agency
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

    // Get comments for this version from activity logs
    // We store version comments as activity logs with action "upload.version_comment"
    const commentLogs = await db.activityLog.findMany({
      where: {
        entityType: "UploadVersion",
        entityId: versionId,
        action: "upload.version_comment",
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
        createdAt: "asc",
      },
    });

    const comments = commentLogs.map((log) => {
      const metadata = log.metadata as Record<string, unknown>;
      return {
        id: log.id,
        versionId,
        message: metadata.message as string,
        createdAt: log.createdAt,
        user: log.user
          ? {
              id: log.user.id,
              name: log.user.name,
              avatar: log.user.avatar,
            }
          : {
              id: "unknown",
              name: "Unknown User",
              avatar: null,
            },
      };
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching version comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads/[id]/versions/[versionId]/comments
 * Add a comment to a specific version
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, versionId } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Verify upload belongs to agency
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

    // Create the comment as an activity log
    const commentLog = await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.version_comment",
        entityType: "UploadVersion",
        entityId: versionId,
        metadata: {
          uploadId: id,
          message: message.trim(),
        },
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
    });

    const comment = {
      id: commentLog.id,
      versionId,
      message: message.trim(),
      createdAt: commentLog.createdAt,
      user: commentLog.user
        ? {
            id: commentLog.user.id,
            name: commentLog.user.name,
            avatar: commentLog.user.avatar,
          }
        : {
            id: session.user.id,
            name: session.user.name || "User",
            avatar: null,
          },
    };

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error("Error adding version comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
