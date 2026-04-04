"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, Users, X, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { ChatSidebar, ConversationListSkeleton } from "@/components/chat/chat-sidebar";
import { ChatWindow, ChatWindowSkeleton } from "@/components/chat/chat-window";
import type { ConversationWithDetails, MessageWithSender } from "@/lib/chat-types";

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [conversations, setConversations] = React.useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = React.useState<MessageWithSender[]>([]);
  const [selectedConversation, setSelectedConversation] = React.useState<ConversationWithDetails | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false);
  const [messageCursor, setMessageCursor] = React.useState<string | null>(null);
  const [showNewConversationDialog, setShowNewConversationDialog] = React.useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);
  const [inboxType, setInboxType] = React.useState<"all" | "team" | "creator">("all");
  const [unreadCounts, setUnreadCounts] = React.useState<{ team: number; creator: number }>({ team: 0, creator: 0 });

  const currentUserId = session?.user?.id || "";
  const selectedConversationId = searchParams.get("conversation");

  // Fetch conversations using the unified inbox API
  const fetchConversations = React.useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const typeParam = inboxType === "all" ? "" : `?type=${inboxType}`;
      const response = await fetch(`/api/inbox${typeParam}`);
      if (response.ok) {
        const data = await response.json();
        // Transform inbox API response to match existing conversation type
        const transformedConversations = (data.conversations || []).map((conv: {
          id: string;
          type: string;
          name: string;
          creator?: { id: string; name: string; email: string; avatar?: string };
          request?: { id: string; title: string; status: string };
          participants: { id: string; name: string; email: string; avatar?: string }[];
          lastMessage?: { id: string; content: string; createdAt: string; isFromCreator: boolean };
          lastMessageAt: string;
          hasUnread: boolean;
        }) => ({
          id: conv.id,
          type: conv.type,
          name: conv.name,
          requestId: conv.request?.id || null,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : null,
          createdAt: new Date(),
          participants: conv.participants.map((p) => ({
            id: p.id,
            userId: p.id,
            joinedAt: new Date(),
            user: {
              id: p.id,
              name: p.name,
              email: p.email,
              avatar: p.avatar || null,
              lastActiveAt: null,
            },
          })),
          // Add creator as a pseudo-participant for CREATOR type conversations
          ...(conv.type === "CREATOR" && conv.creator ? {
            participants: [{
              id: conv.creator.id,
              userId: conv.creator.id,
              joinedAt: new Date(),
              user: {
                id: conv.creator.id,
                name: conv.creator.name,
                email: conv.creator.email,
                avatar: conv.creator.avatar || null,
                lastActiveAt: null,
              },
            }],
          } : {}),
          messages: conv.lastMessage ? [{
            id: conv.lastMessage.id,
            content: conv.lastMessage.content,
            senderId: conv.lastMessage.isFromCreator ? "creator" : "team",
            createdAt: new Date(conv.lastMessage.createdAt),
            sender: { id: "sender", name: conv.name },
          }] : [],
          _count: { messages: 0 },
          unreadCount: conv.hasUnread ? 1 : 0,
        }));
        setConversations(transformedConversations);

        // Count unreads by type
        const teamUnread = (data.conversations || []).filter(
          (c: { type: string; hasUnread: boolean }) => c.type !== "CREATOR" && c.hasUnread
        ).length;
        const creatorUnread = (data.conversations || []).filter(
          (c: { type: string; hasUnread: boolean }) => c.type === "CREATOR" && c.hasUnread
        ).length;
        setUnreadCounts({ team: teamUnread, creator: creatorUnread });
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [inboxType]);

  // Fetch messages for a conversation using unified inbox API
  const fetchMessages = React.useCallback(async (conversationId: string, before?: string) => {
    try {
      setIsLoadingMessages(true);
      const params = new URLSearchParams({ limit: "50" });
      if (before) {
        params.set("before", before);
      }

      const response = await fetch(`/api/inbox/${conversationId}?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Transform inbox API messages to match existing message type
        const transformedMessages = (data.messages || []).map((msg: {
          id: string;
          content: string;
          sender?: { id: string; name: string; email: string; avatar?: string };
          creator?: { id: string; name: string; email: string; avatar?: string };
          isFromCreator: boolean;
          attachments: unknown[];
          forwardedContent: unknown[];
          createdAt: string;
        }) => ({
          id: msg.id,
          conversationId,
          senderId: msg.isFromCreator ? msg.creator?.id || "creator" : msg.sender?.id || "unknown",
          content: msg.content,
          attachments: msg.attachments || [],
          readBy: [],
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.createdAt),
          sender: msg.isFromCreator
            ? {
                id: msg.creator?.id || "creator",
                name: msg.creator?.name || "Creator",
                email: msg.creator?.email || "",
                avatar: msg.creator?.avatar || null,
              }
            : {
                id: msg.sender?.id || "unknown",
                name: msg.sender?.name || "Unknown",
                email: msg.sender?.email || "",
                avatar: msg.sender?.avatar || null,
              },
          // Store forwarded content for special rendering
          forwardedContent: msg.forwardedContent,
        }));

        if (before) {
          setMessages((prev) => [...transformedMessages, ...prev]);
        } else {
          setMessages(transformedMessages);
        }
        setHasMoreMessages(data.hasMore || false);
        // Use the first message's createdAt as cursor for pagination
        if (transformedMessages.length > 0) {
          setMessageCursor(transformedMessages[0].createdAt.toISOString());
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial fetch
  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle conversation selection from URL
  React.useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find((c) => c.id === selectedConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        fetchMessages(selectedConversationId);
        setShowMobileSidebar(false);
      }
    } else {
      setSelectedConversation(null);
      setMessages([]);
    }
  }, [selectedConversationId, conversations, fetchMessages]);

  // Select conversation handler
  const handleSelectConversation = (conversationId: string) => {
    router.push(`/dashboard/messages?conversation=${conversationId}`);
  };

  // Send message handler using unified inbox API
  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!selectedConversationId) return;

    try {
      setIsSending(true);

      // Handle file uploads if any
      const attachmentData: { id: string; name: string; url: string; type: string; size: number }[] = [];
      if (attachments && attachments.length > 0) {
        // For now, we'll skip actual file upload - this would integrate with your storage service
        // In production, you'd upload files first then include their URLs
        console.log("File attachments:", attachments);
      }

      const response = await fetch(`/api/inbox/${selectedConversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachments: attachmentData,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newMessage = {
          id: data.message.id,
          conversationId: selectedConversationId,
          senderId: currentUserId,
          content: data.message.content,
          attachments: data.message.attachments || [],
          readBy: [],
          createdAt: new Date(data.message.createdAt),
          updatedAt: new Date(data.message.createdAt),
          sender: data.message.sender,
        };
        setMessages((prev) => [...prev, newMessage]);

        // Update conversation list to show new message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId
              ? {
                  ...conv,
                  lastMessageAt: new Date(),
                  messages: [newMessage],
                }
              : conv
          ).sort((a, b) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          })
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Load more messages
  const handleLoadMore = () => {
    if (selectedConversationId && messageCursor && !isLoadingMessages) {
      fetchMessages(selectedConversationId, messageCursor);
    }
  };

  // New conversation handler
  const handleNewConversation = () => {
    setShowNewConversationDialog(true);
  };

  // Create conversation using unified inbox API
  const handleCreateConversation = async (participantIds: string[], name?: string, creatorId?: string) => {
    try {
      const body: {
        type: string;
        participantIds?: string[];
        creatorId?: string;
        name?: string;
      } = creatorId
        ? { type: "CREATOR", creatorId }
        : {
            type: participantIds.length > 1 ? "GROUP" : "DIRECT",
            participantIds: [...participantIds, currentUserId],
            name,
          };

      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchConversations();
        router.push(`/dashboard/messages?conversation=${data.conversation.id}`);
        setShowNewConversationDialog(false);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] overflow-hidden -mx-4 -my-4 md:mx-0 md:my-0">
      {/* Mobile sidebar toggle - shown when no conversation selected on mobile */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          {isLoadingConversations ? (
            <ConversationListSkeleton />
          ) : (
            <ChatSidebar
              conversations={conversations}
              currentUserId={currentUserId}
              selectedConversationId={selectedConversationId || undefined}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              className="h-full"
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 flex-shrink-0 flex-col border-r border-border/50 bg-card">
        {/* Inbox type tabs */}
        <div className="flex-shrink-0 p-3 border-b border-border/50">
          <Tabs value={inboxType} onValueChange={(v) => setInboxType(v as "all" | "team" | "creator")}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              <TabsTrigger value="team" className="text-xs relative">
                <Users className="h-3 w-3 mr-1" />
                Team
                {unreadCounts.team > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {unreadCounts.team}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="creator" className="text-xs relative">
                <User className="h-3 w-3 mr-1" />
                Creators
                {unreadCounts.creator > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {unreadCounts.creator}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoadingConversations ? (
          <div className="flex-1">
            <ConversationListSkeleton />
          </div>
        ) : (
          <ChatSidebar
            conversations={conversations}
            currentUserId={currentUserId}
            selectedConversationId={selectedConversationId || undefined}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            className="flex-1"
          />
        )}
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header - show when no conversation */}
        {!selectedConversation && (
          <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card">
            <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              Messages
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileSidebar(true)}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Chats
            </Button>
          </div>
        )}

        {isLoadingMessages && !selectedConversation ? (
          <ChatWindowSkeleton />
        ) : (
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            currentUserId={currentUserId}
            isLoading={isLoadingMessages}
            isSending={isSending}
            hasMore={hasMoreMessages}
            onSendMessage={handleSendMessage}
            onLoadMore={handleLoadMore}
            onBack={() => {
              router.push("/dashboard/messages");
              setShowMobileSidebar(true);
            }}
          />
        )}
      </div>

      {/* New conversation dialog */}
      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
        onCreateConversation={handleCreateConversation}
        currentUserId={currentUserId}
      />
    </div>
  );
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (participantIds: string[], name?: string, creatorId?: string) => void;
  currentUserId: string;
}

function NewConversationDialog({
  open,
  onOpenChange,
  onCreateConversation,
  currentUserId,
}: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUsers, setSelectedUsers] = React.useState<
    { id: string; name: string; email: string; avatar?: string; isCreator?: boolean }[]
  >([]);
  const [groupName, setGroupName] = React.useState("");
  const [users, setUsers] = React.useState<
    { id: string; name: string; email: string; avatar?: string }[]
  >([]);
  const [creators, setCreators] = React.useState<
    { id: string; name: string; email: string; avatar?: string }[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchType, setSearchType] = React.useState<"team" | "creators">("team");

  // Search for users or creators
  React.useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        setCreators([]);
        return;
      }

      try {
        setIsLoading(true);
        if (searchType === "team") {
          const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
          if (response.ok) {
            const data = await response.json();
            setUsers(data.users?.filter((u: { id: string }) => u.id !== currentUserId) || []);
          }
        } else {
          const response = await fetch(`/api/creators?search=${encodeURIComponent(searchQuery)}&limit=10`);
          if (response.ok) {
            const data = await response.json();
            setCreators(data.creators || []);
          }
        }
      } catch (error) {
        console.error("Failed to search:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId, searchType]);

  const handleSelectUser = (user: { id: string; name: string; email: string; avatar?: string }, isCreator?: boolean) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, { ...user, isCreator }]);
    }
    setSearchQuery("");
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    setIsCreating(true);

    // If we selected a creator, create a CREATOR type conversation
    const selectedCreator = selectedUsers.find(u => u.isCreator);
    if (selectedCreator) {
      await onCreateConversation([], undefined, selectedCreator.id);
    } else {
      await onCreateConversation(
        selectedUsers.map((u) => u.id),
        selectedUsers.length > 1 ? groupName || undefined : undefined
      );
    }
    setIsCreating(false);

    // Reset state
    setSelectedUsers([]);
    setGroupName("");
    setSearchQuery("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedUsers([]);
    setGroupName("");
    setSearchQuery("");
    setSearchType("team");
  };

  const hasCreatorSelected = selectedUsers.some(u => u.isCreator);
  const searchResults = searchType === "team" ? users : creators;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            New Conversation
          </DialogTitle>
          <DialogDescription>
            Start a new conversation with team members or creators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1",
                    user.isCreator
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <Avatar
                    size="xs"
                    user={{ name: user.name, email: user.email, image: user.avatar }}
                  />
                  <span className="text-sm font-medium">{user.name}</span>
                  {user.isCreator && <User className="h-3 w-3" />}
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="ml-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Group name input (shown for 2+ team members, not creators) */}
          {selectedUsers.length > 1 && !hasCreatorSelected && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Group Name (optional)
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
              />
            </div>
          )}

          {/* Search type tabs */}
          {!hasCreatorSelected && (
            <Tabs value={searchType} onValueChange={(v) => {
              setSearchType(v as "team" | "creators");
              setSearchQuery("");
            }}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="team" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Team Members
                </TabsTrigger>
                <TabsTrigger value="creators" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Creators
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* User search */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {selectedUsers.length > 0 && !hasCreatorSelected
                ? "Add more people"
                : searchType === "team"
                ? "Search team members"
                : "Search creators"}
            </label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === "team" ? "Search by name or email..." : "Search creators..."}
              disabled={hasCreatorSelected}
            />
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectUser(item, searchType === "creators")}
                  disabled={selectedUsers.some((u) => u.id === item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                    selectedUsers.some((u) => u.id === item.id)
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar
                    size="sm"
                    user={{ name: item.name, email: item.email, image: item.avatar }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {searchType === "creators" && (
                        <User className="h-3 w-3 text-violet-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Searching...
            </div>
          )}

          {searchQuery && !isLoading && searchResults.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No {searchType === "team" ? "team members" : "creators"} found
            </div>
          )}

          {/* Create button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedUsers.length === 0 || isCreating}
              className="btn-gradient"
            >
              {isCreating ? "Creating..." : "Start Conversation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
