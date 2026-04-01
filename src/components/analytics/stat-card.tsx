"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ContextualHelp } from "@/components/help/contextual-help";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

function Sparkline({ data, color = "currentColor", height = 32 }: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((value - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={areaD}
        fill={`url(#sparkline-gradient-${color})`}
        className="transition-all duration-500"
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />

      {/* End dot */}
      <circle
        cx={width - padding}
        cy={height - ((data[data.length - 1] - min) / range) * (height - padding * 2) - padding}
        r="3"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}

interface TrendIndicatorProps {
  value: number;
  suffix?: string;
  inverse?: boolean; // When true, negative is good (e.g., turnaround time)
}

function TrendIndicator({ value, suffix = "%", inverse = false }: TrendIndicatorProps) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNeutral = value === 0;
  const displayValue = Math.abs(value);

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {value > 0 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>
        {displayValue.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  trend?: number;
  trendSuffix?: string;
  inverseTrend?: boolean;
  icon: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  comparison?: string;
  href?: string;
  className?: string;
  /** Help content key for contextual help */
  helpKey?: string;
}

export function StatCard({
  title,
  value,
  previousValue,
  trend,
  trendSuffix = "%",
  inverseTrend = false,
  icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  sparklineData,
  sparklineColor,
  comparison,
  href,
  className,
  helpKey,
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "card-elevated relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        href && "cursor-pointer group",
        className
      )}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-violet-500 to-purple-500 opacity-80" />

      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-xl shrink-0",
                  iconBgColor
                )}
              >
                <div className={cn("h-5 w-5", iconColor)}>{icon}</div>
              </div>
              <span className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </span>
              {helpKey && (
                <ContextualHelp helpKey={helpKey} size="sm" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {value}
                </span>
                {previousValue !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    vs {previousValue}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {trend !== undefined && (
                  <TrendIndicator
                    value={trend}
                    suffix={trendSuffix}
                    inverse={inverseTrend}
                  />
                )}
                {comparison && (
                  <span className="text-xs text-muted-foreground">{comparison}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Sparkline */}
          {sparklineData && sparklineData.length > 1 && (
            <div className="flex-shrink-0">
              <Sparkline
                data={sparklineData}
                color={sparklineColor || "hsl(var(--primary))"}
              />
            </div>
          )}
        </div>

        {/* Drill-down indicator */}
        {href && (
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 text-xs text-primary">
              <span>View details</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        )}
      </CardContent>

      {/* Hover gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none",
          "bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5",
          href && "group-hover:opacity-100"
        )}
      />
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <Card className={cn("card-elevated relative overflow-hidden", className)}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-muted via-muted to-muted animate-shimmer" />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
