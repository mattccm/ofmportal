"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/analytics/stat-card";
import { ProgressChart, WeeklyActivityChart, DonutChart } from "@/components/analytics/progress-chart";
import {
  ResponseTimeChart,
  ResponseTimeByCreatorChart,
  ResponseTimeByTypeChart,
  SLAComplianceChart,
  ResponseTimeMetricsCard,
} from "@/components/analytics/response-time-chart";
import { SectionErrorBoundary, WidgetErrorBoundary } from "@/components/errors";
import { ContextualHelp } from "@/components/help/contextual-help";
import { cn } from "@/lib/utils";
import {
  Upload,
  CheckCircle,
  Clock,
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  Sparkles,
  RefreshCw,
  Timer,
} from "lucide-react";
import type {
  OverviewStats,
  StatusBreakdown,
  WeeklyActivity,
  CreatorStats,
  DailyActivity,
  DateRange,
} from "@/lib/analytics";
import type {
  ResponseTimeMetrics,
  SLAComplianceMetrics,
  ResponseTimeByCreator,
  ResponseTimeByRequestType,
  ResponseTimeTrend,
} from "@/lib/response-time-types";

interface AnalyticsData {
  overview: OverviewStats;
  statusBreakdown: StatusBreakdown[];
  weeklyActivity: WeeklyActivity[];
  leaderboard: CreatorStats[];
  dailyActivity: DailyActivity[];
}

interface ResponseTimeData {
  metrics: ResponseTimeMetrics;
  slaCompliance: SLAComplianceMetrics;
  byCreator: ResponseTimeByCreator[];
  byRequestType: ResponseTimeByRequestType[];
  trends: ResponseTimeTrend[];
}

interface Creator {
  id: string;
  name: string;
  avatar: string | null;
}

