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

// Mock data for demonstration
const mockStats: OversightStats = {
  totalActionsToday: 847,
  totalActionsThisWeek: 4523,
  activeStaffCount: 12,
  activeCreatorCount: 45,
  totalMessagesToday: 234,
  staffCreatorMessages: 156,
  staffStaffMessages: 78,
  newKeywordAlerts: 3,
  newActivityAlerts: 1,
  pendingReviewCount: 4,
  averageResponseTime: 18,
  pendingRequests: 7,
};

const mockRecentActivity: ActivityLog[] = [
  {
    id: "1",
    userId: "staff-1",
    userType: "staff",
    userName: "Sarah Johnson",
    action: "sent_message",
    resourceType: "message",
    resourceId: "msg-123",
    details: { recipient: "Creator Alex", channel: "staff_creator" },
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "2",
    userId: "staff-2",
    userType: "staff",
    userName: "Mike Chen",
    action: "approved_request",
    resourceType: "request",
    resourceId: "req-456",
    details: { requestType: "content_approval" },
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: "3",
    userId: "creator-1",
    userType: "creator",
    userName: "Alex Rivera",
    action: "uploaded_content",
    resourceType: "upload",
    resourceId: "upload-789",
    details: { fileType: "video", size: "125MB" },
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
  },
  {
    id: "4",
    userId: "staff-3",
    userType: "staff",
    userName: "Emily Davis",
    action: "logged_in",
    resourceType: "session",
    resourceId: "session-101",
    details: { location: "New York, US" },
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
  },
];

const mockKeywordAlerts: KeywordAlert[] = [
  {
    id: "alert-1",
    keyword: "payment issue",
    messageId: "msg-1",
    conversationId: "conv-1",
    conversationType: "staff_creator",
    senderId: "creator-1",
    senderName: "Alex Rivera",
    senderRole: "Creator",
    recipientId: "staff-1",
    recipientName: "Sarah Johnson",
    messagePreview:
      "I'm having a payment issue with the last invoice...",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "new",
  },
  {
    id: "alert-2",
    keyword: "contract",
    messageId: "msg-2",
    conversationId: "conv-2",
    conversationType: "staff_staff",
    senderId: "staff-2",
    senderName: "Mike Chen",
    senderRole: "Account Manager",
    messagePreview:
      "We need to review the contract terms before sending...",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: "new",
  },
];

const mockStaffMetrics: StaffActivityMetrics[] = [
  {
    userId: "staff-1",
    userName: "Sarah Johnson",
    role: "Account Manager",
    actionsToday: 145,
    actionsThisWeek: 687,
    actionsThisMonth: 2450,
    messagesToCreators: 45,
    messagesToStaff: 23,
    averageResponseTime: 12,
    requestsHandled: 34,
    lastLogin: new Date(Date.now() - 30 * 60 * 1000),
    lastActivity: new Date(Date.now() - 5 * 60 * 1000),
    loginCount: 45,
    hasUnusualActivity: false,
  },
  {
    userId: "staff-2",
    userName: "Mike Chen",
    role: "Account Manager",
    actionsToday: 98,
    actionsThisWeek: 512,
    actionsThisMonth: 1890,
    messagesToCreators: 32,
    messagesToStaff: 18,
    averageResponseTime: 15,
    requestsHandled: 28,
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 45 * 60 * 1000),
    loginCount: 38,
    hasUnusualActivity: false,
  },
  {
    userId: "staff-3",
    userName: "Emily Davis",
    role: "Support Specialist",
    actionsToday: 67,
    actionsThisWeek: 345,
    actionsThisMonth: 1234,
    messagesToCreators: 56,
    messagesToStaff: 12,
    averageResponseTime: 8,
    requestsHandled: 45,
    lastLogin: new Date(Date.now() - 45 * 60 * 1000),
    lastActivity: new Date(Date.now() - 10 * 60 * 1000),
    loginCount: 52,
    hasUnusualActivity: true,
    unusualActivityReasons: ["High volume of messages after hours"],
  },
];

