"use client";

import * as React from "react";
import {
  Search,
  Filter,
  MessageSquare,
  Flag,
  Download,
  ChevronRight,
  Users,
  User,
  X,
  Eye,
  MoreVertical,
  Calendar,
  ArrowUpDown,
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
  type MessageOversight,
  type ConversationThread,
  type ThreadMessage,
  type MessageFilter,
} from "@/types/oversight";
import { cn } from "@/lib/utils";

// Mock data for conversations
const mockConversations: MessageOversight[] = [
  {
    id: "conv-1",
    conversationType: "staff_creator",
    participants: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "creator-1", name: "Alex Rivera", role: "Creator" },
    ],
    messageCount: 45,
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000),
    flagged: true,
    flagReason: "Contains sensitive keyword: 'payment issue'",
    preview: "I'll look into the payment issue right away...",
  },
  {
    id: "conv-2",
    conversationType: "staff_staff",
    participants: [
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
      { id: "staff-4", name: "Lisa Wang", role: "Legal" },
    ],
    messageCount: 12,
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    flagged: true,
    flagReason: "Contains sensitive keyword: 'contract'",
    preview: "The contract needs to be reviewed before...",
  },
  {
    id: "conv-3",
    conversationType: "staff_creator",
    participants: [
      { id: "staff-3", name: "Emily Davis", role: "Support Specialist" },
      { id: "creator-2", name: "Jordan Lee", role: "Creator" },
    ],
    messageCount: 28,
    lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    flagged: false,
    preview: "Your content has been approved and is live!",
  },
  {
    id: "conv-4",
    conversationType: "staff_creator",
    participants: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "creator-3", name: "Taylor Smith", role: "Creator" },
    ],
    messageCount: 67,
    lastMessageAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    flagged: false,
    preview: "Great work on the last campaign!",
  },
  {
    id: "conv-5",
    conversationType: "staff_staff",
    participants: [
      { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
      { id: "staff-3", name: "Emily Davis", role: "Support Specialist" },
    ],
    messageCount: 89,
    lastMessageAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    flagged: false,
    preview: "Team meeting notes from today...",
  },
  {
    id: "conv-6",
    conversationType: "internal_note",
    participants: [
      { id: "staff-2", name: "Mike Chen", role: "Account Manager" },
    ],
    messageCount: 5,
    lastMessageAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    flagged: false,
    preview: "Internal note about creator onboarding process...",
  },
];

