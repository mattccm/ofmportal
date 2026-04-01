"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type {
  ResponseTimeMetrics,
  ResponseTimeByCreator,
  ResponseTimeByRequestType,
  ResponseTimeTrend,
  SLAComplianceMetrics,
} from "@/lib/response-time-types";
import { formatResponseTime } from "@/lib/response-time-types";

interface ResponseTimeChartProps {
  trends: ResponseTimeTrend[];
  title?: string;
  className?: string;
}

export function ResponseTimeChart({
  trends,
  title = "Response Time Trends",
  className,
}: ResponseTimeChartProps) {
  if (trends.length === 0) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out days with no data for chart
  const dataWithValues = trends.filter((t) => t.requestCount > 0);

  // Calculate max values for scaling
  const maxFirstResponse = Math.max(...dataWithValues.map((t) => t.avgFirstResponseHours), 1);
  const maxCompletion = Math.max(...dataWithValues.map((t) => t.avgCompletionHours), 1);
  const maxValue = Math.max(maxFirstResponse, maxCompletion);

  // Use last 14 data points for the chart
  const chartData = trends.slice(-14);

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">First Response</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Completion</span>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-48">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{formatResponseTime(maxValue)}</span>
            <span>{formatResponseTime(maxValue / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-14 h-full flex items-end gap-1">
            {chartData.map((point, index) => {
              const firstResponseHeight = point.avgFirstResponseHours > 0
                ? (point.avgFirstResponseHours / maxValue) * 100
                : 0;
              const completionHeight = point.avgCompletionHours > 0
                ? (point.avgCompletionHours / maxValue) * 100
                : 0;

              return (
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-0.5 group"
                >
                  <div className="w-full flex justify-center gap-0.5 h-40">
                    {/* First Response Bar */}
                    <div
                      className="w-2 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-400"
                      style={{ height: `${firstResponseHeight}%` }}
                      title={`First Response: ${formatResponseTime(point.avgFirstResponseHours)}`}
                    />
                    {/* Completion Bar */}
                    <div
                      className="w-2 bg-emerald-500 rounded-t transition-all duration-300 hover:bg-emerald-400"
                      style={{ height: `${completionHeight}%` }}
                      title={`Completion: ${formatResponseTime(point.avgCompletionHours)}`}
                    />
                  </div>

                  {/* X-axis label */}
                  <span className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                    {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
          {dataWithValues.length > 0 && (
            <>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg First Response</p>
                <p className="text-lg font-semibold">
                  {formatResponseTime(
                    dataWithValues.reduce((sum, t) => sum + t.avgFirstResponseHours, 0) / dataWithValues.length
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg Completion</p>
                <p className="text-lg font-semibold">
                  {formatResponseTime(
                    dataWithValues.reduce((sum, t) => sum + t.avgCompletionHours, 0) / dataWithValues.length
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-lg font-semibold">
                  {dataWithValues.reduce((sum, t) => sum + t.requestCount, 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg SLA Compliance</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {Math.round(
                    dataWithValues.filter((t) => t.slaCompliance > 0)
                      .reduce((sum, t) => sum + t.slaCompliance, 0) /
                    Math.max(dataWithValues.filter((t) => t.slaCompliance > 0).length, 1)
                  )}%
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ResponseTimeByCreatorChartProps {
  data: ResponseTimeByCreator[];
  title?: string;
  className?: string;
}

export function ResponseTimeByCreatorChart({
  data,
  title = "Response Time by Creator",
  className,
}: ResponseTimeByCreatorChartProps) {
  if (data.length === 0) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxHours = Math.max(...data.map((c) => c.avgFirstResponseHours), 1);

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 8).map((creator) => {
            const barWidth = (creator.avgFirstResponseHours / maxHours) * 100;
            const isGood = creator.firstResponseSLACompliance >= 80;
            const isWarning = creator.firstResponseSLACompliance >= 50 && creator.firstResponseSLACompliance < 80;

            return (
              <div key={creator.creatorId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {creator.creatorName.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate font-medium">{creator.creatorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatResponseTime(creator.avgFirstResponseHours)}
                    </span>
                    <Badge
                      variant={isGood ? "default" : isWarning ? "secondary" : "destructive"}
                      className="text-[10px] px-1.5"
                    >
                      {creator.firstResponseSLACompliance}%
                    </Badge>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isGood ? "bg-emerald-500" : isWarning ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ResponseTimeByTypeChartProps {
  data: ResponseTimeByRequestType[];
  title?: string;
  className?: string;
}

export function ResponseTimeByTypeChart({
  data,
  title = "Response Time by Request Type",
  className,
}: ResponseTimeByTypeChartProps) {
  if (data.length === 0) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate consistent colors based on hash of type name
  const getTypeColor = (type: string): string => {
    const colors = [
      "bg-violet-500",
      "bg-blue-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-emerald-500",
      "bg-cyan-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-indigo-500",
      "bg-teal-500",
    ];
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {data.map((item) => (
            <div
              key={item.type}
              className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    getTypeColor(item.type)
                  )}
                />
                <span className="text-sm font-medium truncate">{item.type}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">First Response</span>
                  <span className="font-medium">
                    {formatResponseTime(item.avgFirstResponseHours)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">
                    {formatResponseTime(item.avgCompletionHours)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Requests</span>
                  <span className="font-medium">{item.requestCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface SLAComplianceChartProps {
  data: SLAComplianceMetrics;
  title?: string;
  className?: string;
}

export function SLAComplianceChart({
  data,
  title = "SLA Compliance",
  className,
}: SLAComplianceChartProps) {
  const total = data.metSLA + data.atRiskSLA + data.breachedSLA;

  const renderDonut = (
    compliance: number,
    label: string
  ) => {
    const metPercent = compliance;
    const metDash = (metPercent / 100) * 97.5;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted"
            />
            {/* Compliance (green) */}
            {metPercent > 0 && (
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${metDash} 97.5`}
                strokeDashoffset="0"
                className="text-green-500"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">
              {Math.round(compliance)}%
            </span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-2">{label}</span>
      </div>
    );
  };

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Donut charts */}
        <div className="flex justify-center gap-8 mb-6">
          {renderDonut(data.firstResponseCompliance, "First Response")}
          {renderDonut(data.completionCompliance, "Completion")}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Met</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">At Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Breached</span>
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-medium">Met</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{data.metSLA}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-sm font-medium">At Risk</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{data.atRiskSLA}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-sm font-medium">Breached</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{data.breachedSLA}</p>
          </div>
        </div>

        {/* By priority breakdown */}
        {data.byPriority.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">By Priority</p>
            <div className="space-y-2">
              {data.byPriority.map((p) => (
                <div key={p.priority} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{p.priority}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          p.compliance >= 80 ? "bg-green-500" : p.compliance >= 50 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${p.compliance}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{p.compliance}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ResponseTimeMetricsCardProps {
  metrics: ResponseTimeMetrics;
  previousMetrics?: ResponseTimeMetrics;
  title?: string;
  className?: string;
}

export function ResponseTimeMetricsCard({
  metrics,
  previousMetrics,
  title = "Response Time Metrics",
  className,
}: ResponseTimeMetricsCardProps) {
  const getTrend = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10;
  };

  const TrendIcon = ({ value, inverse = false }: { value: number | null; inverse?: boolean }) => {
    if (value === null) return null;
    const isPositive = inverse ? value < 0 : value > 0;
    const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs",
          value === 0
            ? "text-muted-foreground"
            : isPositive
            ? "text-emerald-600"
            : "text-red-600"
        )}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(value)}%
      </span>
    );
  };

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-1">Avg First Response</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatResponseTime(metrics.avgFirstResponseHours)}
              </span>
              <TrendIcon
                value={getTrend(metrics.avgFirstResponseHours, previousMetrics?.avgFirstResponseHours)}
                inverse
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-muted-foreground mb-1">Avg Completion</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatResponseTime(metrics.avgCompletionHours)}
              </span>
              <TrendIcon
                value={getTrend(metrics.avgCompletionHours, previousMetrics?.avgCompletionHours)}
                inverse
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-muted-foreground mb-1">First Response SLA</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-violet-600 dark:text-violet-400">
                {metrics.firstResponseSLACompliance}%
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {metrics.totalRequests}
              </span>
              <TrendIcon
                value={getTrend(metrics.totalRequests, previousMetrics?.totalRequests)}
              />
            </div>
          </div>
        </div>

        {/* Additional stats */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Min First Response</p>
            <p className="text-sm font-medium">{formatResponseTime(metrics.minFirstResponseHours)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Max First Response</p>
            <p className="text-sm font-medium">{formatResponseTime(metrics.maxFirstResponseHours)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responded</p>
            <p className="text-sm font-medium">{metrics.respondedRequests} / {metrics.totalRequests}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-sm font-medium">{metrics.completedRequests} / {metrics.totalRequests}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
