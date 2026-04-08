"use client";

import Link from "next/link";
import { Trophy, ChevronRight, Upload, CheckCircle, Clock, Medal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { useWidgetData } from "../widget-data-provider";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface CreatorStats {
  id: string;
  name: string;
  avatar: string | null;
  uploadsThisMonth: number;
  approvalRate: number;
  avgResponseTimeHours: number;
  rank: number;
}

// ============================================
// RANK CONFIG
// ============================================

const RANK_CONFIG = [
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600", ring: "ring-amber-400" },
  { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-500", ring: "ring-slate-400" },
  { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700", ring: "ring-amber-600" },
];

// ============================================
// COMPONENT
// ============================================

export function TopCreatorsWidget({ config, size }: WidgetProps) {
  // Use batched widget data from context (single API call for all widgets)
  const { data, isLoading, error, refresh } = useWidgetData();
  const widgetData = data["top-creators"] as { creators: CreatorStats[] } | undefined;
  const creators = widgetData?.creators || [];

  const displayCount = size === "small" ? 3 : size === "medium" ? 5 : 8;

  return (
    <WidgetCard
      title="Top Performers"
      icon={<Trophy className="h-5 w-5 text-amber-500" />}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      actions={
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
          <Link href="/dashboard/analytics">
            View all
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      }
    >
      {creators.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No performance data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stats will appear once creators start uploading
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {creators.slice(0, displayCount).map((creator, index) => {
            const rankConfig = RANK_CONFIG[index];
            const isTopThree = index < 3;

            return (
              <Link
                key={creator.id}
                href={`/dashboard/creators/${creator.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                {/* Rank Badge */}
                <div className="w-6 text-center shrink-0">
                  {isTopThree && rankConfig ? (
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto",
                        rankConfig.bg,
                        rankConfig.text
                      )}
                    >
                      {index + 1}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{index + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar
                  user={{ name: creator.name, image: creator.avatar }}
                  size="sm"
                  className={cn(isTopThree && rankConfig && `ring-2 ${rankConfig.ring}`)}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {creator.name}
                  </p>
                  {size !== "small" && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        {creator.uploadsThisMonth}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        {creator.approvalRate}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {creator.avgResponseTimeHours < 24
                          ? `${creator.avgResponseTimeHours}h`
                          : `${Math.round(creator.avgResponseTimeHours / 24)}d`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats (compact for small) */}
                {size === "small" && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">{creator.approvalRate}%</p>
                    <p className="text-[10px] text-muted-foreground">{creator.uploadsThisMonth} uploads</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
