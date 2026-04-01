"use client";

import * as React from "react";
import {
  Search,
  MessageSquare,
  Clock,
  User,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  MoreVertical,
  Download,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  Flag,
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
  type CreatorCommunicationSummary,
  type ThreadMessage,
} from "@/types/oversight";
import { cn } from "@/lib/utils";

// Mock creator communication data
const mockCreatorComms: CreatorCommunicationSummary[] = [
  {
    creatorId: "creator-1",
    creatorName: "Alex Rivera",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "staff-3", name: "Emily Davis", role: "Support Specialist" },
    ],
    totalMessages: 245,
    messagesThisWeek: 34,
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    averageResponseTime: 15,
    pendingRequests: 2,
    flagged: true,
    flagReasons: ["Payment discussion flagged"],
  },
  {
    creatorId: "creator-2",
    creatorName: "Jordan Lee",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-3", name: "Emily Davis", role: "Support Specialist" },
    ],
    totalMessages: 156,
    messagesThisWeek: 18,
    lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    averageResponseTime: 8,
    pendingRequests: 0,
    flagged: false,
  },
  {
    creatorId: "creator-3",
    creatorName: "Taylor Smith",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
    ],
    totalMessages: 389,
    messagesThisWeek: 45,
    lastMessageAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    averageResponseTime: 22,
    pendingRequests: 1,
    flagged: false,
  },
  {
    creatorId: "creator-4",
    creatorName: "Chris Brown",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-5", name: "James Wilson", role: "Content Reviewer" },
    ],
    totalMessages: 78,
    messagesThisWeek: 12,
    lastMessageAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    averageResponseTime: 35,
    pendingRequests: 3,
    flagged: true,
    flagReasons: ["Slow response time", "Multiple pending requests"],
  },
  {
    creatorId: "creator-5",
    creatorName: "Morgan Davis",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
    ],
    totalMessages: 234,
    messagesThisWeek: 28,
    lastMessageAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    averageResponseTime: 12,
    pendingRequests: 0,
    flagged: false,
  },
  {
    creatorId: "creator-6",
    creatorName: "Casey Williams",
    creatorAvatar: undefined,
    assignedStaff: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "staff-3", name: "Emily Davis", role: "Support Specialist" },
      { id: "staff-5", name: "James Wilson", role: "Content Reviewer" },
    ],
    totalMessages: 567,
    messagesThisWeek: 67,
    lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
    averageResponseTime: 10,
    pendingRequests: 1,
    flagged: false,
  },
];

