"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Eye,
  Filter,
  Flag,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { type KeywordAlert, type UnusualActivityAlert } from "@/types/oversight";
import { cn } from "@/lib/utils";

// Mock keyword alerts data
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
      "I'm having a payment issue with the last invoice. The amount doesn't seem right and I need this resolved urgently.",
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
    recipientId: "staff-4",
    recipientName: "Lisa Wang",
    messagePreview:
      "We need to review the contract terms before sending to the creator. There are some clauses that need updating.",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: "new",
  },
  {
    id: "alert-3",
    keyword: "legal",
    messageId: "msg-3",
    conversationId: "conv-3",
    conversationType: "staff_creator",
    senderId: "creator-3",
    senderName: "Taylor Smith",
    senderRole: "Creator",
    recipientId: "staff-1",
    recipientName: "Sarah Johnson",
    messagePreview:
      "I wanted to ask about the legal implications of the new content policy changes.",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    status: "reviewed",
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    notes: "Standard policy question, no action needed.",
  },
  {
    id: "alert-4",
    keyword: "refund",
    messageId: "msg-4",
    conversationId: "conv-4",
    conversationType: "staff_creator",
    senderId: "creator-2",
    senderName: "Jordan Lee",
    senderRole: "Creator",
    recipientId: "staff-3",
    recipientName: "Emily Davis",
    messagePreview:
      "Can you process a refund for the cancelled campaign? We discussed this last week.",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    status: "escalated",
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    notes: "Escalated to finance team for processing.",
  },
  {
    id: "alert-5",
    keyword: "termination",
    messageId: "msg-5",
    conversationId: "conv-5",
    conversationType: "staff_staff",
    senderId: "staff-4",
    senderName: "Lisa Wang",
    senderRole: "Legal",
    recipientId: "staff-2",
    recipientName: "Mike Chen",
    messagePreview:
      "The termination clause in section 4.2 needs to be updated before the renewal.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "dismissed",
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
    notes: "False positive - discussing contract terminology, not actual termination.",
  },
];

// Mock unusual activity alerts
const mockActivityAlerts: UnusualActivityAlert[] = [
  {
    id: "act-alert-1",
    userId: "staff-5",
    userName: "James Wilson",
    userRole: "Content Reviewer",
    alertType: "high_volume",
    description: "Unusually high number of content approvals in short time",
    details: {
      actionsCount: 156,
      timeSpan: "2 hours",
      normalRange: "30-50 actions",
    },
    severity: "medium",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: "new",
  },
  {
    id: "act-alert-2",
    userId: "staff-3",
    userName: "Emily Davis",
    userRole: "Support Specialist",
    alertType: "off_hours",
    description: "Activity detected outside normal working hours",
    details: {
      activityTime: "2:34 AM",
      normalHours: "9 AM - 6 PM",
      actionsPerformed: ["Sent 12 messages", "Updated 3 creator profiles"],
    },
    severity: "low",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    status: "reviewed",
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    notes: "Staff confirmed working overtime to clear backlog.",
  },
  {
    id: "act-alert-3",
    userId: "staff-6",
    userName: "Unknown Device",
    userRole: "N/A",
    alertType: "failed_logins",
    description: "Multiple failed login attempts detected",
    details: {
      attempts: 5,
      ipAddress: "192.168.1.100",
      location: "Unknown",
    },
    severity: "high",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: "escalated",
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 30 * 60 * 1000),
    notes: "IP blocked. Security team notified.",
  },
];

// Configured keywords
const mockConfiguredKeywords = [
  { keyword: "payment issue", category: "Financial", priority: "high" },
  { keyword: "refund", category: "Financial", priority: "high" },
  { keyword: "contract", category: "Legal", priority: "medium" },
  { keyword: "legal", category: "Legal", priority: "medium" },
  { keyword: "termination", category: "Legal", priority: "high" },
  { keyword: "lawsuit", category: "Legal", priority: "high" },
  { keyword: "complaint", category: "Support", priority: "medium" },
  { keyword: "unhappy", category: "Support", priority: "low" },
  { keyword: "cancel", category: "Retention", priority: "medium" },
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

function getStatusColor(
  status: "new" | "reviewed" | "escalated" | "dismissed"
): string {
  switch (status) {
    case "new":
      return "bg-blue-500";
    case "reviewed":
      return "bg-green-500";
    case "escalated":
      return "bg-red-500";
    case "dismissed":
      return "bg-gray-500";
  }
}

function getSeverityColor(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "low":
      return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
    case "medium":
      return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    case "high":
      return "text-red-600 bg-red-100 dark:bg-red-900/30";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "text-red-600 bg-red-100 dark:bg-red-900/30";
    case "medium":
      return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    case "low":
      return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
    default:
      return "text-gray-600 bg-gray-100 dark:bg-gray-900/30";
  }
}