// Mock thread data
const mockThread: ConversationThread = {
  id: "conv-1",
  type: "staff_creator",
  participants: [
    { id: "staff-1", name: "Sarah Johnson", role: "Account Manager" },
    { id: "creator-1", name: "Alex Rivera", role: "Creator" },
  ],
  messages: [
    {
      id: "msg-1",
      senderId: "creator-1",
      senderName: "Alex Rivera",
      senderRole: "Creator",
      content: "Hi Sarah, I'm having a payment issue with the last invoice. The amount doesn't match what we agreed upon.",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      id: "msg-2",
      senderId: "staff-1",
      senderName: "Sarah Johnson",
      senderRole: "Account Manager",
      content: "Hi Alex, I'm sorry to hear that. Let me look into this right away. Can you tell me the invoice number?",
      timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    },
    {
      id: "msg-3",
      senderId: "creator-1",
      senderName: "Alex Rivera",
      senderRole: "Creator",
      content: "Sure, it's INV-2024-0342. The invoice shows $1,500 but we agreed on $2,000 for the campaign.",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: "msg-4",
      senderId: "staff-1",
      senderName: "Sarah Johnson",
      senderRole: "Account Manager",
      content: "I found the discrepancy. It looks like the bonus wasn't included. I'll get this corrected and send you an updated invoice today.",
      timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    },
    {
      id: "msg-5",
      senderId: "creator-1",
      senderName: "Alex Rivera",
      senderRole: "Creator",
      content: "Thank you so much for the quick response! I really appreciate it.",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
    {
      id: "msg-6",
      senderId: "staff-1",
      senderName: "Sarah Johnson",
      senderRole: "Account Manager",
      content: "No problem at all! The corrected invoice has been sent. Please let me know if you have any other questions.",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
    },
  ],
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  updatedAt: new Date(Date.now() - 30 * 60 * 1000),
};

// Mock staff and creators for filters
const mockStaff = [
  { id: "staff-1", name: "Sarah Johnson" },
  { id: "staff-2", name: "Mike Chen" },
  { id: "staff-3", name: "Emily Davis" },
  { id: "staff-4", name: "Lisa Wang" },
];

const mockCreators = [
  { id: "creator-1", name: "Alex Rivera" },
  { id: "creator-2", name: "Jordan Lee" },
  { id: "creator-3", name: "Taylor Smith" },
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MessageOversightPanel() {
  const [filter, setFilter] = React.useState<MessageFilter>({
    conversationType: "all",
  });
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedConversation, setSelectedConversation] =
    React.useState<MessageOversight | null>(null);
  const [showThread, setShowThread] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<"newest" | "oldest">(
    "newest"
  );

  // Filter conversations based on current filters
  const filteredConversations = React.useMemo(() => {
    let result = [...mockConversations];

    // Filter by type
    if (filter.conversationType && filter.conversationType !== "all") {
      result = result.filter(
        (c) => c.conversationType === filter.conversationType
      );
    }

    // Filter by flagged
    if (filter.flagged !== undefined) {
      result = result.filter((c) => c.flagged === filter.flagged);
    }

    // Filter by staff
    if (filter.staffId) {
      result = result.filter((c) =>
        c.participants.some((p) => p.id === filter.staffId)
      );
    }

    // Filter by creator
    if (filter.creatorId) {
      result = result.filter((c) =>
        c.participants.some((p) => p.id === filter.creatorId)
      );
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.preview?.toLowerCase().includes(query) ||
          c.participants.some((p) => p.name.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      const diff = b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      return sortOrder === "newest" ? diff : -diff;
    });

    return result;
  }, [filter, searchQuery, sortOrder]);

  const handleViewThread = (conversation: MessageOversight) => {
    setSelectedConversation(conversation);
    setShowThread(true);
  };

  const handleCloseThread = () => {
    setShowThread(false);
    setSelectedConversation(null);
  };

  const handleExport = () => {
    // Placeholder for export functionality
    console.log("Exporting conversations...");
  };

  const handleFlagConversation = (conversationId: string) => {
    console.log("Flagging conversation:", conversationId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Message Oversight
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and monitor all staff-creator and internal communications
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages, participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-3">
              <Select
                value={filter.conversationType || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    conversationType: value as MessageFilter["conversationType"],
                  })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="staff_creator">Staff-Creator</SelectItem>
                  <SelectItem value="staff_staff">Internal (Staff)</SelectItem>
                  <SelectItem value="internal_note">Internal Notes</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.staffId || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    staffId: value === "all" ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {mockStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filter.creatorId || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    creatorId: value === "all" ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Creators</SelectItem>
                  {mockCreators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.id}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={filter.flagged ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setFilter({
                    ...filter,
                    flagged: filter.flagged ? undefined : true,
                  })
                }
                className="h-10"
              >
                <Flag className="h-4 w-4 mr-2" />
                Flagged Only
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder(sortOrder === "newest" ? "oldest" : "newest")
                }
                className="h-10 ml-auto"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortOrder === "newest" ? "Newest First" : "Oldest First"}
              </Button>
            </div>

            {/* Active filters */}
            {(filter.staffId ||
              filter.creatorId ||
              filter.flagged ||
              (filter.conversationType && filter.conversationType !== "all")) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Active filters:
                </span>
                {filter.conversationType && filter.conversationType !== "all" && (
                  <Badge variant="secondary">
                    {filter.conversationType === "staff_creator"
                      ? "Staff-Creator"
                      : filter.conversationType === "staff_staff"
                      ? "Internal"
                      : "Notes"}
                    <button
                      onClick={() =>
                        setFilter({ ...filter, conversationType: "all" })
                      }
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filter.staffId && (
                  <Badge variant="secondary">
                    Staff:{" "}
                    {mockStaff.find((s) => s.id === filter.staffId)?.name}
                    <button
                      onClick={() =>
                        setFilter({ ...filter, staffId: undefined })
                      }
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filter.creatorId && (
                  <Badge variant="secondary">
                    Creator:{" "}
                    {mockCreators.find((c) => c.id === filter.creatorId)?.name}
                    <button
                      onClick={() =>
                        setFilter({ ...filter, creatorId: undefined })
                      }
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filter.flagged && (
                  <Badge variant="secondary">
                    Flagged
                    <button
                      onClick={() =>
                        setFilter({ ...filter, flagged: undefined })
                      }
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilter({ conversationType: "all" })
                  }
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredConversations.length} conversation
          {filteredConversations.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Conversation list / Thread view */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversation list */}
        <Card className={cn(showThread && "hidden lg:block")}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] -mx-4 px-4">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No conversations match your filters
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedConversation?.id === conv.id
                          ? "bg-muted border-primary"
                          : "bg-card hover:bg-muted/50"
                      )}
                      onClick={() => handleViewThread(conv)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              conv.conversationType === "staff_creator"
                                ? "default"
                                : conv.conversationType === "staff_staff"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {conv.conversationType === "staff_creator"
                              ? "Staff-Creator"
                              : conv.conversationType === "staff_staff"
                              ? "Internal"
                              : "Note"}
                          </Badge>
                          {conv.flagged && (
                            <Flag className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(conv.lastMessageAt)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        {conv.participants.slice(0, 3).map((p, i) => (
                          <Avatar
                            key={p.id}
                            size="xs"
                            user={{ name: p.name }}
                            className={cn(i > 0 && "-ml-2")}
                            ring={i > 0 ? "white" : "none"}
                          />
                        ))}
                        {conv.participants.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{conv.participants.length - 3}
                          </span>
                        )}
                        <span className="text-sm truncate">
                          {conv.participants.map((p) => p.name).join(", ")}
                        </span>
                      </div>

                      {conv.preview && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                          {conv.preview}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {conv.messageCount} messages
                        </span>
                        {conv.flagReason && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 truncate">
                            {conv.flagReason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Thread view */}
        {showThread && selectedConversation ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Thread View
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {selectedConversation.participants
                      .map((p) => p.name)
                      .join(", ")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          handleFlagConversation(selectedConversation.id)
                        }
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        {selectedConversation.flagged
                          ? "Remove Flag"
                          : "Flag Conversation"}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Export Thread
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Calendar className="h-4 w-4 mr-2" />
                        View Full History
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCloseThread}
                    className="lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {selectedConversation.flagged && (
                <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    {selectedConversation.flagReason}
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[450px]">
                <div className="p-4 space-y-4">
                  {mockThread.messages.map((message, index) => {
                    const isStaff = message.senderRole !== "Creator";
                    const showDate =
                      index === 0 ||
                      formatDate(message.timestamp) !==
                        formatDate(mockThread.messages[index - 1].timestamp);

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
                          <Avatar
                            size="sm"
                            user={{ name: message.senderName }}
                          />
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
          <Card className="hidden lg:flex items-center justify-center">
            <div className="text-center py-20">
              <Eye className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a conversation to view the thread
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
