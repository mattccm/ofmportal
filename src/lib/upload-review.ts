import { db } from "@/lib/db";
import { format } from "date-fns";

/**
 * Upload Review Statistics
 */
export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  averageRating: number | null;
  reviewedToday: number;
  pendingByCreator: {
    creatorId: string;
    creatorName: string;
    count: number;
  }[];
}

/**
 * Get comprehensive review statistics for an agency
 */
export async function getReviewStats(agencyId: string): Promise<ReviewStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    total,
    pending,
    approved,
    rejected,
    avgRating,
    reviewedToday,
    pendingByCreator,
  ] = await Promise.all([
    // Total completed uploads
    db.upload.count({
      where: {
        request: { agencyId },
        uploadStatus: "COMPLETED",
      },
    }),

    // Pending uploads
    db.upload.count({
      where: {
        request: { agencyId },
        uploadStatus: "COMPLETED",
        status: "PENDING",
      },
    }),

    // Approved uploads
    db.upload.count({
      where: {
        request: { agencyId },
        uploadStatus: "COMPLETED",
        status: "APPROVED",
      },
    }),

    // Rejected uploads
    db.upload.count({
      where: {
        request: { agencyId },
        uploadStatus: "COMPLETED",
        status: "REJECTED",
      },
    }),

    // Average rating
    db.upload.aggregate({
      where: {
        request: { agencyId },
        rating: { not: null },
      },
      _avg: {
        rating: true,
      },
    }),

    // Reviewed today
    db.activityLog.count({
      where: {
        action: { in: ["upload.approved", "upload.rejected", "upload.bulk_approved", "upload.bulk_rejected"] },
        createdAt: { gte: today },
      },
    }),

    // Pending by creator
    db.upload.groupBy({
      by: ["creatorId"],
      where: {
        request: { agencyId },
        uploadStatus: "COMPLETED",
        status: "PENDING",
      },
      _count: {
        id: true,
      },
    }),
  ]);

  // Get creator names for pending counts
  const creatorIds = pendingByCreator.map((p) => p.creatorId);
  const creators = await db.creator.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true },
  });

  const creatorMap = new Map(creators.map((c) => [c.id, c.name]));

  const reviewedCount = approved + rejected;
  const approvalRate = reviewedCount > 0 ? (approved / reviewedCount) * 100 : 0;

  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate: Math.round(approvalRate * 10) / 10,
    averageRating: avgRating._avg.rating
      ? Math.round(avgRating._avg.rating * 10) / 10
      : null,
    reviewedToday,
    pendingByCreator: pendingByCreator
      .map((p) => ({
        creatorId: p.creatorId,
        creatorName: creatorMap.get(p.creatorId) || "Unknown",
        count: p._count.id,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Timeline Event for upload history
 */
export interface TimelineEvent {
  id: string;
  action: string;
  timestamp: Date;
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Get the status change timeline for an upload
 */
export async function getUploadTimeline(uploadId: string): Promise<TimelineEvent[]> {
  // Get activity logs for this upload
  const logs = await db.activityLog.findMany({
    where: {
      entityType: "Upload",
      entityId: { contains: uploadId },
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

  // Get upload creation date
  const upload = await db.upload.findUnique({
    where: { id: uploadId },
    select: {
      createdAt: true,
      uploadedAt: true,
      creator: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  });

  const timeline: TimelineEvent[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    timestamp: log.createdAt,
    user: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          avatar: log.user.avatar,
        }
      : undefined,
    metadata: log.metadata as Record<string, unknown>,
  }));

  // Add upload event
  if (upload?.uploadedAt) {
    timeline.push({
      id: `upload-${uploadId}`,
      action: "upload.completed",
      timestamp: upload.uploadedAt,
      user: upload.creator
        ? {
            id: upload.creator.id,
            name: upload.creator.name,
            avatar: upload.creator.avatar,
          }
        : undefined,
    });
  }

  // Add creation event
  if (upload?.createdAt) {
    timeline.push({
      id: `created-${uploadId}`,
      action: "upload.created",
      timestamp: upload.createdAt,
    });
  }

  // Sort by timestamp descending
  return timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Review Report Data
 */
export interface ReviewReportItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  creatorName: string;
  creatorEmail: string;
  requestTitle: string;
  status: string;
  rating: number | null;
  reviewNote: string | null;
  reviewerName: string | null;
  uploadedAt: Date | null;
  reviewedAt: Date | null;
}

/**
 * Generate a review report for selected uploads or filtered results
 */
export async function generateReviewReport(
  agencyId: string,
  options: {
    uploadIds?: string[];
    status?: string;
    creatorId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}
): Promise<ReviewReportItem[]> {
  const { uploadIds, status, creatorId, dateFrom, dateTo } = options;

  const where: Record<string, unknown> = {
    request: { agencyId },
    uploadStatus: "COMPLETED",
  };

  if (uploadIds && uploadIds.length > 0) {
    where.id = { in: uploadIds };
  }

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (creatorId) {
    where.creatorId = creatorId;
  }

  if (dateFrom || dateTo) {
    where.uploadedAt = {};
    if (dateFrom) {
      (where.uploadedAt as Record<string, Date>).gte = dateFrom;
    }
    if (dateTo) {
      (where.uploadedAt as Record<string, Date>).lte = dateTo;
    }
  }

  const uploads = await db.upload.findMany({
    where,
    include: {
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
      request: {
        select: {
          title: true,
        },
      },
      reviewedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      uploadedAt: "desc",
    },
  });

  // Get review timestamps from activity log
  const uploadIds2 = uploads.map((u) => u.id);
  const reviewLogs = await db.activityLog.findMany({
    where: {
      entityType: "Upload",
      entityId: { in: uploadIds2 },
      action: { in: ["upload.approved", "upload.rejected"] },
    },
    select: {
      entityId: true,
      createdAt: true,
    },
  });

  const reviewDates = new Map(reviewLogs.map((l) => [l.entityId, l.createdAt]));

  return uploads.map((upload) => ({
    id: upload.id,
    fileName: upload.originalName,
    fileType: upload.fileType,
    fileSize: Number(upload.fileSize),
    creatorName: upload.creator.name,
    creatorEmail: upload.creator.email,
    requestTitle: upload.request.title,
    status: upload.status,
    rating: upload.rating,
    reviewNote: upload.reviewNote,
    reviewerName: upload.reviewedBy?.name || null,
    uploadedAt: upload.uploadedAt,
    reviewedAt: reviewDates.get(upload.id) || null,
  }));
}

/**
 * Convert report data to CSV format
 */
export function reportToCsv(report: ReviewReportItem[]): string {
  const headers = [
    "ID",
    "File Name",
    "File Type",
    "File Size (bytes)",
    "Creator Name",
    "Creator Email",
    "Request Title",
    "Status",
    "Rating",
    "Review Notes",
    "Reviewer",
    "Uploaded At",
    "Reviewed At",
  ];

  const rows = report.map((item) => [
    item.id,
    `"${item.fileName.replace(/"/g, '""')}"`,
    item.fileType,
    item.fileSize,
    `"${item.creatorName.replace(/"/g, '""')}"`,
    item.creatorEmail,
    `"${item.requestTitle.replace(/"/g, '""')}"`,
    item.status,
    item.rating ?? "",
    item.reviewNote ? `"${item.reviewNote.replace(/"/g, '""')}"` : "",
    item.reviewerName ? `"${item.reviewerName.replace(/"/g, '""')}"` : "",
    item.uploadedAt ? format(item.uploadedAt, "yyyy-MM-dd HH:mm:ss") : "",
    item.reviewedAt ? format(item.reviewedAt, "yyyy-MM-dd HH:mm:ss") : "",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Get review queue - uploads that need attention
 */
export interface ReviewQueueItem {
  id: string;
  fileName: string;
  fileType: string;
  thumbnailUrl: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  requestTitle: string;
  uploadedAt: Date;
  daysPending: number;
}

export async function getReviewQueue(
  agencyId: string,
  limit: number = 10
): Promise<ReviewQueueItem[]> {
  const uploads = await db.upload.findMany({
    where: {
      request: { agencyId },
      uploadStatus: "COMPLETED",
      status: "PENDING",
    },
    include: {
      creator: {
        select: {
          name: true,
          avatar: true,
        },
      },
      request: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      uploadedAt: "asc", // Oldest first
    },
    take: limit,
  });

  const now = new Date();

  return uploads.map((upload) => {
    const uploadDate = upload.uploadedAt || upload.createdAt;
    const daysPending = Math.floor(
      (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: upload.id,
      fileName: upload.originalName,
      fileType: upload.fileType,
      thumbnailUrl: upload.thumbnailUrl,
      creatorName: upload.creator.name,
      creatorAvatar: upload.creator.avatar,
      requestTitle: upload.request.title,
      uploadedAt: uploadDate,
      daysPending,
    };
  });
}

/**
 * Get review performance metrics for a user
 */
export interface ReviewerMetrics {
  totalReviewed: number;
  approved: number;
  rejected: number;
  averageRating: number | null;
  reviewsThisWeek: number;
  reviewsThisMonth: number;
}

export async function getReviewerMetrics(userId: string): Promise<ReviewerMetrics> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalStats, weekStats, monthStats, avgRating] = await Promise.all([
    // All time stats
    db.upload.groupBy({
      by: ["status"],
      where: {
        reviewedById: userId,
        status: { in: ["APPROVED", "REJECTED"] },
      },
      _count: {
        id: true,
      },
    }),

    // This week
    db.activityLog.count({
      where: {
        userId,
        action: { in: ["upload.approved", "upload.rejected"] },
        createdAt: { gte: weekAgo },
      },
    }),

    // This month
    db.activityLog.count({
      where: {
        userId,
        action: { in: ["upload.approved", "upload.rejected"] },
        createdAt: { gte: monthAgo },
      },
    }),

    // Average rating given
    db.upload.aggregate({
      where: {
        reviewedById: userId,
        rating: { not: null },
      },
      _avg: {
        rating: true,
      },
    }),
  ]);

  const approved = totalStats.find((s) => s.status === "APPROVED")?._count.id || 0;
  const rejected = totalStats.find((s) => s.status === "REJECTED")?._count.id || 0;

  return {
    totalReviewed: approved + rejected,
    approved,
    rejected,
    averageRating: avgRating._avg.rating
      ? Math.round(avgRating._avg.rating * 10) / 10
      : null,
    reviewsThisWeek: weekStats,
    reviewsThisMonth: monthStats,
  };
}
