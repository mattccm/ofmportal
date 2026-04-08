// Read Receipts & Typing Indicators Type Definitions
// Real-time communication awareness system

/**
 * Read receipt status for messages
 */
export type ReadStatus = "sending" | "delivered" | "read";

/**
 * Individual read receipt data
 */
export interface ReadReceiptData {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userEmail?: string;
  readAt: Date | string;
}

/**
 * Core read receipt structure
 */
export interface ReadReceipt {
  id: string;
  messageId?: string;
  requestId?: string;
  commentId?: string;

  userId: string;
  readAt: Date;

  // Device info (optional)
  deviceType?: "desktop" | "mobile" | "tablet";
}

/**
 * Typing indicator for real-time awareness
 */
export interface TypingIndicator {
  conversationId?: string;
  requestId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isTyping: boolean;
  startedAt: Date;
}

/**
 * View receipt for tracking resource views
 */
export interface ViewReceipt {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  userId: string;
  userName: string;
  viewedAt: Date;
  duration?: number; // How long they viewed in milliseconds
}

/**
 * Read receipt with extended user information
 */
export interface ReadReceiptWithUser extends ReadReceipt {
  userName: string;
  userAvatar?: string;
  userEmail?: string;
}

/**
 * Read status for a single message
 */
export interface MessageReadStatus {
  messageId: string;
  isRead: boolean;
  readBy: ReadReceiptData[];
  readCount: number;
  deliveredAt?: Date;
  totalRecipients?: number;
  allRead?: boolean;
}

/**
 * Conversation typing state
 */
export interface ConversationTypingState {
  conversationId: string;
  typingUsers: TypingIndicator[];
  lastUpdated: Date;
}

/**
 * View history for a resource
 */
export interface ViewHistory {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  views: ViewReceipt[];
  uniqueViewers: number;
  totalViews: number;
  averageViewDuration?: number;
}

/**
 * Request view tracking data
 */
export interface RequestViewData {
  viewedAt: Date | string | null;
  viewedByCreator: boolean;
  viewCount: number;
  lastViewedAt: Date | string | null;
}

/**
 * Extended content request with view tracking
 */
export interface ContentRequestWithViews {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  // View tracking fields
  viewedAt?: string | null;
  viewedByCreator?: boolean;
  viewCount?: number;
  lastViewedAt?: string | null;
}

/**
 * Read receipt settings for privacy
 */
export interface ReadReceiptSettings {
  sendReadReceipts: boolean;
  showReadReceipts: boolean;
}

// API Request/Response types

/**
 * Request to mark an item as read
 */
export interface MarkAsReadRequest {
  messageId?: string;
  requestId?: string;
  commentId?: string;
  userId: string;
  deviceType?: "desktop" | "mobile" | "tablet";
}

/**
 * Response from marking messages as read
 */
export interface MarkAsReadResponse {
  success: boolean;
  receipt?: ReadReceipt;
  markedAsRead?: number;
  messageIds?: string[];
  readAt?: string;
}

/**
 * Request to update typing status
 */
export interface TypingStatusRequest {
  conversationId?: string;
  requestId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isTyping: boolean;
}

/**
 * Response from typing status update
 */
export interface TypingStatusResponse {
  success: boolean;
  typingUsers: TypingIndicator[];
}

/**
 * Request to track a view
 */
export interface TrackViewRequest {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  userId: string;
  userName: string;
  duration?: number;
}

/**
 * Response from view tracking
 */
export interface TrackViewResponse {
  success: boolean;
  view: ViewReceipt;
}

/**
 * Request to get read receipts
 */
export interface GetReadReceiptsRequest {
  messageId?: string;
  requestId?: string;
  commentId?: string;
}

/**
 * Response containing read receipts
 */
export interface GetReadReceiptsResponse {
  receipts: ReadReceiptWithUser[];
  totalCount: number;
}

/**
 * Request to get views
 */
export interface GetViewsRequest {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
}

/**
 * Response containing views
 */
export interface GetViewsResponse {
  views: ViewReceipt[];
  uniqueViewers: number;
  totalViews: number;
}

/**
 * Response from getting conversation unread count
 */
export interface ConversationUnreadResponse {
  conversationId: string;
  unreadCount: number;
  totalMessages: number;
}

// Real-time subscription types

export interface ReadReceiptSubscription {
  messageIds?: string[];
  requestIds?: string[];
  commentIds?: string[];
  onUpdate: (receipts: ReadReceipt[]) => void;
}

export interface TypingSubscription {
  conversationId?: string;
  requestId?: string;
  onUpdate: (typingUsers: TypingIndicator[]) => void;
}

export interface ViewSubscription {
  resourceType: "request" | "upload" | "message";
  resourceId: string;
  onUpdate: (views: ViewReceipt[]) => void;
}

// Display formatting helpers

export type ReadStatusDisplay =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "read_all"
  | "failed";

export interface ReadStatusInfo {
  status: ReadStatusDisplay;
  label: string;
  icon: "clock" | "check" | "check-check" | "check-check-filled" | "x";
  color: "muted" | "default" | "primary" | "destructive";
  readers?: ReadReceiptWithUser[];
  readCount?: number;
  totalRecipients?: number;
}

// Typing indicator display

export interface TypingDisplayInfo {
  text: string;
  users: TypingIndicator[];
  showAnimation: boolean;
}

// Device type for icons

export const DEVICE_TYPE_ICONS = {
  desktop: "Monitor",
  mobile: "Smartphone",
  tablet: "Tablet",
} as const;

// Timing constants

export const READ_RECEIPT_CONSTANTS = {
  // How long to wait before marking as read (to avoid accidental reads)
  READ_DELAY_MS: 1000,
  // How long to show typing indicator after last keystroke
  TYPING_TIMEOUT_MS: 5000,
  // Polling interval for real-time updates (increased from 2s to 30s to reduce DB load)
  // NOTE: For real-time feel, use Supabase Realtime instead of polling
  POLL_INTERVAL_MS: 30000,
  // Debounce time for typing indicator updates
  TYPING_DEBOUNCE_MS: 500,
  // Maximum time to track a view session
  MAX_VIEW_DURATION_MS: 30 * 60 * 1000, // 30 minutes
} as const;
