import { db } from "./db";
import { ConversationType } from "@prisma/client";

// Types
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
  senderId: string;
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
  };
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
    senderId: string;
    createdAt: Date;
    sender: {
      id: string;
      name: string;
    };
  }[];
  _count: {
    messages: number;
  };
  unreadCount?: number;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  type: ConversationType,
  participantIds: string[],
  name?: string,
  requestId?: string
): Promise<ConversationWithDetails> {
  // Validate participants exist
  const users = await db.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true },
  });

  if (users.length !== participantIds.length) {
    throw new Error("One or more participants not found");
  }

  // Create conversation with participants
  const conversation = await db.conversation.create({
    data: {
      type,
      name: name || null,
      requestId: requestId || null,
      participants: {
        create: participantIds.map((userId) => ({
          userId,
        })),
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              lastActiveAt: true,
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  return conversation;
}

/**
 * Get or create a direct conversation between two users
 */
export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string
): Promise<ConversationWithDetails> {
  // Find existing direct conversation between these two users
  const existingConversation = await db.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: userId1 } } },
        { participants: { some: { userId: userId2 } } },
      ],
      participants: {
        every: {
          userId: { in: [userId1, userId2] },
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              lastActiveAt: true,
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  if (existingConversation) {
    // Count unread messages for userId1
    const unreadCount = await getUnreadCountForConversation(
      existingConversation.id,
      userId1
    );
    return { ...existingConversation, unreadCount };
  }

  // Create new direct conversation
  return createConversation("DIRECT", [userId1, userId2]);
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  attachments?: Attachment[]
): Promise<MessageWithSender> {
  // Verify sender is a participant
  const participant = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!participant) {
    throw new Error("User is not a participant of this conversation");
  }

  // Create message and update conversation
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId,
        senderId,
        content,
        attachments: (attachments || []) as unknown as object,
        readBy: [senderId] as unknown as object,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    }),
    db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return {
    ...message,
    attachments: (message.attachments as unknown as Attachment[]) || [],
    readBy: (message.readBy as unknown as string[]) || [],
  };
}

/**
 * Get all conversations for a user
 */
export async function getConversations(
  userId: string
): Promise<ConversationWithDetails[]> {
  const conversations = await db.conversation.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              lastActiveAt: true,
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  // Get unread counts for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await getUnreadCountForConversation(conv.id, userId);
      return { ...conv, unreadCount };
    })
  );

  return conversationsWithUnread;
}

/**
 * Get messages for a conversation with pagination
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  cursor?: string
): Promise<{
  messages: MessageWithSender[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const messages = await db.message.findMany({
    where: { conversationId },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: "desc" },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  });

  const hasMore = messages.length > limit;
  const trimmedMessages = hasMore ? messages.slice(0, -1) : messages;

  return {
    messages: trimmedMessages.map((m) => ({
      ...m,
      attachments: (m.attachments as unknown as Attachment[]) || [],
      readBy: (m.readBy as unknown as string[]) || [],
    })),
    nextCursor: hasMore ? trimmedMessages[trimmedMessages.length - 1]?.id : null,
    hasMore,
  };
}

/**
 * Mark all messages in a conversation as read by a user
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<{ count: number }> {
  // Get all unread messages
  const unreadMessages = await db.message.findMany({
    where: {
      conversationId,
      NOT: {
        readBy: {
          array_contains: [userId],
        },
      },
    },
  });

  // Update each message to add userId to readBy array
  const updatePromises = unreadMessages.map((message) => {
    const currentReadBy = (message.readBy as unknown as string[]) || [];
    if (!currentReadBy.includes(userId)) {
      return db.message.update({
        where: { id: message.id },
        data: {
          readBy: [...currentReadBy, userId] as unknown as object,
        },
      });
    }
    return Promise.resolve(null);
  });

  await Promise.all(updatePromises);

  return { count: unreadMessages.length };
}

/**
 * Get unread message count for a specific conversation
 */
async function getUnreadCountForConversation(
  conversationId: string,
  userId: string
): Promise<number> {
  // We need to count messages where userId is not in readBy array
  const messages = await db.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
    },
    select: { readBy: true },
  });

  return messages.filter((m) => {
    const readBy = (m.readBy as unknown as string[]) || [];
    return !readBy.includes(userId);
  }).length;
}

/**
 * Get total unread message count for a user across all conversations
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  // Get all conversations user is part of
  const conversations = await db.conversation.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    select: { id: true },
  });

  // Count unread messages in each conversation
  const counts = await Promise.all(
    conversations.map((conv) => getUnreadCountForConversation(conv.id, userId))
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * Add participants to a group conversation
 */
export async function addParticipants(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.type !== "GROUP") {
    throw new Error("Can only add participants to group conversations");
  }

  await db.conversationParticipant.createMany({
    data: userIds.map((userId) => ({
      conversationId,
      userId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Remove a participant from a group conversation
 */
export async function removeParticipant(
  conversationId: string,
  userId: string
): Promise<void> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { _count: { select: { participants: true } } },
  });

  if (!conversation || conversation.type !== "GROUP") {
    throw new Error("Can only remove participants from group conversations");
  }

  if (conversation._count.participants <= 2) {
    throw new Error("Cannot remove participant: conversation needs at least 2 participants");
  }

  await db.conversationParticipant.delete({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });
}

/**
 * Update conversation name (for group conversations)
 */
export async function updateConversationName(
  conversationId: string,
  name: string
): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { name },
  });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await db.conversation.delete({
    where: { id: conversationId },
  });
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
