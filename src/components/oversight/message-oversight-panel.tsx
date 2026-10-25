"use client";

import * as React from "react";
import {
  Search,
  Filter,
  MessageSquare,
  Flag,
  ChevronRight,
  Users,
  User,
  X,
  Eye,
  ArrowUpDown,
  RefreshCw,
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
  type MessageOversight,
  type ConversationThread,
  type MessageFilter,
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [conversations, setConversations] = React.useState<MessageOversight[]>([]);

  const [filter, setFilter] = React.useState<MessageFilter>({
    conversationType: "all",
  });
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedConversation, setSelectedConversation] =
    React.useState<MessageOversight | null>(null);
  const [thread, setThread] = React.useState<ConversationThread | null>(null);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [showThread, setShowThread] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<"newest" | "oldest">(
    "newest"
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/oversight?type=messages");
      if (res.ok) {
        const data = await res.json();
        setConversations(
          (data.conversations || []).map((c: MessageOversight) => ({
            ...c,
            lastMessageAt: new Date(c.lastMessageAt),
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

  // Derive staff & creators for the filter dropdowns from real participants.
  const { staffList, creatorList } = React.useMemo(() => {
    const staff = new Map<string, string>();
    const creators = new Map<string, string>();
    for (const conv of conversations) {
      for (const p of conv.participants) {
        if (p.role === "Creator") creators.set(p.id, p.name);
        else staff.set(p.id, p.name);
      }
    }
    return {
      staffList: Array.from(staff, ([id, name]) => ({ id, name })),
      creatorList: Array.from(creators, ([id, name]) => ({ id, name })),
    };
  }, [conversations]);

  const filteredConversations = React.useMemo(() => {
    let result = [...conversations];

    if (filter.conversationType && filter.conversationType !== "all") {
      result = result.filter(
        (c) => c.conversationType === filter.conversationType
      );
    }
    if (filter.flagged !== undefined) {
      result = result.filter((c) => c.flagged === filter.flagged);
    }
    if (filter.staffId) {
      result = result.filter((c) =>
        c.participants.some((p) => p.id === filter.staffId)
      );
    }
    if (filter.creatorId) {
      result = result.filter((c) =>
        c.participants.some((p) => p.id === filter.creatorId)
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.preview?.toLowerCase().includes(query) ||
          c.participants.some((p) => p.name.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      const diff = b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      return sortOrder === "newest" ? diff : -diff;
    });

    return result;
  }, [conversations, filter, searchQuery, sortOrder]);

  const handleViewThread = async (conversation: MessageOversight) => {
    setSelectedConversation(conversation);
    setShowThread(true);
    setThread(null);
    setThreadLoading(true);
    try {
      const res = await fetch(
        `/api/oversight?type=thread&conversationId=${encodeURIComponent(
          conversation.id
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        const t: ConversationThread = data.thread;
        setThread({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          messages: t.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        });
      }
    } finally {
      setThreadLoading(false);
    }
  };

  const handleCloseThread = () => {
    setShowThread(false);
    setSelectedConversation(null);
    setThread(null);
  };

  const hasActiveFilters =
    filter.staffId ||
    filter.creatorId ||
    filter.flagged ||
    (filter.conversationType && filter.conversationType !== "all");

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
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card size="sm">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages, participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Select
                value={filter.conversationType || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    conversationType:
                      value as MessageFilter["conversationType"],
                  })
                }
              >
                <SelectTrigger aria-label="Filter by type" className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="staff_creator">Staff-Creator</SelectItem>
                  <SelectItem value="staff_staff">Internal (Staff)</SelectItem>
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
                <SelectTrigger aria-label="Filter by staff" className="w-[160px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffList.map((staff) => (
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
                <SelectTrigger aria-label="Filter by creator" className="w-[160px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Creators</SelectItem>
                  {creatorList.map((creator) => (
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

            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Active filters:
                </span>
                {filter.conversationType &&
                  filter.conversationType !== "all" && (
                    <Badge variant="secondary">
                      {filter.conversationType === "staff_creator"
                        ? "Staff-Creator"
                        : "Internal"}
                      <button aria-label="Remove conversation type filter"
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
                    Staff: {staffList.find((s) => s.id === filter.staffId)?.name}
                    <button aria-label="Remove staff filter"
                      onClick={() => setFilter({ ...filter, staffId: undefined })}
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filter.creatorId && (
                  <Badge variant="secondary">
                    Creator:{" "}
                    {creatorList.find((c) => c.id === filter.creatorId)?.name}
                    <button aria-label="Remove creator filter"
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
                    <button aria-label="Remove flagged filter"
                      onClick={() => setFilter({ ...filter, flagged: undefined })}
                      className="ml-1 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter({ conversationType: "all" })}
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
                    {isLoading
                      ? "Loading conversations..."
                      : "No conversations match your filters"}
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
                                : "secondary"
                            }
                          >
                            {conv.conversationType === "staff_creator"
                              ? "Staff-Creator"
                              : "Internal"}
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
                <Button aria-label="Close thread"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCloseThread}
                  className="lg:hidden"
                >
                  <X className="h-4 w-4" />
                </Button>
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
                {threadLoading ? (
                  <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                    Loading thread...
                  </div>
                ) : !thread || thread.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No messages in this conversation
                    </p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {thread.messages.map((message, index) => {
                      const isStaff = message.senderRole !== "Creator";
                      const showDate =
                        index === 0 ||
                        formatDate(message.timestamp) !==
                          formatDate(thread.messages[index - 1].timestamp);

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
                                <Badge
                                  variant="outline"
                                  className="text-[12px] h-5"
                                >
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
                )}
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
