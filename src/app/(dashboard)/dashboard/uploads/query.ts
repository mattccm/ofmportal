// Server-side query for the Uploads page and its "load more" action.
import { db } from "@/lib/db";
import { uploadWhere, redactCreatorsIn, type Access } from "@/lib/access/server";

export interface PageProps {
  searchParams: Promise<{
    status?: string;
    creator?: string;
    templateId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: string;
    view?: string;
    page?: string;
  }>;
}

export async function getUploads(access: Access, searchParams: Awaited<PageProps["searchParams"]>) {
  const {
    status,
    creator,
    templateId,
    dateFrom,
    dateTo,
    sort = "uploadedAt",
    order = "desc",
    page = "1",
  } = searchParams;

  const sortKey = ["uploadedAt", "originalName", "fileSize", "createdAt"].includes(sort) ? sort : "uploadedAt";
  const sortOrder = order === "asc" ? "asc" : "desc";
  const pageSize = 24;
  const pageNum = parseInt(page, 10) || 1;
  const skip = (pageNum - 1) * pageSize;

  // Build where clause. The creator scope sits in AND so the template
  // filter below can still add to `request`.
  const where: Record<string, unknown> = {
    AND: [uploadWhere(access)],
    request: {
      agencyId: access.agencyId,
    },
    uploadStatus: "COMPLETED",
  };

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (creator) {
    where.creatorId = creator;
  }

  if (templateId) {
    where.request = {
      ...(where.request as Record<string, unknown>),
      templateId,
    };
  }

  if (dateFrom || dateTo) {
    where.uploadedAt = {};
    if (dateFrom) {
      (where.uploadedAt as Record<string, Date>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.uploadedAt as Record<string, Date>).lte = new Date(dateTo);
    }
  }

  // Get uploads with pagination - optimized query (removed comments, reviewedBy, template nesting)
  const [uploads, total] = await Promise.all([
    db.upload.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        storageKey: true,
        thumbnailKey: true,
        uploadStatus: true,
        status: true,
        reviewNote: true,
        rating: true,
        uploadedAt: true,
        createdAt: true,
        tags: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        request: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        [sortKey]: sortOrder,
      },
      skip,
      take: pageSize,
    }),
    db.upload.count({ where }),
  ]);

  return {
    uploads: redactCreatorsIn(access, uploads).map((upload) => ({
      ...upload,
      fileSize: Number(upload.fileSize),
      tags: upload.tags as Array<{ id: string; name: string; color: string }> | undefined,
    })),
    total,
    pageSize,
    currentPage: pageNum,
    totalPages: Math.ceil(total / pageSize),
  };
}

