"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Calendar,
  Clock,
  Download,
  LogIn,
  LogOut,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
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
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type StaffActivityMetrics,
  type ActivityLog,
} from "@/types/oversight";
import { cn } from "@/lib/utils";

// Mock staff activity data
const mockStaffMetrics: StaffActivityMetrics[] = [
  {
    userId: "staff-1",
    userName: "Sarah Johnson",
    role: "Account Manager",
    avatar: undefined,
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
    avatar: undefined,
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
    avatar: undefined,
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
  {
    userId: "staff-4",
    userName: "Lisa Wang",
    role: "Legal",
    avatar: undefined,
    actionsToday: 23,
    actionsThisWeek: 145,
    actionsThisMonth: 567,
    messagesToCreators: 8,
    messagesToStaff: 34,
    averageResponseTime: 45,
    requestsHandled: 12,
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
    loginCount: 28,
    hasUnusualActivity: false,
  },
  {
    userId: "staff-5",
    userName: "James Wilson",
    role: "Content Reviewer",
    avatar: undefined,
    actionsToday: 189,
    actionsThisWeek: 823,
    actionsThisMonth: 3100,
    messagesToCreators: 78,
    messagesToStaff: 15,
    averageResponseTime: 5,
    requestsHandled: 67,
    lastLogin: new Date(Date.now() - 15 * 60 * 1000),
    lastActivity: new Date(Date.now() - 2 * 60 * 1000),
    loginCount: 62,
    hasUnusualActivity: true,
    unusualActivityReasons: ["Unusually high request volume", "Multiple rapid logins"],
  },
];

// Mock real-time activity feed
const mockActivityFeed: ActivityLog[] = [
  {
    id: "act-1",
    userId: "staff-1",
    userType: "staff",
    userName: "Sarah Johnson",
    action: "sent_message",
    resourceType: "message",
    resourceId: "msg-123",
    details: { recipient: "Alex Rivera", channel: "staff_creator" },
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: "act-2",
    userId: "staff-5",
    userType: "staff",
    userName: "James Wilson",
    action: "approved_content",
    resourceType: "upload",
    resourceId: "upload-456",
    details: { contentType: "video", creator: "Jordan Lee" },
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "act-3",
    userId: "staff-3",
    userType: "staff",
    userName: "Emily Davis",
    action: "resolved_request",
    resourceType: "request",
    resourceId: "req-789",
    details: { requestType: "support", resolution: "completed" },
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: "act-4",
    userId: "staff-2",
    userType: "staff",
    userName: "Mike Chen",
    action: "logged_in",
    resourceType: "session",
    resourceId: "session-101",
    details: { location: "San Francisco, US", device: "Desktop" },
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: "act-5",
    userId: "staff-1",
    userType: "staff",
    userName: "Sarah Johnson",
    action: "updated_creator_profile",
    resourceType: "creator",
    resourceId: "creator-1",
    details: { field: "payment_info", creator: "Alex Rivera" },
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "act-6",
    userId: "staff-4",
    userType: "staff",
    userName: "Lisa Wang",
    action: "reviewed_contract",
    resourceType: "document",
    resourceId: "doc-202",
    details: { status: "approved", creator: "Taylor Smith" },
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: "act-7",
    userId: "staff-5",
    userType: "staff",
    userName: "James Wilson",
    action: "rejected_content",
    resourceType: "upload",
    resourceId: "upload-457",
    details: { reason: "quality_standards", creator: "Chris Brown" },
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
  },
  {
    id: "act-8",
    userId: "staff-3",
    userType: "staff",
    userName: "Emily Davis",
    action: "sent_message",
    resourceType: "message",
    resourceId: "msg-124",
    details: { recipient: "Jordan Lee", channel: "staff_creator" },
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
  },
];

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

function getActionIcon(action: string) {
  switch (action) {
    case "sent_message":
      return MessageSquare;
    case "logged_in":
      return LogIn;
    case "logged_out":
      return LogOut;
    case "approved_content":
    case "approved_request":
      return TrendingUp;
    case "rejected_content":
      return TrendingDown;
    case "resolved_request":
      return Activity;
    default:
      return Activity;
  }
}

function getActionLabel(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case "sent_message":
      return `Sent message to ${details.recipient || "someone"}`;
    case "logged_in":
      return `Logged in from ${details.location || "unknown location"}`;
    case "logged_out":
      return "Logged out";
    case "approved_content":
      return `Approved ${details.contentType || "content"} from ${details.creator || "creator"}`;
    case "rejected_content":
      return `Rejected content: ${details.reason || "unknown reason"}`;
    case "resolved_request":
      return `Resolved ${details.requestType || ""} request`;
    case "updated_creator_profile":
      return `Updated ${details.field || "profile"} for ${details.creator || "creator"}`;
    case "reviewed_contract":
      return `Reviewed contract for ${details.creator || "creator"} - ${details.status || "pending"}`;
    default:
      return action.replace(/_/g, " ");
  }
}

