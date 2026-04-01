"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimelineFull, type ActivityItem } from "@/components/activity/activity-timeline";
import {
  Activity,
  Calendar,
  Clock,
  Download,
  BarChart3,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ActivityPageClientProps {
  initialActivities: ActivityItem[];
  users: Array<{ id: string; name: string; avatar: string | null }>;
  stats: {
    today: number;
    thisWeek: number;
    total: number;
  };
}

export function ActivityPageClient({
  initialActivities,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  users,
  stats,
}: ActivityPageClientProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    toast.info("Preparing activity log export...");

    try {
      const response = await fetch("/api/activity?pageSize=1000");
      if (!response.ok) throw new Error("Failed to fetch activities");

      const data = await response.json();
      const activities = data.activities;

      // Create CSV content
      const headers = ["Timestamp", "Action", "Description", "User", "Entity Type", "Entity ID"];
      const rows = activities.map((activity: ActivityItem) => [
        format(new Date(activity.timestamp), "yyyy-MM-dd HH:mm:ss"),
        activity.action,
        activity.description,
        activity.user?.name || "System",
        activity.entityType,
        activity.entityId,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row: string[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Activity log exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export activity log");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            Activity Log
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Track all actions and events across your agency
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export Log
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.today}</p>
                <p className="text-xs text-muted-foreground mt-1">activities recorded</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Week</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground mt-1">activities recorded</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {stats.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">all-time activities</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Type Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground mr-2">Quick filters:</span>
        <Badge variant="outline" className="cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20">
          <div className="h-2 w-2 rounded-full bg-violet-500 mr-1.5" />
          Uploads
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <div className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
          Comments
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <div className="h-2 w-2 rounded-full bg-blue-500 mr-1.5" />
          Requests
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20">
          <div className="h-2 w-2 rounded-full bg-orange-500 mr-1.5" />
          Reminders
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
          <div className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
          Status Changes
        </Badge>
      </div>

      {/* Activity Timeline */}
      <ActivityTimelineFull initialActivities={initialActivities} />
    </div>
  );
}
