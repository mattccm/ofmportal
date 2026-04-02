import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Suspense } from "react";
import {
  getAnalyticsSummary,
  type DateRange,
  type DateRangeParams,
} from "@/lib/analytics";
import { getResponseTimeAnalytics } from "@/lib/response-time";
import { db } from "@/lib/db";
import { AnalyticsDashboard } from "./analytics-dashboard";
import {
  StatCardSkeleton,
} from "@/components/analytics/stat-card";
import { ProgressChartSkeleton } from "@/components/analytics/progress-chart";

interface PageProps {
  searchParams: Promise<{ range?: string; startDate?: string; endDate?: string; creatorId?: string }>;
}

async function AnalyticsContent({ dateRangeParams, creatorId }: { dateRangeParams: DateRangeParams; creatorId?: string }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const [data, responseTimeData, creators] = await Promise.all([
    getAnalyticsSummary(session.user.agencyId, dateRangeParams, creatorId),
    getResponseTimeAnalytics(session.user.agencyId, dateRangeParams, creatorId),
    db.creator.findMany({
      where: { agencyId: session.user.agencyId, inviteStatus: "ACCEPTED" },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AnalyticsDashboard
      data={data}
      responseTimeData={responseTimeData}
      initialRange={dateRangeParams.range}
      creators={creators}
      selectedCreatorId={creatorId}
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Charts row skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProgressChartSkeleton />
        <div className="h-80 bg-muted rounded-xl animate-pulse" />
      </div>

    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = (params.range as DateRange) || "30d";
  const creatorId = params.creatorId;
  const dateRangeParams: DateRangeParams = {
    range,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
  };

  return (
    <div className="animate-fade-in">
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent dateRangeParams={dateRangeParams} creatorId={creatorId} />
      </Suspense>
    </div>
  );
}
