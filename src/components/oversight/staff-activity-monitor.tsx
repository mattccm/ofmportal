"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Clock,
  RefreshCw,
  Search,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type StaffActivityMetrics,
  type ActivityLog,
} from "@/types/oversight";
import { cn } from "@/lib/utils";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function getActionLabel(action: string, details: Record<string, unknown>): string {
  const base = action.replace(/\./g, " ").replace(/_/g, " ");
  const target = details.title || details.fileName || details.creatorName;
  return target ? `${base} - ${target}` : base;
}

function getStatusColor(staff: StaffActivityMetrics): string {
  if (!staff.lastActivity) return "bg-gray-400";
  const diffMins = (Date.now() - staff.lastActivity.getTime()) / 60000;
  if (diffMins < 5) return "bg-success";
  if (diffMins < 30) return "bg-yellow-500";
  return "bg-gray-400";
}

export function StaffActivityMonitor() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [staffMetrics, setStaffMetrics] = React.useState<StaffActivityMetrics[]>([]);
  const [activityFeed, setActivityFeed] = React.useState<ActivityLog[]>([]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"activity" | "response" | "name">(
    "activity"
  );
  const [filterRole, setFilterRole] = React.useState<string>("all");
  const [showAlertsOnly, setShowAlertsOnly] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, activityRes] = await Promise.all([
        fetch("/api/oversight?type=staff"),
        fetch("/api/oversight?type=activity"),
      ]);
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffMetrics(
          (data.staff || []).map((s: StaffActivityMetrics) => ({
            ...s,
            lastLogin: s.lastLogin ? new Date(s.lastLogin) : undefined,
            lastActivity: s.lastActivity ? new Date(s.lastActivity) : undefined,
          }))
        );
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivityFeed(
          (data.activity || []).map((a: ActivityLog) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Get unique roles
  const roles = React.useMemo(() => {
    const roleSet = new Set(staffMetrics.map((s) => s.role));
    return Array.from(roleSet);
  }, [staffMetrics]);

  // Filter and sort staff
  const filteredStaff = React.useMemo(() => {
    let result = [...staffMetrics];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.userName.toLowerCase().includes(query) ||
          s.role.toLowerCase().includes(query)
      );
    }

    if (filterRole !== "all") {
      result = result.filter((s) => s.role === filterRole);
    }

    if (showAlertsOnly) {
      result = result.filter((s) => s.hasUnusualActivity);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "activity":
          return b.actionsToday - a.actionsToday;
        case "response":
          return a.averageResponseTime - b.averageResponseTime;
        case "name":
          return a.userName.localeCompare(b.userName);
        default:
          return 0;
      }
    });

    return result;
  }, [staffMetrics, searchQuery, filterRole, showAlertsOnly, sortBy]);

  // Filter activity feed for selected staff
  const filteredActivity = React.useMemo(() => {
    if (!selectedStaff) return activityFeed;
    return activityFeed.filter((a) => a.userId === selectedStaff);
  }, [activityFeed, selectedStaff]);

  // Calculate team averages
  const teamStats = React.useMemo(() => {
    const total = staffMetrics.length || 1;
    return {
      avgActionsToday: Math.round(
        staffMetrics.reduce((sum, s) => sum + s.actionsToday, 0) / total
      ),
      avgResponseTime: Math.round(
        staffMetrics.reduce((sum, s) => sum + s.averageResponseTime, 0) / total
      ),
      activeNow: staffMetrics.filter(
        (s) =>
          s.lastActivity &&
          Date.now() - s.lastActivity.getTime() < 5 * 60 * 1000
      ).length,
      alertCount: staffMetrics.filter((s) => s.hasUnusualActivity).length,
    };
  }, [staffMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Staff Activity Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoring of staff actions and performance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Now</p>
                <p className="text-2xl font-bold text-success">
                  {teamStats.activeNow}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-success" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              of {staffMetrics.length} staff members
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Avg Actions Today
                </p>
                <p className="text-2xl font-bold">{teamStats.avgActionsToday}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">per staff member</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{teamStats.avgResponseTime}m</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-tile-hi flex items-center justify-center">
                <Clock className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">team average</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Activity Alerts</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    teamStats.alertCount > 0 ? "text-amber-600" : ""
                  )}
                >
                  {teamStats.alertCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              unusual patterns detected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger aria-label="Filter by role" className="w-[160px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) =>
                setSortBy(v as "activity" | "response" | "name")
              }
            >
              <SelectTrigger aria-label="Sort by" className="w-[160px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">Most Active</SelectItem>
                <SelectItem value="response">Best Response</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showAlertsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAlertsOnly(!showAlertsOnly)}
              className="h-10"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Staff Members
            </CardTitle>
            <CardDescription>
              {filteredStaff.length} staff member
              {filteredStaff.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] -mx-4 px-4">
              {filteredStaff.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? "Loading staff..." : "No staff members found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStaff.map((staff) => {
                    const maxActions = Math.max(
                      ...staffMetrics.map((s) => s.actionsToday),
                      1
                    );
                    const activityPercent =
                      (staff.actionsToday / maxActions) * 100;

                    return (
                      <div
                        key={staff.userId}
                        className={cn(
                          "p-4 rounded-lg border transition-colors cursor-pointer",
                          selectedStaff === staff.userId
                            ? "bg-muted border-primary"
                            : "bg-card hover:bg-muted/50"
                        )}
                        onClick={() =>
                          setSelectedStaff(
                            selectedStaff === staff.userId ? null : staff.userId
                          )
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar size="md" user={{ name: staff.userName }} />
                            <span
                              className={cn(
                                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                                getStatusColor(staff)
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {staff.userName}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {staff.role}
                            </p>

                            {/* Activity bar */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">
                                  Actions today
                                </span>
                                <span className="font-medium">
                                  {staff.actionsToday}
                                </span>
                              </div>
                              <Progress aria-label={`${staff.userName}: actions today`}
                                value={activityPercent}
                                className="h-1.5"
                              />
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <div className="text-center p-2 rounded bg-muted/50">
                                <p className="text-xs text-muted-foreground">
                                  Response
                                </p>
                                <p className="text-sm font-medium">
                                  {staff.averageResponseTime}m
                                </p>
                              </div>
                              <div className="text-center p-2 rounded bg-muted/50">
                                <p className="text-xs text-muted-foreground">
                                  Messages
                                </p>
                                <p className="text-sm font-medium">
                                  {staff.messagesToCreators +
                                    staff.messagesToStaff}
                                </p>
                              </div>
                              <div className="text-center p-2 rounded bg-muted/50">
                                <p className="text-xs text-muted-foreground">
                                  Requests
                                </p>
                                <p className="text-sm font-medium">
                                  {staff.requestsHandled}
                                </p>
                              </div>
                            </div>

                            {/* Last active */}
                            <p className="text-xs text-muted-foreground mt-3">
                              Last active:{" "}
                              {staff.lastActivity
                                ? formatTimeAgo(staff.lastActivity)
                                : "Unknown"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              {selectedStaff
                ? `Activity for ${
                    staffMetrics.find((s) => s.userId === selectedStaff)
                      ?.userName || "staff member"
                  }`
                : "All staff activity"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] -mx-4 px-4">
              {filteredActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? "Loading activity..." : "No recent activity"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Avatar size="xs" user={{ name: item.userName }} />
                          <span className="font-medium text-sm truncate">
                            {item.userName}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {getActionLabel(item.action, item.details)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
