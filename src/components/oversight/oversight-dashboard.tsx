"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Eye,
  FileText,
  Flag,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
  Clock,
  BarChart3,
  ArrowRight,
  Bell,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type OversightStats,
  type ActivityLog,
  type KeywordAlert,
  type StaffActivityMetrics,
  type MessageOversight,
} from "@/types/oversight";
import { cn } from "@/lib/utils";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getActionIcon(action: string) {
  if (action.includes("message") || action.includes("comment")) return MessageSquare;
  if (action.includes("request")) return FileText;
  if (action.includes("upload")) return TrendingUp;
  return Activity;
}

function getActionLabel(action: string): string {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

interface SummaryResponse {
  stats: OversightStats;
  activity: ActivityLog[];
  keywordAlerts: KeywordAlert[];
  flaggedConversations: MessageOversight[];
  staff: StaffActivityMetrics[];
}

interface OversightDashboardProps {
  onNavigate?: (section: string) => void;
}

const EMPTY_STATS: OversightStats = {
  totalActionsToday: 0,
  totalActionsThisWeek: 0,
  activeStaffCount: 0,
  activeCreatorCount: 0,
  totalMessagesToday: 0,
  staffCreatorMessages: 0,
  staffStaffMessages: 0,
  newKeywordAlerts: 0,
  newActivityAlerts: 0,
  pendingReviewCount: 0,
  averageResponseTime: 0,
  pendingRequests: 0,
};

export function OversightDashboard({ onNavigate }: OversightDashboardProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());
  const [error, setError] = React.useState<string | null>(null);

  const [stats, setStats] = React.useState<OversightStats>(EMPTY_STATS);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [keywordAlerts, setKeywordAlerts] = React.useState<KeywordAlert[]>([]);
  const [flagged, setFlagged] = React.useState<MessageOversight[]>([]);
  const [staff, setStaff] = React.useState<StaffActivityMetrics[]>([]);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/oversight?type=summary");
      if (!res.ok) throw new Error("Failed to load oversight data");
      const data: SummaryResponse = await res.json();
      setStats(data.stats || EMPTY_STATS);
      setActivity(
        (data.activity || []).map((a) => ({ ...a, timestamp: new Date(a.timestamp) }))
      );
      setKeywordAlerts(
        (data.keywordAlerts || []).map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }))
      );
      setFlagged(
        (data.flaggedConversations || []).map((c) => ({
          ...c,
          lastMessageAt: new Date(c.lastMessageAt),
        }))
      );
      setStaff(data.staff || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header with Privacy Notice */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agency Oversight Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor staff and creator activity across your agency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last updated: {formatTimeAgo(lastRefresh)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                (isRefreshing || isLoading) && "animate-spin"
              )}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Privacy Notice */}
      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Monitoring Active
            </p>
            <p className="text-amber-700 dark:text-amber-300/80">
              Staff and creators have been notified that communications may be
              monitored for quality assurance and compliance purposes. All
              oversight actions are logged.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Actions Today</p>
                <p className="text-2xl font-bold">
                  {stats.totalActionsToday.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalActionsThisWeek.toLocaleString()} this week
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Messages Today</p>
                <p className="text-2xl font-bold">{stats.totalMessagesToday}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.staffCreatorMessages} staff-creator,{" "}
              {stats.staffStaffMessages} internal
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {stats.activeStaffCount + stats.activeCreatorCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-success" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.activeStaffCount} staff, {stats.activeCreatorCount} creators
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.pendingReviewCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.newKeywordAlerts} keyword, {stats.newActivityAlerts} activity
              alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Recent staff actions across your agency
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("staff")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] -mx-4 px-4">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? "Loading activity..." : "No recent activity"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activity.map((item) => {
                    const Icon = getActionIcon(item.action);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                      >
                        <Avatar
                          size="sm"
                          user={{ name: item.userName }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {item.userName}
                            </span>
                            <Badge variant="secondary">{item.userType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Icon className="h-3.5 w-3.5" />
                            {getActionLabel(item.action)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Keyword Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Keyword Alerts
              {keywordAlerts.length > 0 && (
                <Badge variant="destructive">{keywordAlerts.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Messages containing monitored keywords
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("alerts")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] -mx-4 px-4">
              {keywordAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? "Loading alerts..." : "No keyword alerts"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {keywordAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">{alert.keyword}</Badge>
                          <Badge variant="outline">
                            {alert.conversationType === "staff_creator"
                              ? "Staff-Creator"
                              : "Internal"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                        {alert.messagePreview}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        From: {alert.senderName} ({alert.senderRole})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Staff Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Staff Activity
            </CardTitle>
            <CardDescription>Performance metrics for your team</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("staff")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] -mx-4 px-4">
              {staff.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? "Loading staff..." : "No staff members"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {staff.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <Avatar size="sm" user={{ name: member.userName }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {member.userName}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.role}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {member.actionsToday} actions
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {member.averageResponseTime}m avg response
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Flagged Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Flagged Conversations
              {flagged.length > 0 && (
                <Badge variant="secondary">{flagged.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>Conversations requiring review</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("messages")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] -mx-4 px-4">
              {flagged.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Eye className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isLoading
                      ? "Loading conversations..."
                      : "No flagged conversations"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {flagged.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {conv.conversationType === "staff_creator"
                              ? "Staff-Creator"
                              : "Internal"}
                          </Badge>
                          <span className="text-sm font-medium">
                            {conv.messageCount} messages
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {conv.participants.slice(0, 3).map((p) => (
                          <Avatar key={p.id} size="xs" user={{ name: p.name }} />
                        ))}
                        <span className="text-sm text-muted-foreground truncate">
                          {conv.participants.map((p) => p.name).join(", ")}
                        </span>
                      </div>
                      {conv.flagReason && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                          <Flag className="h-3 w-3" />
                          {conv.flagReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Bar */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-success">
                {stats.averageResponseTime}m
              </p>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{stats.pendingRequests}</p>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-blue-600">
                {stats.activeStaffCount}
              </p>
              <p className="text-xs text-muted-foreground">Staff Online</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {stats.activeCreatorCount}
              </p>
              <p className="text-xs text-muted-foreground">Creators Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
