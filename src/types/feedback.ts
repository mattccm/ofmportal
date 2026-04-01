// Feedback Types for UploadPortal

export type FeedbackType = "BUG" | "FEATURE_REQUEST" | "GENERAL";

export type FeedbackStatus = "NEW" | "REVIEWED" | "IMPLEMENTED";

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: FeedbackType;
  rating: number; // 1-5 stars
  message: string;
  screenshotUrl?: string | null;
  status: FeedbackStatus;
  adminReply?: string | null;
  repliedAt?: Date | null;
  repliedBy?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeedbackInput {
  type: FeedbackType;
  rating: number;
  message: string;
  screenshotUrl?: string;
  pageUrl?: string;
  userAgent?: string;
}

export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  adminReply?: string;
}

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  page?: number;
  limit?: number;
}

export interface FeedbackListResponse {
  feedback: Feedback[];
  total: number;
  page: number;
  totalPages: number;
}
