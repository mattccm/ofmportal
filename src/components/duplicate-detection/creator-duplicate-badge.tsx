"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CreatorDuplicateStats } from "@/types/content-fingerprint";

// ============================================
// TYPES
// ============================================

interface CreatorDuplicateBadgeProps {
  creatorId: string;
  // If stats are provided, we don't need to fetch
  stats?: CreatorDuplicateStats;
  // Display variant
  variant?: "badge" | "compact" | "detailed";
  // Show link to detailed view
  showLink?: boolean;
  // Custom class
  className?: string;
}

interface BadgeContentProps {
  stats: CreatorDuplicateStats;
  variant: "badge" | "compact" | "detailed";
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSeverityConfig(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return {
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800/50",
        icon: Ban,
        label: "High Risk",
      };
    case "medium":
      return {
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        borderColor: "border-orange-200 dark:border-orange-800/50",
        icon: AlertTriangle,
        label: "Medium Risk",
      };
    case "low":
    default:
      return {
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800/50",
        icon: ShieldAlert,
        label: "Low Risk",
      };
  }
}

function getTrendConfig(trend: "increasing" | "stable" | "decreasing") {
  switch (trend) {
    case "increasing":
      return {
        icon: TrendingUp,
        color: "text-red-500",
        label: "Increasing",
      };
    case "decreasing":
      return {
        icon: TrendingDown,
        color: "text-green-500",
        label: "Decreasing",
      };
    case "stable":
    default:
      return {
        icon: Minus,
        color: "text-gray-500",
        label: "Stable",
      };
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// ============================================
// BADGE CONTENT COMPONENT
// ============================================

function BadgeContent({ stats, variant }: BadgeContentProps) {
  const severityConfig = getSeverityConfig(
    // Calculate severity based on stats
    stats.blockedAttempts >= 10 ? "high" :
    stats.blockedAttempts >= 5 ? "medium" : "low"
  );
  const trendConfig = getTrendConfig(stats.trend);
  const SeverityIcon = severityConfig.icon;
  const TrendIcon = trendConfig.icon;

  if (variant === "compact") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1",
          severityConfig.bgColor,
          severityConfig.color
        )}
      >
        <Copy className="h-3 w-3" />
        {stats.totalAttempts}
      </Badge>
    );
  }

  if (variant === "badge") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1.5",
          severityConfig.bgColor,
          severityConfig.color,
          "border",
          severityConfig.borderColor
        )}
      >
        <SeverityIcon className="h-3 w-3" />
        {stats.blockedAttempts} blocked
        <TrendIcon className={cn("h-3 w-3 ml-1", trendConfig.color)} />
      </Badge>
    );
  }

  // Detailed variant
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      severityConfig.bgColor,
      severityConfig.borderColor
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SeverityIcon className={cn("h-5 w-5", severityConfig.color)} />
          <span className={cn("font-semibold", severityConfig.color)}>
            {severityConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <TrendIcon className={cn("h-4 w-4", trendConfig.color)} />
          <span className="text-muted-foreground">{trendConfig.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold">{stats.totalAttempts}</p>
          <p className="text-xs text-muted-foreground">Total Attempts</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.blockedAttempts}
          </p>
          <p className="text-xs text-muted-foreground">Blocked</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.warnedAttempts}
          </p>
          <p className="text-xs text-muted-foreground">Warned</p>
        </div>
      </div>

      {stats.lastAttemptAt && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Last attempt: {formatDate(stats.lastAttemptAt)}
        </p>
      )}
    </div>
  );
}

// ============================================
// POPOVER CONTENT
// ============================================

