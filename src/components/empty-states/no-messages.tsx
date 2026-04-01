"use client";

import { MessageSquare, MessageSquarePlus, Send } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO MESSAGES EMPTY STATE
// ============================================

interface NoMessagesProps {
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Whether this is shown when no conversation is selected */
  noConversationSelected?: boolean;
  /** Callback to start a new conversation */
  onNewConversation?: () => void;
  /** Size variant */
  size?: EmptyStateProps["size"];
  /** Whether to show in card */
  withCard?: boolean;
}

export function NoMessages({
  title,
  description,
  noConversationSelected = false,
  onNewConversation,
  size = "default",
  withCard = true,
}: NoMessagesProps) {
  // When no conversation is selected (sidebar view)
  if (noConversationSelected) {
    return (
      <EmptyState
        icon={Send}
        title={title || "Select a conversation"}
        description={description || "Choose a conversation from the sidebar or start a new one to begin messaging."}
        iconGradient="primary"
        size={size}
        withCard={withCard}
        action={onNewConversation ? {
          label: "New Conversation",
          onClick: onNewConversation,
          icon: MessageSquarePlus,
        } : undefined}
      />
    );
  }

  // When there are no conversations at all
  return (
    <EmptyState
      icon={MessageSquare}
      title={title || "No conversations yet"}
      description={
        description ||
        "Start a conversation with a team member or creator. Messages help you collaborate effectively on content requests."
      }
      iconGradient="primary"
      variant="illustrated"
      size={size}
      withCard={withCard}
      action={onNewConversation ? {
        label: "Start a Conversation",
        onClick: onNewConversation,
        icon: MessageSquarePlus,
      } : undefined}
    >
      {/* Quick tip */}
      <p className="text-xs text-muted-foreground mt-2 max-w-xs">
        Tip: You can also send messages directly from request pages
      </p>
    </EmptyState>
  );
}

export default NoMessages;
