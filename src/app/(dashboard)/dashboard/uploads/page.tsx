import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadsPageClient } from "./page-client";
import { UploadsSkeleton } from "@/components/skeletons/page-skeletons/uploads-skeleton";

export const metadata = {
  title: "Uploads | Dashboard",
  description: "Review and manage all content uploads",
};

interface PageProps {
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

async function getUploads(agencyId: string, searchParams: Awaited<PageProps["searchParams"]>) {
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

  const pageSize = 24;
  const pageNum = parseInt(page, 10) || 1;
  const skip = (pageNum - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {
    request: {
      agencyId,
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
        [sort]: order,
      },
      skip,
      take: pageSize,
    }),
    db.upload.count({ where }),
  ]);

  return {
    uploads: uploads.map((upload) => ({
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

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

async function getTemplates(agencyId: string) {
  return db.requestTemplate.findMany({
    where: { agencyId, isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

async function getStats(agencyId: string) {
  // Use groupBy to get all status counts in a single query instead of 4 separate counts
  const statusCounts = await db.upload.groupBy({
    by: ["status"],
    where: {
      request: { agencyId },
      uploadStatus: "COMPLETED",
    },
    _count: true,
  });

  // Convert to the expected format
  let total = 0;
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  for (const item of statusCounts) {
    total += item._count;
    if (item.status === "PENDING") pending = item._count;
    else if (item.status === "APPROVED") approved = item._count;
    else if (item.status === "REJECTED") rejected = item._count;
  }

  return { total, pending, approved, rejected };
}

function LoadingFallback() {
  return <UploadsSkeleton />;
}

export default async function UploadsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const params = await searchParams;

  let uploadsData: Awaited<ReturnType<typeof getUploads>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    [uploadsData, creators, templates, stats] = await Promise.all([
      getUploads(session.user.agencyId, params),
      getCreators(session.user.agencyId),
      getTemplates(session.user.agencyId),
      getStats(session.user.agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch uploads data:", error);
    uploadsData = { uploads: [], total: 0, pageSize: 24, currentPage: 1, totalPages: 0 };
    creators = [];
    templates = [];
    stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <UploadsPageClient
        initialUploads={uploadsData.uploads}
        creators={creators}
        templates={templates}
        stats={stats}
        pagination={{
          total: uploadsData.total,
          pageSize: uploadsData.pageSize,
          currentPage: uploadsData.currentPage,
          totalPages: uploadsData.totalPages,
        }}
        initialFilters={{
          status: params.status || "all",
          creator: params.creator || "",
          templateId: params.templateId || "",
          dateFrom: params.dateFrom || "",
          dateTo: params.dateTo || "",
          sort: params.sort || "uploadedAt",
          order: params.order || "desc",
          view: (params.view as "grid" | "list") || "grid",
        }}
      />
    </Suspense>
  );
}