// Mock message history
const mockMessageHistory: ThreadMessage[] = [
  {
    id: "msg-1",
    senderId: "creator-1",
    senderName: "Alex Rivera",
    senderRole: "Creator",
    content:
      "Hi, I wanted to check on the status of my latest content submission.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "msg-2",
    senderId: "staff-1",
    senderName: "Sarah Johnson",
    senderRole: "Account Manager",
    content:
      "Hi Alex! Your submission is currently under review. We should have an update within 24 hours.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
  },
  {
    id: "msg-3",
    senderId: "creator-1",
    senderName: "Alex Rivera",
    senderRole: "Creator",
    content: "Perfect, thank you for the quick response!",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
  },
  {
    id: "msg-4",
    senderId: "staff-3",
    senderName: "Emily Davis",
    senderRole: "Support Specialist",
    content:
      "Hi Alex, I wanted to follow up - your content has been approved and is now live!",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "msg-5",
    senderId: "creator-1",
    senderName: "Alex Rivera",
    senderRole: "Creator",
    content:
      "That's great news! I do have a question about the payment - it doesn't seem to match what we agreed on.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "msg-6",
    senderId: "staff-1",
    senderName: "Sarah Johnson",
    senderRole: "Account Manager",
    content:
      "Let me look into that right away. Can you share the invoice number?",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
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

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getResponseTimeStatus(avgTime: number): {
  label: string;
  color: string;
  icon: React.ElementType;
} {
  if (avgTime <= 15) {
    return { label: "Excellent", color: "text-green-600", icon: CheckCircle };
  }
  if (avgTime <= 30) {
    return { label: "Good", color: "text-blue-600", icon: TrendingUp };
  }
  if (avgTime <= 60) {
    return { label: "Moderate", color: "text-amber-600", icon: TrendingDown };
  }
  return { label: "Needs Attention", color: "text-red-600", icon: AlertCircle };
}

export function CreatorCommunicationLog() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<
    "recent" | "messages" | "response" | "name"
  >("recent");
  const [filterStaff, setFilterStaff] = React.useState<string>("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = React.useState(false);
  const [selectedCreator, setSelectedCreator] =
    React.useState<CreatorCommunicationSummary | null>(null);

  // Get unique staff from all creators
  const allStaff = React.useMemo(() => {
    const staffMap = new Map<string, { id: string; name: string }>();
    mockCreatorComms.forEach((creator) => {
      creator.assignedStaff.forEach((staff) => {
        staffMap.set(staff.id, { id: staff.id, name: staff.name });
      });
    });
    return Array.from(staffMap.values());
  }, []);

  // Filter and sort creators
  const filteredCreators = React.useMemo(() => {
    let result = [...mockCreatorComms];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.creatorName.toLowerCase().includes(query) ||
          c.assignedStaff.some((s) => s.name.toLowerCase().includes(query))
      );
    }

    // Filter by assigned staff
    if (filterStaff !== "all") {
      result = result.filter((c) =>
        c.assignedStaff.some((s) => s.id === filterStaff)
      );
    }

    // Filter flagged only
    if (showFlaggedOnly) {
      result = result.filter((c) => c.flagged);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (
            (b.lastMessageAt?.getTime() || 0) -
            (a.lastMessageAt?.getTime() || 0)
          );
        case "messages":
          return b.totalMessages - a.totalMessages;
        case "response":
          return a.averageResponseTime - b.averageResponseTime;
        case "name":
          return a.creatorName.localeCompare(b.creatorName);
        default:
          return 0;
      }
    });

    return result;
  }, [searchQuery, filterStaff, showFlaggedOnly, sortBy]);

  // Calculate summary stats
  const summaryStats = React.useMemo(() => {
    const total = mockCreatorComms.length;
    return {
      totalCreators: total,
      totalMessages: mockCreatorComms.reduce((sum, c) => sum + c.totalMessages, 0),
      messagesThisWeek: mockCreatorComms.reduce(
        (sum, c) => sum + c.messagesThisWeek,
        0
      ),
      avgResponseTime: Math.round(
        mockCreatorComms.reduce((sum, c) => sum + c.averageResponseTime, 0) /
          total
      ),
      pendingRequests: mockCreatorComms.reduce(
        (sum, c) => sum + c.pendingRequests,
        0
      ),
      flaggedCount: mockCreatorComms.filter((c) => c.flagged).length,
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Creator Communication Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track all communications with creators and response metrics
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Creators</p>
            <p className="text-2xl font-bold">{summaryStats.totalCreators}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Messages This Week</p>
            <p className="text-2xl font-bold">{summaryStats.messagesThisWeek}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
            <p className="text-2xl font-bold">{summaryStats.avgResponseTime}m</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pending Requests</p>
            <p
              className={cn(
                "text-2xl font-bold",
                summaryStats.pendingRequests > 0 && "text-amber-600"
              )}
            >
              {summaryStats.pendingRequests}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Flagged</p>
            <p
              className={cn(
                "text-2xl font-bold",
                summaryStats.flaggedCount > 0 && "text-red-600"
              )}
            >
              {summaryStats.flaggedCount}
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
                placeholder="Search creators or staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStaff} onValueChange={setFilterStaff}>
              <SelectTrigger className="w-[180px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Assigned Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {allStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) =>
                setSortBy(v as "recent" | "messages" | "response" | "name")
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="messages">Most Messages</SelectItem>
                <SelectItem value="response">Best Response</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showFlaggedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
              className="h-10"
            >
              <Flag className="h-4 w-4 mr-2" />
              Flagged Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Creator List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Creators
            </CardTitle>
            <CardDescription>
              {filteredCreators.length} creator
              {filteredCreators.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[550px] -mx-4 px-4">
              <div className="space-y-3">
                {filteredCreators.map((creator) => {
                  const responseStatus = getResponseTimeStatus(
                    creator.averageResponseTime
                  );
                  const ResponseIcon = responseStatus.icon;

                  return (
                    <div
                      key={creator.creatorId}
                      className={cn(
                        "p-4 rounded-lg border transition-colors cursor-pointer",
                        selectedCreator?.creatorId === creator.creatorId
                          ? "bg-muted border-primary"
                          : "bg-card hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedCreator(creator)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          size="md"
                          user={{ name: creator.creatorName }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {creator.creatorName}
                            </span>
                            {creator.flagged && (
                              <Flag className="h-4 w-4 text-red-500 shrink-0" />
                            )}
                            {creator.pendingRequests > 0 && (
                              <Badge variant="secondary">
                                {creator.pendingRequests} pending
                              </Badge>
                            )}
                          </div>

                          {/* Assigned staff */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Assigned:
                            </span>
                            <div className="flex -space-x-1">
                              {creator.assignedStaff.slice(0, 3).map((staff) => (
                                <Avatar
                                  key={staff.id}
                                  size="xs"
                                  user={{ name: staff.name }}
                                  ring="white"
                                />
                              ))}
                            </div>
                            {creator.assignedStaff.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{creator.assignedStaff.length - 3}
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                Messages
                              </p>
                              <p className="text-sm font-medium">
                                {creator.totalMessages}
                              </p>
                            </div>
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                This Week
                              </p>
                              <p className="text-sm font-medium">
                                {creator.messagesThisWeek}
                              </p>
                            </div>
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                Response
                              </p>
                              <p
                                className={cn(
                                  "text-sm font-medium flex items-center justify-center gap-1",
                                  responseStatus.color
                                )}
                              >
                                <ResponseIcon className="h-3 w-3" />
                                {creator.averageResponseTime}m
                              </p>
                            </div>
                          </div>

                          {/* Flags */}
                          {creator.flagged && creator.flagReasons && (
                            <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                              <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                {creator.flagReasons.map((reason, i) => (
                                  <li key={i} className="flex items-center gap-1">
                                    <Flag className="h-3 w-3" />
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Last message */}
                          <p className="text-xs text-muted-foreground mt-3">
                            Last message:{" "}
                            {creator.lastMessageAt
                              ? formatTimeAgo(creator.lastMessageAt)
                              : "No messages"}
                          </p>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message History / Creator Detail */}
        {selectedCreator ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="lg"
                    user={{ name: selectedCreator.creatorName }}
                  />
                  <div>
                    <CardTitle className="text-base">
                      {selectedCreator.creatorName}
                    </CardTitle>
                    <CardDescription>
                      {selectedCreator.totalMessages} total messages
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Mail className="h-4 w-4 mr-2" />
                      Email Creator
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Phone className="h-4 w-4 mr-2" />
                      Call Creator
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Calendar className="h-4 w-4 mr-2" />
                      View Full History
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Export Messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Assigned Staff */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Assigned Staff</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCreator.assignedStaff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted"
                    >
                      <Avatar size="xs" user={{ name: staff.name }} />
                      <span className="text-sm">{staff.name}</span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {staff.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Metrics */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      getResponseTimeStatus(selectedCreator.averageResponseTime)
                        .color
                    )}
                  >
                    {selectedCreator.averageResponseTime}m
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">This Week</p>
                  <p className="text-lg font-bold">
                    {selectedCreator.messagesThisWeek}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      selectedCreator.pendingRequests > 0 && "text-amber-600"
                    )}
                  >
                    {selectedCreator.pendingRequests}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="p-3 border-b bg-muted/30">
                <p className="text-sm font-medium">Recent Messages</p>
              </div>
              <ScrollArea className="h-[320px]">
                <div className="p-4 space-y-4">
                  {mockMessageHistory.map((message, index) => {
                    const isStaff = message.senderRole !== "Creator";
                    const showDate =
                      index === 0 ||
                      formatDate(message.timestamp) !==
                        formatDate(mockMessageHistory[index - 1].timestamp);

                    return (
                      <React.Fragment key={message.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.timestamp)}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex gap-3",
                            isStaff ? "flex-row" : "flex-row-reverse"
                          )}
                        >
                          <Avatar size="sm" user={{ name: message.senderName }} />
                          <div
                            className={cn(
                              "flex-1 max-w-[80%]",
                              isStaff ? "" : "flex flex-col items-end"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {message.senderName}
                              </span>
                              <Badge variant="outline" className="text-[10px] h-4">
                                {message.senderRole}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "rounded-lg p-3 text-sm",
                                isStaff
                                  ? "bg-muted"
                                  : "bg-primary text-primary-foreground"
                              )}
                            >
                              {message.content}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex items-center justify-center">
            <div className="text-center py-20">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a creator to view communication history
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
