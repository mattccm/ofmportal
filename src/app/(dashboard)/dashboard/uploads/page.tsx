import { Suspense } from "react";
import { db } from "@/lib/db";
import { getPageAccess, creatorWhere, uploadWhere, redactCreator, type Access } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { UploadsPageClient } from "./page-client";
import { getUploads, type PageProps } from "./query";
import { UploadsSkeleton } from "@/components/skeletons/page-skeletons/uploads-skeleton";

export const metadata = {
  title: "Uploads | Dashboard",
  description: "Review and manage all content uploads",
};

async function getCreators(access: Access) {
  return db.creator.findMany({
    where: creatorWhere(access),
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

async function getStats(access: Access) {
  // Use groupBy to get all status counts in a single query instead of 4 separate counts
  const statusCounts = await db.upload.groupBy({
    by: ["status"],
    where: {
      ...uploadWhere(access),
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
  const access = await getPageAccess();
  if (!access.has("review.view")) return <NoAccess what="uploads" roleName={access.role.name} />;

  const params = await searchParams;

  let uploadsData: Awaited<ReturnType<typeof getUploads>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    [uploadsData, creators, templates, stats] = await Promise.all([
      getUploads(access, params),
      getCreators(access).then((c) => redactCreator(access, c)),
      getTemplates(access.agencyId),
      getStats(access),
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
