"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: {
    label: "Pending",
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-violet-500",
    bgColor: "bg-violet-500/10",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "bg-orange-500",
    bgColor: "bg-orange-500/10",
  },
  NEEDS_REVISION: {
    label: "Needs Revision",
    color: "bg-red-500",
    bgColor: "bg-red-500/10",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-gray-400",
    bgColor: "bg-gray-400/10",
  },
};

interface StatusBreakdownItem {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface ProgressChartProps {
  data: StatusBreakdownItem[];
  title?: string;
  showLegend?: boolean;
  className?: string;
}

export function ProgressChart({
  data,
  title = "Request Status Breakdown",
  showLegend = true,
  className,
}: ProgressChartProps) {
  const [animated, setAnimated] = useState(false);
  const total = data.reduce((acc, item) => acc + item.count, 0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (data.length === 0) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stacked bar visualization */}
        <div className="space-y-3">
          <div className="h-4 rounded-full overflow-hidden flex bg-muted/50">
            {data.map((item, index) => {
              const config = STATUS_CONFIG[item.status] || {
                color: "bg-gray-400",
                bgColor: "bg-gray-400/10",
              };
              return (
                <div
                  key={item.status}
                  className={cn(
                    "h-full transition-all duration-700 ease-out",
                    config.color,
                    index === 0 && "rounded-l-full",
                    index === data.length - 1 && "rounded-r-full"
                  )}
                  style={{
                    width: animated ? `${item.percentage}%` : "0%",
                    transitionDelay: `${index * 50}ms`,
                  }}
                  title={`${STATUS_CONFIG[item.status]?.label || item.status}: ${item.count} (${item.percentage}%)`}
                />
              );
            })}
          </div>
        </div>

        {/* Individual progress bars */}
        <div className="space-y-3">
          {data.map((item, index) => {
            const config = STATUS_CONFIG[item.status] || {
              label: item.status,
              color: "bg-gray-400",
              bgColor: "bg-gray-400/10",
            };

            return (
              <div
                key={item.status}
                className="group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", config.color)} />
                    <span className="text-sm font-medium text-foreground">
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">{item.count}</span>
                    <span className="text-muted-foreground">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-muted/50">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden",
                      config.color
                    )}
                    style={{
                      width: animated ? `${item.percentage}%` : "0%",
                      transitionDelay: `${index * 100}ms`,
                    }}
                  >
                    {/* Shimmer effect */}
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{
                        transform: "translateX(-100%)",
                        animation: animated
                          ? `shimmer 2s ${index * 0.2}s infinite`
                          : "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="pt-3 border-t">
            <div className="flex flex-wrap gap-3">
              {data.map((item) => {
                const config = STATUS_CONFIG[item.status] || {
                  label: item.status,
                  color: "bg-gray-400",
                };
                return (
                  <div key={item.status} className="flex items-center gap-1.5">
                    <div className={cn("h-2 w-2 rounded-full", config.color)} />
                    <span className="text-xs text-muted-foreground">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </Card>
  );
}

// Weekly Activity Bar Chart
interface WeeklyActivityData {
  week: string;
  startDate: Date;
  uploads: number;
  approvals: number;
  requests: number;
}

interface WeeklyActivityChartProps {
  data: WeeklyActivityData[];
  title?: string;
  className?: string;
}

export function WeeklyActivityChart({
  data,
  title = "Weekly Activity",
  className,
}: WeeklyActivityChartProps) {
  const [animated, setAnimated] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.uploads, d.approvals, d.requests]),
    1
  );

  const metrics = [
    { key: "uploads", label: "Uploads", color: "bg-violet-500", hoverColor: "bg-violet-600" },
    { key: "approvals", label: "Approvals", color: "bg-emerald-500", hoverColor: "bg-emerald-600" },
    { key: "requests", label: "Requests", color: "bg-blue-500", hoverColor: "bg-blue-600" },
  ] as const;

  if (data.length === 0) {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No activity data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-4">
            {metrics.map((metric) => (
              <div key={metric.key} className="flex items-center gap-1.5">
                <div className={cn("h-2.5 w-2.5 rounded-full", metric.color)} />
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{maxValue}</span>
            <span>{Math.round(maxValue / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-12 h-full flex items-end gap-2">
            {data.map((item, index) => (
              <div
                key={item.week}
                className="flex-1 flex flex-col items-center gap-1"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Bars */}
                <div className="w-full h-52 flex items-end justify-center gap-0.5">
                  {metrics.map((metric, metricIndex) => {
                    const value = item[metric.key];
                    const height = (value / maxValue) * 100;

                    return (
                      <div
                        key={metric.key}
                        className={cn(
                          "w-3 rounded-t-sm transition-all duration-500 ease-out relative",
                          hoveredIndex === index ? metric.hoverColor : metric.color
                        )}
                        style={{
                          height: animated ? `${height}%` : "0%",
                          transitionDelay: `${(index * 3 + metricIndex) * 30}ms`,
                          minHeight: value > 0 ? "4px" : "0px",
                        }}
                      >
                        {/* Tooltip on hover */}
                        {hoveredIndex === index && metricIndex === 1 && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10">
                            <div className="bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border p-2 whitespace-nowrap">
                              <div className="font-semibold mb-1">{item.week}</div>
                              {metrics.map((m) => (
                                <div key={m.key} className="flex items-center gap-2">
                                  <div className={cn("h-1.5 w-1.5 rounded-full", m.color)} />
                                  <span>{m.label}:</span>
                                  <span className="font-medium">{item[m.key]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* X-axis label */}
                <span className="text-xs text-muted-foreground">{item.week}</span>
              </div>
            ))}
          </div>

          {/* Grid lines */}
          <div className="absolute left-12 right-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-border/30" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Donut Chart for Overview
interface DonutChartProps {
  data: StatusBreakdownItem[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  className,
}: DonutChartProps) {
  const [animated, setAnimated] = useState(false);
  const total = data.reduce((acc, item) => acc + item.count, 0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (data.length === 0 || total === 0) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <div className="text-muted-foreground text-sm">No data</div>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />

        {/* Data segments */}
        {data.map((item, index) => {
          const percentage = item.count / total;
          const dashLength = circumference * percentage;
          const dashOffset = circumference - currentOffset;
          currentOffset += dashLength;

          const config = STATUS_CONFIG[item.status];

          // Convert the Tailwind color class to an actual color
          const colorMap: Record<string, string> = {
            "bg-amber-500": "#f59e0b",
            "bg-blue-500": "#3b82f6",
            "bg-violet-500": "#8b5cf6",
            "bg-orange-500": "#f97316",
            "bg-red-500": "#ef4444",
            "bg-emerald-500": "#10b981",
            "bg-gray-400": "#9ca3af",
          };

          return (
            <circle
              key={item.status}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colorMap[config?.color || "bg-gray-400"] || item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-all duration-1000 ease-out"
              style={{
                strokeDashoffset: animated ? dashOffset : circumference,
                transitionDelay: `${index * 100}ms`,
              }}
            />
          );
        })}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{total}</span>
        <span className="text-xs text-muted-foreground">Total</span>
      </div>
    </div>
  );
}

export function ProgressChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-2">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-full bg-muted rounded-full animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