function PopoverDetails({
  stats,
  creatorId,
  showLink,
}: {
  stats: CreatorDuplicateStats;
  creatorId: string;
  showLink: boolean;
}) {
  const severityConfig = getSeverityConfig(
    stats.blockedAttempts >= 10 ? "high" :
    stats.blockedAttempts >= 5 ? "medium" : "low"
  );
  const trendConfig = getTrendConfig(stats.trend);
  const SeverityIcon = severityConfig.icon;
  const TrendIcon = trendConfig.icon;

  return (
    <div className="space-y-4 w-64">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            severityConfig.bgColor
          )}>
            <SeverityIcon className={cn("h-4 w-4", severityConfig.color)} />
          </div>
          <div>
            <p className="font-semibold">Duplicate Attempts</p>
            <p className={cn("text-xs", severityConfig.color)}>
              {severityConfig.label}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded-lg bg-muted/50 text-center">
          <p className="text-lg font-bold">{stats.totalAttempts}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {stats.blockedAttempts}
          </p>
          <p className="text-xs text-muted-foreground">Blocked</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Trend</span>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn("h-4 w-4", trendConfig.color)} />
          <span>{trendConfig.label}</span>
        </div>
      </div>

      {stats.lastAttemptAt && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Attempt</span>
          <span>{formatDate(stats.lastAttemptAt)}</span>
        </div>
      )}

      {showLink && (
        <Link href={`/dashboard/settings/duplicate-detection?creatorId=${creatorId}`}>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            View Details
          </Button>
        </Link>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CreatorDuplicateBadge({
  creatorId,
  stats: initialStats,
  variant = "badge",
  showLink = true,
  className,
}: CreatorDuplicateBadgeProps) {
  const [stats, setStats] = React.useState<CreatorDuplicateStats | null>(initialStats || null);
  const [isLoading, setIsLoading] = React.useState(!initialStats);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch stats if not provided
  React.useEffect(() => {
    if (!initialStats) {
      fetchStats();
    }
  }, [initialStats, creatorId]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/duplicate-attempts/${creatorId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No duplicate attempts - don't show badge
          setStats(null);
          return;
        }
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();

      // Convert pattern data to stats format
      if (data.pattern) {
        setStats({
          creatorId: data.pattern.creatorId,
          totalAttempts: data.pattern.totalAttempts,
          blockedAttempts: data.pattern.blockedAttempts,
          warnedAttempts: data.stats?.warnedCount || 0,
          lastAttemptAt: data.pattern.lastAttempt ? new Date(data.pattern.lastAttempt) : undefined,
          trend: data.pattern.trend,
        });
      } else if (data.stats && data.stats.totalAttempts > 0) {
        setStats({
          creatorId,
          totalAttempts: data.stats.totalAttempts,
          blockedAttempts: data.stats.blockedCount,
          warnedAttempts: data.stats.warnedCount,
          lastAttemptAt: undefined,
          trend: "stable",
        });
      } else {
        setStats(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render anything if loading or no stats
  if (isLoading) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  if (error || !stats || stats.totalAttempts === 0) {
    return null;
  }

  // For compact and badge variants, use tooltip
  if (variant === "compact" || variant === "badge") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn("cursor-pointer", className)}>
            <BadgeContent stats={stats} variant={variant} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-4">
          <PopoverDetails stats={stats} creatorId={creatorId} showLink={showLink} />
        </PopoverContent>
      </Popover>
    );
  }

  // Detailed variant renders inline
  return (
    <div className={className}>
      <BadgeContent stats={stats} variant={variant} />
      {showLink && (
        <Link
          href={`/dashboard/settings/duplicate-detection?creatorId=${creatorId}`}
          className="mt-3 block"
        >
          <Button variant="outline" size="sm" className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            View All Attempts
          </Button>
        </Link>
      )}
    </div>
  );
}

// ============================================
// INLINE BADGE (for tables and lists)
// ============================================

export function CreatorDuplicateInlineBadge({
  totalAttempts,
  blockedAttempts,
  severity = "low",
  className,
}: {
  totalAttempts: number;
  blockedAttempts: number;
  severity?: "low" | "medium" | "high";
  className?: string;
}) {
  if (totalAttempts === 0) return null;

  const severityConfig = getSeverityConfig(severity);
  const SeverityIcon = severityConfig.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1",
              severityConfig.bgColor,
              severityConfig.color,
              className
            )}
          >
            <SeverityIcon className="h-3 w-3" />
            {blockedAttempts}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{blockedAttempts} blocked / {totalAttempts} total duplicate attempts</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CreatorDuplicateBadge;