export function KeywordAlerts() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [alertType, setAlertType] = React.useState<"keyword" | "activity">(
    "keyword"
  );
  const [selectedAlert, setSelectedAlert] = React.useState<
    KeywordAlert | UnusualActivityAlert | null
  >(null);
  const [showKeywordConfig, setShowKeywordConfig] = React.useState(false);
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [showReviewDialog, setShowReviewDialog] = React.useState(false);
  const [reviewAction, setReviewAction] = React.useState<
    "dismiss" | "escalate" | "review"
  >("review");

  // Filter keyword alerts
  const filteredKeywordAlerts = React.useMemo(() => {
    let result = [...mockKeywordAlerts];

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.keyword.toLowerCase().includes(query) ||
          a.senderName.toLowerCase().includes(query) ||
          a.messagePreview.toLowerCase().includes(query)
      );
    }

    return result.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [statusFilter, searchQuery]);

  // Filter activity alerts
  const filteredActivityAlerts = React.useMemo(() => {
    let result = [...mockActivityAlerts];

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.userName.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
      );
    }

    return result.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [statusFilter, searchQuery]);

  // Count stats
  const stats = React.useMemo(
    () => ({
      newKeyword: mockKeywordAlerts.filter((a) => a.status === "new").length,
      newActivity: mockActivityAlerts.filter((a) => a.status === "new").length,
      escalated:
        mockKeywordAlerts.filter((a) => a.status === "escalated").length +
        mockActivityAlerts.filter((a) => a.status === "escalated").length,
      totalKeywords: mockConfiguredKeywords.length,
    }),
    []
  );

  const handleReview = (
    action: "dismiss" | "escalate" | "review",
    alert: KeywordAlert | UnusualActivityAlert
  ) => {
    setSelectedAlert(alert);
    setReviewAction(action);
    setShowReviewDialog(true);
  };

  const handleSubmitReview = () => {
    // Placeholder for API call
    console.log("Review submitted:", {
      alertId: selectedAlert?.id,
      action: reviewAction,
      notes: reviewNotes,
    });
    setShowReviewDialog(false);
    setReviewNotes("");
    setSelectedAlert(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Keyword & Activity Alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor sensitive content and unusual activity patterns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowKeywordConfig(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure Keywords
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">New Keyword</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.newKeyword > 0 && "text-blue-600"
                  )}
                >
                  {stats.newKeyword}
                </p>
              </div>
              <Bell className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">New Activity</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.newActivity > 0 && "text-amber-600"
                  )}
                >
                  {stats.newActivity}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Escalated</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.escalated > 0 && "text-red-600"
                  )}
                >
                  {stats.escalated}
                </p>
              </div>
              <Flag className="h-8 w-8 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Keywords</p>
                <p className="text-2xl font-bold">{stats.totalKeywords}</p>
              </div>
              <Search className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Type Tabs */}
      <div className="flex gap-2">
        <Button
          variant={alertType === "keyword" ? "default" : "outline"}
          onClick={() => setAlertType("keyword")}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Keyword Alerts
          {stats.newKeyword > 0 && (
            <Badge variant="secondary" className="ml-2">
              {stats.newKeyword}
            </Badge>
          )}
        </Button>
        <Button
          variant={alertType === "activity" ? "default" : "outline"}
          onClick={() => setAlertType("activity")}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Activity Alerts
          {stats.newActivity > 0 && (
            <Badge variant="secondary" className="ml-2">
              {stats.newActivity}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  alertType === "keyword"
                    ? "Search keywords, senders, content..."
                    : "Search users, descriptions..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {alertType === "keyword" ? "Keyword Alerts" : "Activity Alerts"}
          </CardTitle>
          <CardDescription>
            {alertType === "keyword"
              ? `${filteredKeywordAlerts.length} alerts`
              : `${filteredActivityAlerts.length} alerts`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] -mx-4 px-4">
            {alertType === "keyword" ? (
              <div className="space-y-3">
                {filteredKeywordAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No keyword alerts match your filters
                    </p>
                  </div>
                ) : (
                  filteredKeywordAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full mt-2 shrink-0",
                              getStatusColor(alert.status)
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="destructive">{alert.keyword}</Badge>
                              <Badge variant="outline">
                                {alert.conversationType === "staff_creator"
                                  ? "Staff-Creator"
                                  : "Internal"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "capitalize",
                                  alert.status === "new" && "text-blue-600",
                                  alert.status === "escalated" && "text-red-600",
                                  alert.status === "dismissed" &&
                                    "text-gray-500"
                                )}
                              >
                                {alert.status}
                              </Badge>
                            </div>

                            <p className="text-sm mt-2 line-clamp-2">
                              {alert.messagePreview}
                            </p>

                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Avatar
                                  size="xs"
                                  user={{ name: alert.senderName }}
                                />
                                <span>{alert.senderName}</span>
                                <span className="text-muted-foreground">
                                  ({alert.senderRole})
                                </span>
                              </div>
                              {alert.recipientName && (
                                <>
                                  <ChevronRight className="h-3 w-3" />
                                  <span>{alert.recipientName}</span>
                                </>
                              )}
                              <span className="ml-auto">
                                {formatTimeAgo(alert.timestamp)}
                              </span>
                            </div>

                            {alert.notes && (
                              <div className="mt-3 p-2 rounded bg-muted text-sm">
                                <span className="font-medium">Note:</span>{" "}
                                {alert.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleReview("review", alert)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Mark as Reviewed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleReview("escalate", alert)}
                            >
                              <Flag className="h-4 w-4 mr-2" />
                              Escalate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleReview("dismiss", alert)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivityAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No activity alerts match your filters
                    </p>
                  </div>
                ) : (
                  filteredActivityAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full mt-2 shrink-0",
                              getStatusColor(alert.status)
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                className={getSeverityColor(alert.severity)}
                              >
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {alert.alertType.replace(/_/g, " ")}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "capitalize",
                                  alert.status === "new" && "text-blue-600",
                                  alert.status === "escalated" && "text-red-600",
                                  alert.status === "dismissed" &&
                                    "text-gray-500"
                                )}
                              >
                                {alert.status}
                              </Badge>
                            </div>

                            <p className="text-sm font-medium mt-2">
                              {alert.description}
                            </p>

                            <div className="flex items-center gap-2 mt-2">
                              <Avatar
                                size="xs"
                                user={{ name: alert.userName }}
                              />
                              <span className="text-sm">{alert.userName}</span>
                              <span className="text-xs text-muted-foreground">
                                ({alert.userRole})
                              </span>
                            </div>

                            <div className="mt-3 p-2 rounded bg-muted/50 text-xs">
                              {Object.entries(alert.details).map(
                                ([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="text-muted-foreground capitalize">
                                      {key.replace(/_/g, " ")}:
                                    </span>
                                    <span>
                                      {Array.isArray(value)
                                        ? value.join(", ")
                                        : String(value)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                              <span>{formatTimeAgo(alert.timestamp)}</span>
                              {alert.reviewedBy && (
                                <span>
                                  Reviewed by {alert.reviewedBy}{" "}
                                  {alert.reviewedAt &&
                                    formatTimeAgo(alert.reviewedAt)}
                                </span>
                              )}
                            </div>

                            {alert.notes && (
                              <div className="mt-3 p-2 rounded bg-muted text-sm">
                                <span className="font-medium">Note:</span>{" "}
                                {alert.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleReview("review", alert)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Mark as Reviewed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleReview("escalate", alert)}
                            >
                              <Flag className="h-4 w-4 mr-2" />
                              Escalate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleReview("dismiss", alert)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Keyword Configuration Dialog */}
      <Dialog open={showKeywordConfig} onOpenChange={setShowKeywordConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Keywords</DialogTitle>
            <DialogDescription>
              Manage the keywords that trigger alerts when detected in messages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new keyword */}
            <div className="flex gap-2">
              <Input placeholder="Enter new keyword..." className="flex-1" />
              <Select defaultValue="medium">
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Keyword list */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {mockConfiguredKeywords.map((kw, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{kw.keyword}</Badge>
                      <Badge variant="secondary">{kw.category}</Badge>
                      <Badge className={getPriorityColor(kw.priority)}>
                        {kw.priority}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon-sm">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeywordConfig(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowKeywordConfig(false)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "dismiss"
                ? "Dismiss Alert"
                : reviewAction === "escalate"
                ? "Escalate Alert"
                : "Mark as Reviewed"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "dismiss"
                ? "This alert will be marked as dismissed. Add an optional note explaining why."
                : reviewAction === "escalate"
                ? "This alert will be escalated for further review. Add details about why it needs attention."
                : "Mark this alert as reviewed. Add any notes about your findings."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="review-notes">Notes (optional)</Label>
              <Textarea
                id="review-notes"
                placeholder="Add notes about this alert..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === "escalate" ? "destructive" : "default"}
              onClick={handleSubmitReview}
            >
              {reviewAction === "dismiss" && (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Dismiss
                </>
              )}
              {reviewAction === "escalate" && (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Escalate
                </>
              )}
              {reviewAction === "review" && (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Mark Reviewed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
