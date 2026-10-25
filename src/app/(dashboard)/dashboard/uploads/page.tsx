import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadsPageClient } from "./page-client";
import { getUploads, type PageProps } from "./query";
import { UploadsSkeleton } from "@/components/skeletons/page-skeletons/uploads-skeleton";

export const metadata = {
  title: "Uploads | Dashboard",
  description: "Review and manage all content uploads",
};

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
