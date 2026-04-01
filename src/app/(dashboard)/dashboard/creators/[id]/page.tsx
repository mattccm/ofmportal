import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreatorVaultClient } from "./creator-vault-client";
import {
  type CommunicationPreferences,
  DEFAULT_COMMUNICATION_PREFERENCES,
} from "@/types/communication-preferences";

export const metadata = {
  title: "Creator Profile | Dashboard",
  description: "View and manage creator profile and content vault",
};

async function getCreatorData(creatorId: string, agencyId: string) {
  const creator = await db.creator.findFirst({
    where: {
      id: creatorId,
      agencyId,
    },
    include: {
      _count: {
        select: {
          requests: true,
          uploads: true,
        },
      },
    },
  });

  if (!creator) {
    return null;
  }

  // Calculate stats
  const uploads = await db.upload.findMany({
    where: {
      creatorId,
      uploadStatus: "COMPLETED",
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      uploadedAt: true,
    },
  });

  const totalUploads = uploads.length;
  const approvedUploads = uploads.filter((u) => u.status === "APPROVED").length;
  const approvalRate = totalUploads > 0 ? Math.round((approvedUploads / totalUploads) * 100) : 0;

  // Calculate average response time
  const requestsWithUploads = await db.contentRequest.findMany({
    where: {
      creatorId,
      agencyId,
      uploads: { some: {} },
    },
    include: {
      uploads: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  let avgResponseTime = 0;
  if (requestsWithUploads.length > 0) {
    const totalResponseTime = requestsWithUploads.reduce((acc, req) => {
      if (req.uploads[0]) {
        const diff = req.uploads[0].createdAt.getTime() - req.createdAt.getTime();
        return acc + diff;
      }
      return acc;
    }, 0);
    avgResponseTime = totalResponseTime / requestsWithUploads.length / (1000 * 60 * 60);
  }

  // Get active requests
  const activeRequests = await db.contentRequest.findMany({
    where: {
      creatorId,
      agencyId,
      status: { in: ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"] },
    },
    orderBy: { dueDate: "asc" },
    include: {
      _count: {
        select: {
          uploads: true,
        },
      },
    },
  });

  // Get completed requests
  const completedRequests = await db.contentRequest.findMany({
    where: {
      creatorId,
      agencyId,
      status: { in: ["APPROVED", "CANCELLED"] },
    },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: {
      _count: {
        select: {
          uploads: true,
        },
      },
    },
  });

  // Get recent uploads for initial display
  const recentUploads = await db.upload.findMany({
    where: {
      creatorId,
      uploadStatus: "COMPLETED",
    },
    orderBy: { uploadedAt: "desc" },
    take: 24,
    include: {
      request: {
        select: {
          id: true,
          title: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get internal notes from contentPreferences
  const prefs = creator.contentPreferences as Record<string, unknown>;
  const internalNotes = (prefs?.internalNotes as Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    authorId: string;
    authorName: string;
  }>) || [];

  // Get communication preferences from contentPreferences
  const storedCommPrefs = prefs?.communicationPreferences as CommunicationPreferences | undefined;
  const communicationPreferences: CommunicationPreferences = storedCommPrefs || {
    ...DEFAULT_COMMUNICATION_PREFERENCES,
    contactDetails: {
      email: creator.email,
      phone: creator.phone || undefined,
    },
    timezone: creator.timezone || "UTC",
  };

  return {
    creator: {
      ...creator,
      stats: {
        totalUploads,
        approvalRate,
        avgResponseTimeHours: Math.round(avgResponseTime * 10) / 10,
        totalRequests: creator._count.requests,
        memberSince: creator.createdAt,
      },
    },
    activeRequests: activeRequests.map((r) => ({
      ...r,
      uploadCount: r._count.uploads,
    })),
    completedRequests: completedRequests.map((r) => ({
      ...r,
      uploadCount: r._count.uploads,
    })),
    recentUploads: recentUploads.map((u) => ({
      ...u,
      fileSize: Number(u.fileSize),
    })),
    internalNotes,
    communicationPreferences,
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start gap-6">
        <div className="h-24 w-24 rounded-2xl bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
          <div className="flex gap-4">
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-6 w-32 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="h-12 bg-muted rounded-lg w-full max-w-xl" />

      {/* Content skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const { id } = await params;
  const data = await getCreatorData(id, session.user.agencyId);

  if (!data) {
    notFound();
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CreatorVaultClient
        creator={data.creator}
        activeRequests={data.activeRequests}
        completedRequests={data.completedRequests}
        initialUploads={data.recentUploads}
        initialNotes={data.internalNotes}
        initialCommunicationPreferences={data.communicationPreferences}
        currentUser={{
          id: session.user.id,
          name: session.user.name || "Unknown",
          role: session.user.role,
        }}
      />
    </Suspense>
  );
}