function getStatusColor(staff: StaffActivityMetrics): string {
  if (!staff.lastActivity) return "bg-gray-400";
  const diffMins = (Date.now() - staff.lastActivity.getTime()) / 60000;
  if (diffMins < 5) return "bg-green-500";
  if (diffMins < 30) return "bg-yellow-500";
  return "bg-gray-400";
}

export function StaffActivityMonitor() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"activity" | "response" | "name">(
    "activity"
  );
  const [filterRole, setFilterRole] = React.useState<string>("all");
  const [showAlertsOnly, setShowAlertsOnly] = React.useState(false);
  const [isLive, setIsLive] = React.useState(true);
  const [selectedStaff, setSelectedStaff] = React.useState<string | null>(null);

  // Get unique roles
  const roles = React.useMemo(() => {
    const roleSet = new Set(mockStaffMetrics.map((s) => s.role));
    return Array.from(roleSet);
  }, []);

  // Filter and sort staff
  const filteredStaff = React.useMemo(() => {
    let result = [...mockStaffMetrics];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.userName.toLowerCase().includes(query) ||
          s.role.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (filterRole !== "all") {
      result = result.filter((s) => s.role === filterRole);
    }

    // Filter alerts only
    if (showAlertsOnly) {
      result = result.filter((s) => s.hasUnusualActivity);
    }

    // Sort
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
  }, [searchQuery, filterRole, showAlertsOnly, sortBy]);

  // Filter activity feed for selected staff
  const filteredActivity = React.useMemo(() => {
    if (!selectedStaff) return mockActivityFeed;
    return mockActivityFeed.filter((a) => a.userId === selectedStaff);
  }, [selectedStaff]);

  // Calculate team averages
  const teamStats = React.useMemo(() => {
    const total = mockStaffMetrics.length;
    return {
      avgActionsToday: Math.round(
        mockStaffMetrics.reduce((sum, s) => sum + s.actionsToday, 0) / total
      ),
      avgResponseTime: Math.round(
        mockStaffMetrics.reduce((sum, s) => sum + s.averageResponseTime, 0) /
          total
      ),
      activeNow: mockStaffMetrics.filter(
        (s) =>
          s.lastActivity &&
          Date.now() - s.lastActivity.getTime() < 5 * 60 * 1000
      ).length,
      alertCount: mockStaffMetrics.filter((s) => s.hasUnusualActivity).length,
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Staff Activity Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of staff actions and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLive ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLive && "animate-spin")}
            />
            {isLive ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Now</p>
                <p className="text-2xl font-bold text-green-600">
                  {teamStats.activeNow}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              of {mockStaffMetrics.length} staff members
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
                <p className="text-2xl font-bold">
                  {teamStats.avgResponseTime}m
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-500" />
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
              <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[160px]">
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
              <div className="space-y-3">
                {filteredStaff.map((staff) => {
                  const maxActions = Math.max(
                    ...mockStaffMetrics.map((s) => s.actionsToday)
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
                            {staff.hasUnusualActivity && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
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
                            <Progress value={activityPercent} className="h-1.5" />
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

                          {/* Alerts */}
                          {staff.hasUnusualActivity &&
                            staff.unusualActivityReasons && (
                              <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                                  Unusual Activity Detected:
                                </p>
                                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                                  {staff.unusualActivityReasons.map(
                                    (reason, i) => (
                                      <li key={i}>- {reason}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {/* Last active */}
                          <p className="text-xs text-muted-foreground mt-3">
                            Last active:{" "}
                            {staff.lastActivity
                              ? formatTimeAgo(staff.lastActivity)
                              : "Unknown"}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Full Report
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              View Messages
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Calendar className="h-4 w-4 mr-2" />
                              Login History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Export Data
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Real-time Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-time Activity
              {isLive && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {selectedStaff
                ? `Activity for ${
                    mockStaffMetrics.find((s) => s.userId === selectedStaff)
                      ?.userName
                  }`
                : "All staff activity"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] -mx-4 px-4">
              <div className="space-y-4">
                {filteredActivity.map((activity) => {
                  const Icon = getActionIcon(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Avatar
                            size="xs"
                            user={{ name: activity.userName }}
                          />
                          <span className="font-medium text-sm truncate">
                            {activity.userName}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {getActionLabel(activity.action, activity.details)}
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
      </div>
    </div>
  );
}
