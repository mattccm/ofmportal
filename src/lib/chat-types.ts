// Types for chat functionality - can be imported from client components
import { ConversationType } from "@prisma/client";

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  attachments: Attachment[];
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
  // For creator messages
  creatorId?: string | null;
  isFromCreator?: boolean;
}

export interface ConversationWithDetails {
  id: string;
  type: ConversationType;
  name: string | null;
  requestId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  participants: {
    id: string;
    userId: string;
    joinedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      lastActiveAt: Date | null;
    };
  }[];
  messages: {
    id: string;
    content: string;
    senderId: string | null;
    createdAt: Date;
    sender: {
      id: string;
      name: string;
    } | null;
  }[];
  _count: {
    messages: number;
  };
  unreadCount?: number;
}

/**
 * Check if a user is online (active within last 5 minutes)
 */
export function isUserOnline(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastActiveAt > fiveMinutesAgo;
}

/**
 * Get the display name for a conversation
 */
export function getConversationDisplayName(
  conversation: ConversationWithDetails,
  currentUserId: string
): string {
  if (conversation.name) {
    return conversation.name;
  }

  if (conversation.type === "DIRECT") {
    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== currentUserId
    );
    return otherParticipant?.user.name || "Unknown User";
  }

  // Group conversation without name
  const names = conversation.participants
    .filter((p) => p.userId !== currentUserId)
    .map((p) => p.user.name)
    .slice(0, 3);

  if (names.length === 0) return "Group Chat";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}
