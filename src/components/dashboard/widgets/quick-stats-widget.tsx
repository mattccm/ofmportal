"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Clock,
  Eye,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface QuickStats {
  activeCreators: number;
  pendingRequests: number;
  awaitingReview: number;
  dueThisWeek: number;
  overdueItems: number;
  // Optional trend data
  trends?: {
    activeCreators?: number;
    pendingRequests?: number;
    awaitingReview?: number;
  };
}

interface StatItem {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href?: string;
  trend?: number;
  isAlert?: boolean;
}

// ============================================
// TREND INDICATOR
// ============================================

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        <span>0%</span>
      </span>
    );
  }

  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[10px] font-medium",
        isPositive ? "text-emerald-600" : "text-red-600"
      )}
    >
      {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      <span>{Math.abs(value)}%</span>
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

export function QuickStatsWidget({ config, size }: WidgetProps) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/widgets?widget=quick-stats");
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError("Failed to load stats");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statItems: StatItem[] = stats
    ? [
        {
          label: "Active Creators",
          value: stats.activeCreators,
          icon: <Users className="h-4 w-4" />,
          iconBg: "bg-primary/10",
          iconColor: "text-primary",
          href: "/dashboard/creators",
          trend: stats.trends?.activeCreators,
        },
        {
          label: "Pending",
          value: stats.pendingRequests,
          icon: <Clock className="h-4 w-4" />,
          iconBg: "bg-amber-500/10",
          iconColor: "text-amber-500",
          href: "/dashboard/requests?status=pending",
          trend: stats.trends?.pendingRequests,
        },
        {
          label: "To Review",
          value: stats.awaitingReview,
          icon: <Eye className="h-4 w-4" />,
          iconBg: "bg-violet-500/10",
          iconColor: "text-violet-500",
          href: "/dashboard/uploads?status=pending",
          trend: stats.trends?.awaitingReview,
        },
        {
          label: "Due This Week",
          value: stats.dueThisWeek,
          icon: <Calendar className="h-4 w-4" />,
          iconBg: "bg-blue-500/10",
          iconColor: "text-blue-500",
          href: "/dashboard/requests?filter=due-soon",
        },
        {
          label: "Overdue",
          value: stats.overdueItems,
          icon: <AlertTriangle className="h-4 w-4" />,
          iconBg: stats.overdueItems > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
          iconColor: stats.overdueItems > 0 ? "text-red-500" : "text-emerald-500",
          href: "/dashboard/requests?status=overdue",
          isAlert: stats.overdueItems > 0,
        },
      ]
    : [];

  // Adjust display based on size
  const displayStats = size === "small" ? statItems.slice(0, 4) : statItems;
  const gridCols = size === "small" ? "grid-cols-2" : size === "medium" ? "grid-cols-3" : "grid-cols-5";

  return (
    <WidgetCard
      title="Quick Stats"
      icon={<BarChart3 className="h-5 w-5 text-primary" />}
      isLoading={isLoading}
      error={error}
      onRetry={fetchData}
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/analytics">
            Analytics
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {stats && (
        <div className={cn("grid gap-3", gridCols)}>
          {displayStats.map((stat, index) => (
            <Link
              key={stat.label}
              href={stat.href || "#"}
              className={cn(
                "flex flex-col p-3 rounded-xl border transition-all duration-200 group",
                "hover:border-primary/50 hover:shadow-sm",
                stat.isAlert && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    stat.iconBg
                  )}
                >
                  <div className={stat.iconColor}>{stat.icon}</div>
                </div>
                {stat.trend !== undefined && <TrendIndicator value={stat.trend} />}
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  stat.isAlert ? "text-red-600 dark:text-red-400" : "text-foreground"
                )}
              >
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