interface AnalyticsDashboardProps {
  data: AnalyticsData;
  responseTimeData: ResponseTimeData;
  initialRange: DateRange;
  creators?: Creator[];
  selectedCreatorId?: string;
}

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AnalyticsDashboard({ data, responseTimeData, initialRange, creators = [], selectedCreatorId }: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedRange, setSelectedRange] = useState<DateRange>(initialRange);
  const [creatorId, setCreatorId] = useState<string>(selectedCreatorId || "all");

  const handleRangeChange = (range: DateRange) => {
    setSelectedRange(range);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", range);
      router.push(`/dashboard/analytics?${params.toString()}`);
    });
  };

  const handleCreatorChange = (value: string) => {
    setCreatorId(value);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("creatorId");
      } else {
        params.set("creatorId", value);
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    });
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const selectedCreator = creators.find(c => c.id === creatorId);

  // Calculate trend percentages
  const uploadTrend =
    data.overview.previousUploads > 0
      ? ((data.overview.totalUploads - data.overview.previousUploads) /
          data.overview.previousUploads) *
        100
      : data.overview.totalUploads > 0
      ? 100
      : 0;

  const approvalTrend = data.overview.approvalRate - data.overview.previousApprovalRate;

  const turnaroundTrend =
    data.overview.previousAvgTurnaroundHours > 0
      ? ((data.overview.avgTurnaroundHours - data.overview.previousAvgTurnaroundHours) /
          data.overview.previousAvgTurnaroundHours) *
        100
      : 0;

  const creatorTrend =
    data.overview.previousActiveCreators > 0
      ? ((data.overview.activeCreators - data.overview.previousActiveCreators) /
          data.overview.previousActiveCreators) *
        100
      : data.overview.activeCreators > 0
      ? 100
      : 0;

  // Generate sparkline data from weekly activity
  const uploadSparkline = data.weeklyActivity.map((w) => w.uploads);
  const approvalSparkline = data.weeklyActivity.map((w) => w.approvals);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Analytics
            </h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your content performance and creator activity.
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3" data-tour="date-range-selector">
          {/* Creator Selector */}
          {creators.length > 0 && (
            <Select value={creatorId} onValueChange={handleCreatorChange}>
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Creators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Creators</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <ContextualHelp helpKey="analytics.date-range" size="sm" />
          <div className="flex items-center rounded-lg border bg-card p-1">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRangeChange(option.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                  selectedRange === option.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-9 w-9"
          >
            <RefreshCw
              className={cn("h-4 w-4", isPending && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-xl shadow-lg border">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Updating analytics...</span>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 stagger-children">
        <StatCard
          title="Total Uploads"
          value={data.overview.totalUploads}
          previousValue={data.overview.previousUploads}
          trend={Math.round(uploadTrend * 10) / 10}
          icon={<Upload />}
          iconColor="text-violet-500"
          iconBgColor="bg-violet-500/10"
          sparklineData={uploadSparkline}
          sparklineColor="#8b5cf6"
          comparison="vs previous period"
          helpKey="dashboard.total-uploads"
        />

        <StatCard
          title="Approval Rate"
          value={`${data.overview.approvalRate}%`}
          previousValue={`${data.overview.previousApprovalRate}%`}
          trend={Math.round(approvalTrend * 10) / 10}
          trendSuffix=" pts"
          icon={<CheckCircle />}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
          sparklineData={approvalSparkline}
          sparklineColor="#10b981"
          comparison="vs previous period"
          helpKey="dashboard.approval-rate"
        />

        <StatCard
          title="Avg Turnaround"
          value={
            data.overview.avgTurnaroundHours < 24
              ? `${Math.round(data.overview.avgTurnaroundHours)}h`
              : `${Math.round(data.overview.avgTurnaroundHours / 24)}d`
          }
          previousValue={
            data.overview.previousAvgTurnaroundHours < 24
              ? `${Math.round(data.overview.previousAvgTurnaroundHours)}h`
              : `${Math.round(data.overview.previousAvgTurnaroundHours / 24)}d`
          }
          trend={Math.round(turnaroundTrend * 10) / 10}
          inverseTrend
          icon={<Clock />}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/10"
          comparison="vs previous period"
          helpKey="dashboard.avg-turnaround"
        />

        <StatCard
          title="SLA Compliance"
          value={`${responseTimeData.slaCompliance.firstResponseCompliance}%`}
          icon={<Timer />}
          iconColor={
            responseTimeData.slaCompliance.firstResponseCompliance >= 80
              ? "text-green-500"
              : responseTimeData.slaCompliance.firstResponseCompliance >= 50
              ? "text-yellow-500"
              : "text-red-500"
          }
          iconBgColor={
            responseTimeData.slaCompliance.firstResponseCompliance >= 80
              ? "bg-green-500/10"
              : responseTimeData.slaCompliance.firstResponseCompliance >= 50
              ? "bg-yellow-500/10"
              : "bg-red-500/10"
          }
          comparison="first response SLA"
        />

        <StatCard
          title="Active Creators"
          value={data.overview.activeCreators}
          previousValue={data.overview.previousActiveCreators}
          trend={Math.round(creatorTrend * 10) / 10}
          icon={<Users />}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
          comparison="with uploads this period"
          helpKey="dashboard.active-creators"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Breakdown */}
        <WidgetErrorBoundary>
          <div className="space-y-4">
            <ProgressChart
              data={data.statusBreakdown}
              title="Request Status Breakdown"
            />
          </div>
        </WidgetErrorBoundary>

        {/* Donut Chart with Summary */}
        <WidgetErrorBoundary>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Overview Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6 md:flex-row md:justify-around">
                <DonutChart data={data.statusBreakdown} size={160} strokeWidth={20} />
                <div className="space-y-3 flex-1 max-w-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-sm">Completed</span>
                    </div>
                    <span className="font-semibold">
                      {data.statusBreakdown.find((s) => s.status === "APPROVED")?.count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-violet-500" />
                      <span className="text-sm">In Review</span>
                    </div>
                    <span className="font-semibold">
                      {(data.statusBreakdown.find((s) => s.status === "SUBMITTED")?.count || 0) +
                        (data.statusBreakdown.find((s) => s.status === "UNDER_REVIEW")?.count || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="font-semibold">
                      {(data.statusBreakdown.find((s) => s.status === "PENDING")?.count || 0) +
                        (data.statusBreakdown.find((s) => s.status === "IN_PROGRESS")?.count || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Weekly Activity Chart */}
      <SectionErrorBoundary>
        <WeeklyActivityChart
          data={data.weeklyActivity}
          title="Weekly Activity Trends"
        />
      </SectionErrorBoundary>

      {/* Response Time & SLA Section Header */}
      <div className="space-y-1 pt-4">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Response Time & SLA Metrics
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Track response times and SLA compliance across your content requests.
        </p>
      </div>

      {/* Response Time Metrics */}
      <SectionErrorBoundary>
        <ResponseTimeMetricsCard metrics={responseTimeData.metrics} />
      </SectionErrorBoundary>

      {/* SLA Compliance & Response Time Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary>
          <SLAComplianceChart data={responseTimeData.slaCompliance} />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <ResponseTimeChart trends={responseTimeData.trends} />
        </WidgetErrorBoundary>
      </div>

      {/* Response Time by Creator & Type */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary>
          <ResponseTimeByCreatorChart data={responseTimeData.byCreator} />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <ResponseTimeByTypeChart data={responseTimeData.byRequestType} />
        </WidgetErrorBoundary>
      </div>


      {/* Insights Card */}
      <Card className="card-elevated bg-gradient-to-br from-primary/5 via-background to-violet-500/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Performance Insights</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {data.overview.approvalRate >= 80 ? (
                  <>
                    Excellent work! Your approval rate of{" "}
                    <span className="font-medium text-emerald-600">
                      {data.overview.approvalRate}%
                    </span>{" "}
                    is above average. Keep up the great quality standards with your creators.
                  </>
                ) : data.overview.approvalRate >= 60 ? (
                  <>
                    Your approval rate is{" "}
                    <span className="font-medium text-amber-600">
                      {data.overview.approvalRate}%
                    </span>
                    . Consider providing more detailed briefs to your creators to improve content quality.
                  </>
                ) : (
                  <>
                    Your approval rate of{" "}
                    <span className="font-medium text-red-600">
                      {data.overview.approvalRate}%
                    </span>{" "}
                    could use improvement. Try scheduling alignment calls with your top creators.
                  </>
                )}
                {data.overview.avgTurnaroundHours > 48 && (
                  <>
                    {" "}
                    Consider reviewing turnaround times - currently averaging{" "}
                    {Math.round(data.overview.avgTurnaroundHours / 24)} days.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-4">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          Data updated: {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
