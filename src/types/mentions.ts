// ============================================
// MENTION TYPES
// ============================================

/**
 * Represents a mention of a user in a comment
 */
export interface Mention {
  id: string;
  commentId: string;
  mentionedUserId: string;
  mentionedByUserId: string;

  // Context
  resourceType: "request" | "upload" | "message";
  resourceId: string;

  // Notification
  notified: boolean;
  notifiedAt?: Date;

  // Read status
  read: boolean;
  readAt?: Date;

  createdAt: Date;
}

/**
 * Mention with expanded user and resource data
 */
export interface MentionWithDetails extends Mention {
  mentionedBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  comment: {
    id: string;
    message: string;
    createdAt: Date;
  };
  resource: {
    id: string;
    title: string;
    url: string;
  };
}

/**
 * Suggestion for @mention autocomplete
 */
export interface MentionSuggestion {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  isOnline?: boolean;
}

/**
 * Parsed mention from text
 */
export interface ParsedMention {
  userId: string;
  username: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Mention input state
 */
export interface MentionInputState {
  isOpen: boolean;
  query: string;
  cursorPosition: number;
  selectedIndex: number;
  triggerPosition: { top: number; left: number } | null;
}

/**
 * Create mention payload
 */
export interface CreateMentionPayload {
  commentId: string;
  mentionedUserId: string;
  resourceType: "request" | "upload" | "message";
  resourceId: string;
}

/**
 * Update mention payload
 */
export interface UpdateMentionPayload {
  mentionId: string;
  read?: boolean;
}

/**
 * API response for mentions list
 */
export interface MentionsResponse {
  mentions: MentionWithDetails[];
  total: number;
  hasMore: boolean;
}

/**
 * API response for unread count
 */
export interface UnreadMentionsResponse {
  count: number;
}

/**
 * API response for suggestions
 */
export interface SuggestionsResponse {
  suggestions: MentionSuggestion[];
}

// ============================================
// MENTION DISPLAY TYPES
// ============================================

/**
 * Mention display segment in rendered text
 */
export type MentionSegment =
  | { type: "text"; content: string }
  | { type: "mention"; userId: string; username: string };

/**
 * Mention filter options for panel
 */
export interface MentionFilters {
  read?: boolean;
  resourceType?: "request" | "upload" | "message" | "all";
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Mention sort options
 */
export type MentionSortOption = "newest" | "oldest" | "unread";
