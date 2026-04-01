// Agency Owner Oversight Types
// These types support comprehensive monitoring of staff and creator activities

export interface OversightSettings {
  // Message monitoring
  monitorCreatorMessages: boolean;
  monitorInternalMessages: boolean;
  receiveMessageDigest: "never" | "daily" | "weekly";

  // Activity monitoring
  trackStaffActivity: boolean;
  trackCreatorActivity: boolean;

  // Alerts
  alertOnSensitiveKeywords: boolean;
  sensitiveKeywords: string[];
  alertOnUnusualActivity: boolean;

  // Access
  canAccessAllMessages: boolean;
  canAccessDeletedContent: boolean;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userType: "staff" | "creator";
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface MessageOversight {
  id: string;
  conversationType: "staff_creator" | "staff_staff" | "internal_note";
  participants: ConversationParticipant[];
  messageCount: number;
  lastMessageAt: Date;
  flagged: boolean;
  flagReason?: string;
  preview?: string;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface ConversationThread {
  id: string;
  type: "staff_creator" | "staff_staff" | "internal_note";
  participants: ConversationParticipant[];
  messages: ThreadMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: Date;
  attachments?: MessageAttachment[];
  edited?: boolean;
  deleted?: boolean;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface StaffActivityMetrics {
  userId: string;
  userName: string;
  role: string;
  avatar?: string;

  // Activity counts
  actionsToday: number;
  actionsThisWeek: number;
  actionsThisMonth: number;

  // Messages
  messagesToCreators: number;
  messagesToStaff: number;

  // Response metrics
  averageResponseTime: number; // minutes
  requestsHandled: number;

  // Login info
  lastLogin?: Date;
  lastActivity?: Date;
  loginCount: number;

  // Flags
  hasUnusualActivity: boolean;
  unusualActivityReasons?: string[];
}

export interface CreatorCommunicationSummary {
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;

  // Assigned staff
  assignedStaff: {
    id: string;
    name: string;
    role: string;
  }[];

  // Communication stats
  totalMessages: number;
  messagesThisWeek: number;
  lastMessageAt?: Date;

  // Response metrics
  averageResponseTime: number; // minutes
  pendingRequests: number;

  // Flags
  flagged: boolean;
  flagReasons?: string[];
}

export interface KeywordAlert {
  id: string;
  keyword: string;
  messageId: string;
  conversationId: string;
  conversationType: "staff_creator" | "staff_staff" | "internal_note";
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId?: string;
  recipientName?: string;
  messagePreview: string;
  timestamp: Date;
  status: "new" | "reviewed" | "escalated" | "dismissed";
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
}

export interface UnusualActivityAlert {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  alertType: "high_volume" | "off_hours" | "unusual_pattern" | "failed_logins" | "data_export" | "bulk_delete";
  description: string;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  timestamp: Date;
  status: "new" | "reviewed" | "escalated" | "dismissed";
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
}

export interface OversightStats {
  // Activity overview
  totalActionsToday: number;
  totalActionsThisWeek: number;
  activeStaffCount: number;
  activeCreatorCount: number;

  // Messages
  totalMessagesToday: number;
  staffCreatorMessages: number;
  staffStaffMessages: number;

  // Alerts
  newKeywordAlerts: number;
  newActivityAlerts: number;
  pendingReviewCount: number;

  // Response metrics
  averageResponseTime: number;
  pendingRequests: number;
}

export interface ActivityFilter {
  userId?: string;
  userType?: "staff" | "creator";
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

export interface MessageFilter {
  conversationType?: "staff_creator" | "staff_staff" | "internal_note" | "all";
  participantId?: string;
  staffId?: string;
  creatorId?: string;
  flagged?: boolean;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

export type OversightPermission =
  | "view_activity_logs"
  | "view_messages"
  | "view_deleted_content"
  | "manage_keywords"
  | "review_alerts"
  | "export_data"
  | "modify_settings";

export interface OversightAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: "settings" | "keyword" | "alert" | "message" | "export";
  targetId?: string;
  details: Record<string, unknown>;
  timestamp: Date;
}
