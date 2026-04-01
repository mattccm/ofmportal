"use client";

import * as React from "react";
import {
  HardDrive,
  FileVideo,
  FileImage,
  FileText,
  Paperclip,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Types
export interface StorageBreakdown {
  type: string;
  label: string;
  size: number;
  count: number;
  color: string;
  icon: React.ReactNode;
}

export interface StorageStats {
  totalUsed: number;
  totalLimit: number;
  breakdown: StorageBreakdown[];
  trend: {
    direction: "up" | "down" | "stable";
    percentage: number;
    period: string;
  };
  recommendations: {
    type: "warning" | "info" | "suggestion";
    message: string;
    action?: string;
    actionLabel?: string;
  }[];
}

interface StorageUsageProps {
  stats: StorageStats | null;
  isLoading: boolean;
  onCleanupClick?: (type: string) => void;
}

// Format bytes to human readable
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Default breakdown icons
const defaultIcons: Record<string, React.ReactNode> = {
  videos: <FileVideo className="h-4 w-4" />,
  images: <FileImage className="h-4 w-4" />,
  documents: <FileText className="h-4 w-4" />,
  attachments: <Paperclip className="h-4 w-4" />,
  other: <HardDrive className="h-4 w-4" />,
};

// Default colors
const defaultColors: Record<string, string> = {
  videos: "bg-violet-500",
  images: "bg-blue-500",
  documents: "bg-amber-500",
  attachments: "bg-emerald-500",
  other: "bg-gray-500",
};

export function StorageUsage({ stats, isLoading, onCleanupClick }: StorageUsageProps) {
  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Unable to load storage statistics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = stats.totalLimit > 0
    ? Math.round((stats.totalUsed / stats.totalLimit) * 100)
    : 0;

  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 95;

  return (
    <div className="space-y-6">
      {/* Main Storage Card */}
      <Card className="card-elevated overflow-hidden">
        <div className={`h-2 ${
          isAtLimit
            ? "bg-red-500"
            : isNearLimit
              ? "bg-amber-500"
              : "bg-gradient-to-r from-primary via-violet-500 to-purple-500"
        }`} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                isAtLimit
                  ? "bg-red-500/10"
                  : isNearLimit
                    ? "bg-amber-500/10"
                    : "bg-primary/10"
              }`}>
                <HardDrive className={`h-5 w-5 ${
                  isAtLimit
                    ? "text-red-500"
                    : isNearLimit
                      ? "text-amber-500"
                      : "text-primary"
                }`} />
              </div>
              <div>
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>
                  {formatBytes(stats.totalUsed)} of {formatBytes(stats.totalLimit)} used
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stats.trend.direction !== "stable" && (
                <Badge
                  variant="outline"
                  className={
                    stats.trend.direction === "up"
                      ? "text-amber-500 border-amber-500/30"
                      : "text-emerald-500 border-emerald-500/30"
                  }
                >
                  {stats.trend.direction === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {stats.trend.percentage}% {stats.trend.period}
                </Badge>
              )}
              {stats.trend.direction === "stable" && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Minus className="h-3 w-3 mr-1" />
                  Stable
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Storage used</span>
              <span className={`font-semibold ${
                isAtLimit
                  ? "text-red-500"
                  : isNearLimit
                    ? "text-amber-500"
                    : ""
              }`}>
                {usagePercentage}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isAtLimit
                    ? "bg-red-500"
                    : isNearLimit
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-primary to-violet-500"
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Breakdown by Type */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Storage by Type</h4>
            <div className="space-y-2">
              {stats.breakdown.map((item) => {
                const percentage = stats.totalUsed > 0
                  ? Math.round((item.size / stats.totalUsed) * 100)
                  : 0;
                const icon = item.icon || defaultIcons[item.type] || defaultIcons.other;
                const color = item.color || defaultColors[item.type] || defaultColors.other;

                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded ${color}/10 flex items-center justify-center`}>
                          <span className={color.replace("bg-", "text-")}>{icon}</span>
                        </div>
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">({item.count} files)</span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatBytes(item.size)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Visual Breakdown</h4>
            <div className="h-8 w-full rounded-lg overflow-hidden flex">
              {stats.breakdown.map((item, index) => {
                const percentage = stats.totalUsed > 0
                  ? (item.size / stats.totalUsed) * 100
                  : 0;
                const color = item.color || defaultColors[item.type] || defaultColors.other;

                if (percentage < 1) return null;

                return (
                  <div
                    key={item.type}
                    className={`${color} transition-all duration-300 hover:brightness-110 cursor-pointer relative group`}
                    style={{ width: `${percentage}%` }}
                    title={`${item.label}: ${formatBytes(item.size)}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {percentage >= 15 && (
                        <span className="text-white text-xs font-medium">{Math.round(percentage)}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {stats.breakdown.map((item) => {
                const color = item.color || defaultColors[item.type] || defaultColors.other;
                return (
                  <div key={item.type} className="flex items-center gap-1.5 text-xs">
                    <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {stats.recommendations.length > 0 && (
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle>Cleanup Recommendations</CardTitle>
                <CardDescription>
                  Suggestions to optimize your storage usage
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border ${
                  rec.type === "warning"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : rec.type === "info"
                    ? "border-blue-500/20 bg-blue-500/5"
                    : "border-violet-500/20 bg-violet-500/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    {rec.type === "warning" ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    ) : rec.type === "info" ? (
                      <HardDrive className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{rec.message}</p>
                  </div>
                  {rec.action && rec.actionLabel && onCleanupClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCleanupClick(rec.action!)}
                      className="shrink-0"
                    >
                      {rec.actionLabel}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StorageUsage;