const mockFlaggedConversations: MessageOversight[] = [
  {
    id: "conv-1",
    conversationType: "staff_creator",
    participants: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "creator-1", name: "Alex Rivera", role: "Creator" },
    ],
    messageCount: 24,
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    flagged: true,
    flagReason: "Contains sensitive keyword: 'payment issue'",
    preview: "I'm having a payment issue with the last invoice...",
  },
  {
    id: "conv-2",
    conversationType: "staff_staff",
    participants: [
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
      { id: "staff-4", name: "Lisa Wang", role: "Legal" },
    ],
    messageCount: 8,
    lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    flagged: true,
    flagReason: "Contains sensitive keyword: 'contract'",
    preview: "We need to review the contract terms before sending...",
  },
];

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
  switch (action) {
    case "sent_message":
      return MessageSquare;
    case "approved_request":
      return FileText;
    case "uploaded_content":
      return TrendingUp;
    case "logged_in":
      return Activity;
    default:
      return Activity;
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "sent_message":
      return "Sent message";
    case "approved_request":
      return "Approved request";
    case "uploaded_content":
      return "Uploaded content";
    case "logged_in":
      return "Logged in";
    default:
      return action.replace(/_/g, " ");
  }
}

interface OversightDashboardProps {
  onNavigate?: (section: string) => void;
}

export function OversightDashboard({ onNavigate }: OversightDashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefresh(new Date());
    }, 1000);
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
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
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

      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Actions Today</p>
                <p className="text-2xl font-bold">
                  {mockStats.totalActionsToday.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockStats.totalActionsThisWeek.toLocaleString()} this week
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Messages Today</p>
                <p className="text-2xl font-bold">
                  {mockStats.totalMessagesToday}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockStats.staffCreatorMessages} staff-creator,{" "}
              {mockStats.staffStaffMessages} internal
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {mockStats.activeStaffCount + mockStats.activeCreatorCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockStats.activeStaffCount} staff, {mockStats.activeCreatorCount}{" "}
              creators
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-amber-600">
                  {mockStats.pendingReviewCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mockStats.newKeywordAlerts} keyword,{" "}
              {mockStats.newActivityAlerts} activity alerts
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
              Real-time feed of staff and creator actions
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("activity")}
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] -mx-4 px-4">
              <div className="space-y-4">
                {mockRecentActivity.map((activity) => {
                  const Icon = getActionIcon(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <Avatar
                        size="sm"
                        user={{ name: activity.userName }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {activity.userName}
                          </span>
                          <Badge
                            variant={
                              activity.userType === "staff"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {activity.userType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Icon className="h-3.5 w-3.5" />
                          {getActionLabel(activity.action)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Keyword Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Keyword Alerts
              {mockKeywordAlerts.length > 0 && (
                <Badge variant="destructive">{mockKeywordAlerts.length}</Badge>
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
              {mockKeywordAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No keyword alerts
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mockKeywordAlerts.map((alert) => (
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
            <CardDescription>
              Performance metrics for your team
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
              <div className="space-y-4">
                {mockStaffMetrics.map((staff) => (
                  <div
                    key={staff.userId}
                    className="flex items-center gap-3 pb-4 border-b last:border-0 last:pb-0"
                  >
                    <Avatar size="sm" user={{ name: staff.userName }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {staff.userName}
                        </span>
                        {staff.hasUnusualActivity && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {staff.role}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {staff.actionsToday} actions
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {staff.averageResponseTime}m avg response
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Flagged Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Flagged Conversations
              {mockFlaggedConversations.length > 0 && (
                <Badge variant="secondary">
                  {mockFlaggedConversations.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conversations requiring review
            </CardDescription>
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
              {mockFlaggedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Eye className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No flagged conversations
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mockFlaggedConversations.map((conv) => (
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
                          <Avatar
                            key={p.id}
                            size="xs"
                            user={{ name: p.name }}
                          />
                        ))}
                        <span className="text-sm text-muted-foreground">
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
              <p className="text-2xl font-bold text-green-600">
                {mockStats.averageResponseTime}m
              </p>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{mockStats.pendingRequests}</p>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-blue-600">
                {mockStats.activeStaffCount}
              </p>
              <p className="text-xs text-muted-foreground">Staff Online</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-purple-600">
                {mockStats.activeCreatorCount}
              </p>
              <p className="text-xs text-muted-foreground">Creators Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
