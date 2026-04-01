"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ChevronRight,
  Upload,
  UserPlus,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { WidgetCard, type WidgetProps } from "../widget-grid";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface ActivityItem {
  id: string;
  type: "upload" | "status_change" | "creator_signup" | "comment" | "message" | "approval" | "rejection";
  title: string;
  description: string;
  timestamp: string;
  avatar?: string | null;
  userName: string;
  link?: string;
}

// ============================================
// HELPERS
// ============================================

function getActivityIcon(type: string) {
  switch (type) {
    case "upload":
      return <Upload className="h-3.5 w-3.5" />;
    case "status_change":
      return <RefreshCw className="h-3.5 w-3.5" />;
    case "creator_signup":
      return <UserPlus className="h-3.5 w-3.5" />;
    case "comment":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "message":
      return <Send className="h-3.5 w-3.5" />;
    case "approval":
      return <CheckCircle className="h-3.5 w-3.5" />;
    case "rejection":
      return <XCircle className="h-3.5 w-3.5" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "upload":
      return "from-emerald-500 to-teal-500 text-white";
    case "status_change":
      return "from-blue-500 to-cyan-500 text-white";
    case "creator_signup":
      return "from-violet-500 to-purple-500 text-white";
    case "comment":
      return "from-amber-500 to-orange-500 text-white";
    case "message":
      return "from-pink-500 to-rose-500 text-white";
    case "approval":
      return "from-emerald-500 to-green-500 text-white";
    case "rejection":
      return "from-red-500 to-rose-500 text-white";
    default:
      return "from-gray-500 to-slate-500 text-white";
  }
}

// ============================================
// COMPONENT
// ============================================

export function ActivityFeedWidget({ config, size }: WidgetProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/widgets?widget=activity-feed");
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError("Failed to load activity feed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayCount = size === "small" ? 5 : size === "medium" ? 8 : 12;

  return (
    <WidgetCard
      title="Activity Feed"
      icon={<Activity className="h-5 w-5 text-primary" />}
      isLoading={isLoading}
      error={error}
      onRetry={fetchData}
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={fetchData}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-xs text-primary h-7">
            <Link href="/dashboard/activity">
              View all
              <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      }
    >
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No recent activity</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activity from your team will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-0.5 overflow-y-auto max-h-[400px] -mx-1 px-1">
          {activities.slice(0, displayCount).map((activity, index) => (
            <Link
              key={activity.id}
              href={activity.link || "#"}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Avatar with activity indicator */}
              <div className="relative shrink-0">
                <Avatar
                  user={{ name: activity.userName, image: activity.avatar }}
                  size="sm"
                />
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background bg-gradient-to-br",
                    getActivityColor(activity.type)
                  )}
                >
                  {getActivityIcon(activity.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  {activity.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
