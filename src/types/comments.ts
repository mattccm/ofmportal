// ============================================
// COMMENT TYPES
// ============================================

/**
 * User information for comments
 */
export interface CommentUser {
  id: string;
  name: string;
  avatar?: string | null;
}

/**
 * Team member for @mention autocomplete
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
}

/**
 * File attachment on a comment
 */
export interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

/**
 * Reaction on a comment (emoji -> array of user IDs)
 */
export type CommentReactions = Record<string, string[]>;

/**
 * Full comment object
 */
export interface Comment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt?: Date | null;
  user: CommentUser;
  parentId?: string | null;
  replies?: Comment[];
  mentions: string[];
  attachments: CommentAttachment[];
  reactions: CommentReactions;
}

/**
 * Comment creation payload
 */
export interface CreateCommentPayload {
  requestId?: string;
  uploadId?: string;
  message: string;
  isInternal?: boolean;
  parentId?: string;
  mentions?: string[];
}

/**
 * Comment update payload
 */
export interface UpdateCommentPayload {
  id: string;
  message: string;
  mentions?: string[];
}

/**
 * Reaction toggle payload
 */
export interface ReactionPayload {
  commentId: string;
  emoji: string;
}

/**
 * API response for comments list
 */
export interface CommentsResponse {
  comments: Comment[];
}

/**
 * API response for reaction toggle
 */
export interface ReactionResponse {
  reactions: CommentReactions;
  action: "added" | "removed";
}

// ============================================
// COMMENT EDITOR TYPES
// ============================================

/**
 * Comment editor submit handler
 */
export type CommentSubmitHandler = (
  message: string,
  mentions: string[],
  attachments: File[],
  isInternal?: boolean
) => Promise<void>;

/**
 * Comment editor props
 */
export interface CommentEditorProps {
  teamMembers: TeamMember[];
  onSubmit: CommentSubmitHandler;
  onCancel?: () => void;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  showInternalToggle?: boolean;
  autoFocus?: boolean;
}

// ============================================
// COMMENT THREAD TYPES
// ============================================

/**
 * Comment thread event handlers
 */
export interface CommentThreadHandlers {
  onCommentAdded?: (comment: Comment) => void;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
}

/**
 * Comment thread props
 */
export interface CommentThreadProps extends CommentThreadHandlers {
  requestId: string;
  uploadId?: string;
  comments: Comment[];
  currentUserId: string;
  teamMembers: TeamMember[];
}

// ============================================
// REACTION TYPES
// ============================================

/**
 * Common emoji categories for reactions
 */
export interface EmojiCategory {
  name: string;
  emojis: string[];
}

/**
 * Reaction badge display data
 */
export interface ReactionBadgeData {
  emoji: string;
  count: number;
  hasReacted: boolean;
  userNames: string[];
}
