"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const currentUserId = session?.user?.id || "";
  const selectedConversationId = searchParams.get("conversation");

  // Fetch conversations
  const fetchConversations = React.useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Fetch messages for a conversation
  const fetchMessages = React.useCallback(async (conversationId: string, cursor?: string) => {
    try {
      setIsLoadingMessages(true);
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/conversations/${conversationId}/messages?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (cursor) {
          setMessages((prev) => [...prev, ...data.messages]);
        } else {
          setMessages(data.messages || []);
        }
        setHasMoreMessages(data.hasMore || false);
        setMessageCursor(data.nextCursor || null);

        // Mark messages as read
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: "PATCH",
        });
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

  // Send message handler
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

      const response = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachments: attachmentData,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [data.message, ...prev]);

        // Update conversation list to show new message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId
              ? {
                  ...conv,
                  lastMessageAt: new Date(),
                  messages: [data.message],
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

  // Create conversation
  const handleCreateConversation = async (participantIds: string[], name?: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: participantIds.length > 1 ? "GROUP" : "DIRECT",
          participantIds: [...participantIds, currentUserId],
          name,
        }),
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
      <div className="hidden md:flex w-80 flex-shrink-0">
        {isLoadingConversations ? (
          <div className="w-full border-r border-border/50 bg-card">
            <div className="p-4 border-b border-border/50">
              <div className="h-6 w-24 rounded bg-muted animate-shimmer mb-4" />
              <div className="h-9 w-full rounded-lg bg-muted animate-shimmer" />
            </div>
            <ConversationListSkeleton />
          </div>
        ) : (
          <ChatSidebar
            conversations={conversations}
            currentUserId={currentUserId}
            selectedConversationId={selectedConversationId || undefined}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            className="w-full"
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
  onCreateConversation: (participantIds: string[], name?: string) => void;
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
    { id: string; name: string; email: string; avatar?: string }[]
  >([]);
  const [groupName, setGroupName] = React.useState("");
  const [users, setUsers] = React.useState<
    { id: string; name: string; email: string; avatar?: string }[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  // Search for users
  React.useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users?.filter((u: { id: string }) => u.id !== currentUserId) || []);
        }
      } catch (error) {
        console.error("Failed to search users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  const handleSelectUser = (user: { id: string; name: string; email: string; avatar?: string }) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setSearchQuery("");
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    setIsCreating(true);
    await onCreateConversation(
      selectedUsers.map((u) => u.id),
      selectedUsers.length > 1 ? groupName || undefined : undefined
    );
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
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            New Conversation
          </DialogTitle>
          <DialogDescription>
            Start a new conversation with one or more team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full pl-1 pr-2 py-1"
                >
                  <Avatar
                    size="xs"
                    user={{ name: user.name, email: user.email, image: user.avatar }}
                  />
                  <span className="text-sm font-medium">{user.name}</span>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Group name input (shown for 2+ selected users) */}
          {selectedUsers.length > 1 && (
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

          {/* User search */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {selectedUsers.length > 0 ? "Add more people" : "Search for people"}
            </label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
            />
          </div>

          {/* Search results */}
          {users.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  disabled={selectedUsers.some((u) => u.id === user.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                    selectedUsers.some((u) => u.id === user.id)
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar
                    size="sm"
                    user={{ name: user.name, email: user.email, image: user.avatar }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
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

          {searchQuery && !isLoading && users.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No users found
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
