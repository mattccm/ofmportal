import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Types
interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
  action: "archive" | "delete";
  applyTo: {
    completedRequests: boolean;
    cancelledRequests: boolean;
    archivedRequests: boolean;
  };
  excludeCreators: string[];
  excludeTemplates: string[];
}

interface StorageBreakdown {
  type: string;
  label: string;
  size: number;
  count: number;
  color: string;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// GET - Fetch storage stats, retention policy, or jobs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const agencyId = session.user.agencyId;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "storage";

    switch (type) {
      case "storage": {
        // Get storage statistics by file type
        const uploads = await db.upload.findMany({
          where: {
            request: {
              agencyId,
            },
          },
          select: {
            fileSize: true,
            fileType: true,
            uploadStatus: true,
          },
        });

        // Calculate breakdown by type
        const breakdown: Record<string, StorageBreakdown> = {
          videos: { type: "videos", label: "Videos", size: 0, count: 0, color: "bg-violet-500" },
          images: { type: "images", label: "Images", size: 0, count: 0, color: "bg-blue-500" },
          documents: { type: "documents", label: "Documents", size: 0, count: 0, color: "bg-amber-500" },
          other: { type: "other", label: "Other", size: 0, count: 0, color: "bg-gray-500" },
        };

        let totalUsed = BigInt(0);
        let completedCount = 0;
        let failedCount = 0;

        for (const upload of uploads) {
          const size = upload.fileSize;
          totalUsed += size;

          if (upload.uploadStatus === "COMPLETED") {
            completedCount++;
          } else if (upload.uploadStatus === "FAILED") {
            failedCount++;
          }

          // Categorize by MIME type
          const mimeType = upload.fileType.toLowerCase();
          if (mimeType.startsWith("video/")) {
            breakdown.videos.size += Number(size);
            breakdown.videos.count++;
          } else if (mimeType.startsWith("image/")) {
            breakdown.images.size += Number(size);
            breakdown.images.count++;
          } else if (
            mimeType.startsWith("application/pdf") ||
            mimeType.startsWith("application/msword") ||
            mimeType.startsWith("application/vnd.") ||
            mimeType.startsWith("text/")
          ) {
            breakdown.documents.size += Number(size);
            breakdown.documents.count++;
          } else {
            breakdown.other.size += Number(size);
            breakdown.other.count++;
          }
        }

        // Get agency settings for storage limit (default 100GB)
        const agency = await db.agency.findUnique({
          where: { id: agencyId },
          select: { settings: true },
        });

        const settings = (agency?.settings as Record<string, unknown>) || {};
        const storageLimitGB = (settings.storageLimitGB as number) || 100;
        const totalLimit = storageLimitGB * 1024 * 1024 * 1024; // Convert to bytes

        // Calculate trend (simplified - would need historical data for real trends)
        const trend = {
          direction: "stable" as "up" | "down" | "stable",
          percentage: 0,
          period: "this month",
        };

        // Generate recommendations
        const recommendations: Array<{
          type: "warning" | "info" | "suggestion";
          message: string;
          action?: string;
          actionLabel?: string;
        }> = [];

        const usagePercentage = Number(totalUsed) / totalLimit * 100;

        if (usagePercentage >= 90) {
          recommendations.push({
            type: "warning",
            message: "You're using over 90% of your storage. Consider cleaning up old files or upgrading your plan.",
            action: "old-uploads",
            actionLabel: "Clean Up",
          });
        } else if (usagePercentage >= 75) {
          recommendations.push({
            type: "info",
            message: "You're approaching your storage limit. Review old requests for cleanup.",
            action: "old-uploads",
            actionLabel: "Review",
          });
        }

        if (failedCount > 0) {
          recommendations.push({
            type: "suggestion",
            message: `You have ${failedCount} failed uploads that can be cleaned up to free space.`,
            action: "failed-uploads",
            actionLabel: "Clean Up",
          });
        }

        // Check for old completed requests
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const oldRequests = await db.contentRequest.count({
          where: {
            agencyId,
            status: { in: ["APPROVED", "ARCHIVED", "CANCELLED"] },
            updatedAt: { lt: thirtyDaysAgo },
          },
        });

        if (oldRequests > 10) {
          recommendations.push({
            type: "suggestion",
            message: `You have ${oldRequests} old completed requests. Consider setting up a retention policy.`,
            action: "old-uploads",
            actionLabel: "Set Policy",
          });
        }

        return NextResponse.json({
          totalUsed: Number(totalUsed),
          totalLimit,
          breakdown: Object.values(breakdown).filter((b) => b.count > 0),
          trend,
          recommendations,
        });
      }

      case "policy": {
        // Get retention policy from agency settings
        const agency = await db.agency.findUnique({
          where: { id: agencyId },
          select: { settings: true },
        });

        const settings = (agency?.settings as Record<string, unknown>) || {};
        const policy = settings.retentionPolicy as RetentionPolicy | undefined;

        return NextResponse.json({
          policy: policy || null,
        });
      }

      case "jobs": {
        // Return mock job data (in a real app, this would come from a jobs table)
        // For now, we'll return empty arrays
        return NextResponse.json({
          cleanupJobs: [],
          exportJobs: [],
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Data settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data settings" },
      { status: 500 }
    );
  }
}

// PUT - Update retention policy
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission (owner or admin only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;
    const body = await request.json();
    const { type, policy } = body;

    if (type !== "policy") {
      return NextResponse.json(
        { error: "Invalid update type" },
        { status: 400 }
      );
    }

    // Validate policy
    if (!policy || typeof policy !== "object") {
      return NextResponse.json(
        { error: "Invalid policy data" },
        { status: 400 }
      );
    }

    // Get current agency settings
    const agency = await db.agency.findUnique({
      where: { id: agencyId },
      select: { settings: true },
    });

    const currentSettings = (agency?.settings as Record<string, unknown>) || {};

    // Update settings with new retention policy
    await db.agency.update({
      where: { id: agencyId },
      data: {
        settings: {
          ...currentSettings,
          retentionPolicy: policy,
        },
      },
    });

    // Log the action
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "settings.retention_policy.updated",
        entityType: "Agency",
        entityId: agencyId,
        metadata: {
          enabled: policy.enabled,
          retentionDays: policy.retentionDays,
          action: policy.action,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Retention policy updated successfully",
    });
  } catch (error) {
    console.error("Data settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

// POST - Preview policy, run cleanup, or request export
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const agencyId = session.user.agencyId;
    const body = await request.json();
    const { type } = body;

    switch (type) {
      case "preview": {
        const { policy } = body as { policy: RetentionPolicy };

        if (!policy) {
          return NextResponse.json(
            { error: "Policy is required" },
            { status: 400 }
          );
        }

        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // Build status filter based on policy
        const statusFilter: string[] = [];
        if (policy.applyTo.completedRequests) statusFilter.push("APPROVED");
        if (policy.applyTo.cancelledRequests) statusFilter.push("CANCELLED");
        if (policy.applyTo.archivedRequests) statusFilter.push("ARCHIVED");

        if (statusFilter.length === 0) {
          return NextResponse.json({
            items: [],
            count: 0,
            size: 0,
          });
        }

        // Find affected requests
        const requests = await db.contentRequest.findMany({
          where: {
            agencyId,
            status: { in: statusFilter as any[] },
            updatedAt: { lt: cutoffDate },
            creatorId: policy.excludeCreators.length > 0
              ? { notIn: policy.excludeCreators }
              : undefined,
            templateId: policy.excludeTemplates.length > 0
              ? { notIn: policy.excludeTemplates }
              : undefined,
          },
          include: {
            creator: {
              select: { name: true },
            },
            uploads: {
              select: { fileSize: true },
            },
          },
          take: 50,
          orderBy: { updatedAt: "asc" },
        });

        // Get total count
        const totalCount = await db.contentRequest.count({
          where: {
            agencyId,
            status: { in: statusFilter as any[] },
            updatedAt: { lt: cutoffDate },
            creatorId: policy.excludeCreators.length > 0
              ? { notIn: policy.excludeCreators }
              : undefined,
            templateId: policy.excludeTemplates.length > 0
              ? { notIn: policy.excludeTemplates }
              : undefined,
          },
        });

        // Calculate total size
        const allUploads = await db.upload.findMany({
          where: {
            request: {
              agencyId,
              status: { in: statusFilter as any[] },
              updatedAt: { lt: cutoffDate },
              creatorId: policy.excludeCreators.length > 0
                ? { notIn: policy.excludeCreators }
                : undefined,
              templateId: policy.excludeTemplates.length > 0
                ? { notIn: policy.excludeTemplates }
                : undefined,
            },
          },
          select: { fileSize: true },
        });

        const totalSize = allUploads.reduce(
          (sum, upload) => sum + Number(upload.fileSize),
          0
        );

        const items = requests.map((req) => ({
          id: req.id,
          title: req.title,
          type: "request" as const,
          creator: req.creator.name,
          completedAt: req.updatedAt.toISOString(),
          size: req.uploads.reduce((sum, u) => sum + Number(u.fileSize), 0),
          status: req.status,
        }));

        return NextResponse.json({
          items,
          count: totalCount,
          size: totalSize,
        });
      }

      case "cleanup": {
        // Check if user has permission
        if (!["OWNER", "ADMIN"].includes(session.user.role)) {
          return NextResponse.json(
            { error: "Insufficient permissions" },
            { status: 403 }
          );
        }

        const { cleanupType } = body;

        // Create a cleanup job record (in a real app, this would trigger a background job)
        const jobId = `cleanup_${Date.now()}`;

        // Log the cleanup action
        await db.activityLog.create({
          data: {
            userId: session.user.id,
            action: "data.cleanup.started",
            entityType: "Agency",
            entityId: agencyId,
            metadata: {
              jobId,
              cleanupType,
            },
          },
        });

        // In a real implementation, this would:
        // 1. Create a job record in a jobs table
        // 2. Queue a background task to perform the cleanup
        // 3. Update the job status as it progresses

        // For now, return a mock job object
        return NextResponse.json({
          job: {
            id: jobId,
            type: cleanupType,
            status: "pending",
            itemsProcessed: 0,
            itemsTotal: 0,
            sizeFreed: 0,
            startedAt: new Date().toISOString(),
          },
          message: "Cleanup job started",
        });
      }

      case "export": {
        // Create an export job
        const jobId = `export_${Date.now()}`;

        // Log the export request
        await db.activityLog.create({
          data: {
            userId: session.user.id,
            action: "data.export.requested",
            entityType: "Agency",
            entityId: agencyId,
            metadata: {
              jobId,
            },
          },
        });

        // In a real implementation, this would:
        // 1. Create a job record in a jobs table
        // 2. Queue a background task to create the export
        // 3. Send a notification when complete
        // 4. Upload to temporary storage with download link

        return NextResponse.json({
          job: {
            id: jobId,
            status: "pending",
            requestedAt: new Date().toISOString(),
          },
          message: "Export job started",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Data settings POST error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// DELETE - Delete all data
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only owner can delete all data
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the account owner can delete all data" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;
    const body = await request.json();
    const { confirmText } = body;

    if (confirmText !== "DELETE ALL DATA") {
      return NextResponse.json(
        { error: "Invalid confirmation text" },
        { status: 400 }
      );
    }

    // Log the deletion request before proceeding
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "data.delete_all.requested",
        entityType: "Agency",
        entityId: agencyId,
        metadata: {
          requestedAt: new Date().toISOString(),
        },
      },
    });

    // In a real implementation, this would:
    // 1. Schedule a background job to delete all data
    // 2. Delete files from storage (S3/R2)
    // 3. Delete database records in the correct order
    // 4. Send confirmation email
    // 5. Consider keeping audit logs for compliance

    // For demonstration, we'll delete data directly
    // WARNING: In production, this should be a queued job with proper safeguards

    // Delete in order to respect foreign key constraints
    // Start with dependent records first

    // Delete uploads (this would also need to delete files from storage)
    await db.upload.deleteMany({
      where: {
        request: {
          agencyId,
        },
      },
    });

    // Delete comments
    await db.comment.deleteMany({
      where: {
        OR: [
          { request: { agencyId } },
          { upload: { request: { agencyId } } },
        ],
      },
    });

    // Delete reminders
    await db.reminder.deleteMany({
      where: {
        request: {
          agencyId,
        },
      },
    });

    // Delete conversations and messages
    await db.message.deleteMany({
      where: {
        conversation: {
          request: { agencyId },
        },
      },
    });

    await db.conversationParticipant.deleteMany({
      where: {
        conversation: {
          request: { agencyId },
        },
      },
    });

    await db.conversation.deleteMany({
      where: {
        request: { agencyId },
      },
    });

    // Delete content requests
    await db.contentRequest.deleteMany({
      where: {
        agencyId,
      },
    });

    // Delete creators
    await db.creator.deleteMany({
      where: {
        agencyId,
      },
    });

    // Delete templates
    await db.requestTemplate.deleteMany({
      where: {
        agencyId,
      },
    });

    // Delete reminder configs
    await db.reminderConfig.deleteMany({
      where: {
        agencyId,
      },
    });

    // Log completion
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "data.delete_all.completed",
        entityType: "Agency",
        entityId: agencyId,
        metadata: {
          completedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "All data has been deleted",
    });
  } catch (error) {
    console.error("Data settings DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
