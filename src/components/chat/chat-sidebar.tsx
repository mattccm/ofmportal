"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Hash,
  Circle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  type ConversationWithDetails,
  getConversationDisplayName,
  isUserOnline,
} from "@/lib/chat-types";

interface ChatSidebarProps {
  conversations: ConversationWithDetails[];
  currentUserId: string;
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  className?: string;
}

export function ChatSidebar({
  conversations,
  currentUserId,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  className,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter conversations based on search
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const displayName = getConversationDisplayName(conv, currentUserId);
      return displayName.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery, currentUserId]);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border/50 bg-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Messages
          </h2>
          <Button
            size="sm"
            onClick={onNewConversation}
            className="btn-gradient h-8 px-3"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewConversation}
                className="mt-2 text-primary hover:text-primary"
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="py-2">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUserId}
                isSelected={selectedConversationId === conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: ConversationWithDetails;
  currentUserId: string;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({
  conversation,
  currentUserId,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const lastMessage = conversation.messages[0];
  const unreadCount = conversation.unreadCount || 0;

  // Get the other participant for direct conversations
  const otherParticipant =
    conversation.type === "DIRECT"
      ? conversation.participants.find((p) => p.userId !== currentUserId)?.user
      : null;

  // Check online status
  const isOnline = otherParticipant
    ? isUserOnline(otherParticipant.lastActiveAt)
    : false;

  // Format timestamp
  const timeAgo = lastMessage
    ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false })
    : conversation.createdAt
    ? formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: false })
    : "";

  // Get conversation icon
  const ConversationIcon =
    conversation.type === "GROUP"
      ? Users
      : conversation.type === "REQUEST_THREAD"
      ? Hash
      : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 mx-2 rounded-lg text-left transition-all duration-200",
        "hover:bg-accent/50",
        isSelected && "bg-gradient-to-r from-primary/10 to-violet-500/10 border border-primary/20"
      )}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        {conversation.type === "DIRECT" && otherParticipant ? (
          <Avatar
            size="md"
            user={{
              name: otherParticipant.name,
              email: otherParticipant.email,
              image: otherParticipant.avatar,
            }}
            showStatus={true}
            status={isOnline ? "online" : "offline"}
          />
        ) : conversation.participants.length > 0 ? (
          <Avatar
            size="md"
            user={{
              name: conversation.participants[0]?.user?.name || displayName,
              email: conversation.participants[0]?.user?.email || "",
              image: conversation.participants[0]?.user?.avatar,
            }}
          />
        ) : (
          <Avatar
            size="md"
            user={{
              name: displayName,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={cn(
              "font-medium truncate text-sm",
              unreadCount > 0 && "text-foreground",
              !unreadCount && "text-foreground/80"
            )}
          >
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {timeAgo}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {lastMessage ? (
            <p
              className={cn(
                "text-xs truncate",
                unreadCount > 0
                  ? "text-foreground/80 font-medium"
                  : "text-muted-foreground"
              )}
            >
              {lastMessage.senderId === currentUserId && (
                <span className="text-muted-foreground">You: </span>
              )}
              {lastMessage.content}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No messages yet
            </p>
          )}

          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-5 px-1.5 flex-shrink-0 bg-gradient-to-r from-primary to-violet-500 text-white border-0"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

interface ConversationListSkeletonProps {
  count?: number;
}

export function ConversationListSkeleton({
  count = 5,
}: ConversationListSkeletonProps) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 mx-2">
          <div className="h-10 w-10 rounded-full bg-muted animate-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-24 rounded bg-muted animate-shimmer" />
              <div className="h-3 w-10 rounded bg-muted animate-shimmer" />
            </div>
            <div className="h-3 w-full rounded bg-muted animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ChatSidebar;
