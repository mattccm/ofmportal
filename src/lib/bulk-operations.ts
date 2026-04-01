// Bulk Operations Types and Utilities
// Centralized types and helper functions for bulk operations

import { z } from "zod";

// ============================================
// TYPES
// ============================================

export type BulkOperationType =
  | "request_create"
  | "upload_review"
  | "status_update"
  | "reminder_send"
  | "archive";

export type BulkOperationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "partially_completed"
  | "rolled_back";

export interface BulkOperationResult<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface BulkOperation {
  id: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  results: BulkOperationResult[];
  startedAt: Date;
  completedAt?: Date;
  canUndo: boolean;
  undoExpiresAt?: Date;
  metadata?: Record<string, unknown>;
  userId: string;
  agencyId: string;
}

export interface BulkOperationProgress {
  operationId: string;
  status: BulkOperationStatus;
  progress: number; // 0-100
  processedItems: number;
  totalItems: number;
  successCount: number;
  failedCount: number;
  currentItem?: string;
  estimatedTimeRemaining?: number; // seconds
}

// ============================================
// BULK REQUEST CREATION TYPES
// ============================================

export interface BulkRequestItem {
  creatorId: string;
  title: string;
  description?: string;
  dueDate?: string;
  urgency?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  templateId?: string;
  customFields?: Record<string, unknown>;
}

export interface BulkRequestConfig {
  templateId?: string;
  requests: BulkRequestItem[];
  sendNotifications: boolean;
  staggerDates?: {
    enabled: boolean;
    intervalDays: number;
  };
  personalization?: {
    enabled: boolean;
    tokens: Record<string, string>;
  };
}

export const bulkRequestSchema = z.object({
  templateId: z.string().optional(),
  requests: z.array(z.object({
    creatorId: z.string(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    templateId: z.string().optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })).min(1, "At least one request is required"),
  sendNotifications: z.boolean().default(true),
  staggerDates: z.object({
    enabled: z.boolean(),
    intervalDays: z.number().min(1).max(30),
  }).optional(),
  personalization: z.object({
    enabled: z.boolean(),
    tokens: z.record(z.string(), z.string()),
  }).optional(),
});

// ============================================
// BULK REVIEW TYPES
// ============================================

export type ReviewAction = "approve" | "reject" | "skip";

export interface BulkReviewItem {
  uploadId: string;
  action: ReviewAction;
  rating?: number;
  notes?: string;
  rejectReason?: string;
}

export interface QuickRejectTemplate {
  id: string;
  label: string;
  message: string;
  category?: string;
}

export const DEFAULT_REJECT_TEMPLATES: QuickRejectTemplate[] = [
  { id: "lighting", label: "Lighting Issue", message: "The lighting in this content needs improvement. Please ensure adequate, even lighting and resubmit.", category: "Quality" },
  { id: "format", label: "Wrong Format", message: "The file format does not match the requirements. Please check the specifications and resubmit in the correct format.", category: "Technical" },
  { id: "resolution", label: "Low Resolution", message: "The resolution is too low for our requirements. Please upload a higher quality version.", category: "Quality" },
  { id: "audio", label: "Audio Issues", message: "There are audio quality issues with this submission. Please check sound levels and clarity.", category: "Quality" },
  { id: "branding", label: "Branding Missing", message: "Required branding elements are missing or incorrect. Please review brand guidelines and resubmit.", category: "Compliance" },
  { id: "incomplete", label: "Incomplete Content", message: "The content appears incomplete. Please ensure all required elements are included.", category: "Content" },
  { id: "wrong-content", label: "Wrong Content", message: "This submission does not match the content request. Please review the requirements and submit the correct content.", category: "Content" },
  { id: "copyright", label: "Copyright Concern", message: "There may be copyright issues with elements in this content. Please ensure all content is original or properly licensed.", category: "Compliance" },
];

export const bulkReviewSchema = z.object({
  reviews: z.array(z.object({
    uploadId: z.string(),
    action: z.enum(["approve", "reject", "skip"]),
    rating: z.number().min(0).max(5).optional(),
    notes: z.string().optional(),
    rejectReason: z.string().optional(),
  })).min(1, "At least one review is required"),
});

// ============================================
// BULK STATUS UPDATE TYPES
// ============================================

export type RequestStatus =
  | "DRAFT"
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED"
  | "CANCELLED"
  | "ARCHIVED";

export interface BulkStatusUpdate {
  requestIds: string[];
  newStatus: RequestStatus;
  note?: string;
}

export interface ArchiveConfig {
  olderThanDays: number;
  statuses: RequestStatus[];
}

export const bulkStatusUpdateSchema = z.object({
  requestIds: z.array(z.string()).min(1, "At least one request is required"),
  newStatus: z.enum([
    "DRAFT",
    "PENDING",
    "IN_PROGRESS",
    "SUBMITTED",
    "UNDER_REVIEW",
    "NEEDS_REVISION",
    "APPROVED",
    "CANCELLED",
    "ARCHIVED",
  ]),
  note: z.string().optional(),
});

export const bulkArchiveSchema = z.object({
  olderThanDays: z.number().min(1).max(365),
  statuses: z.array(z.enum([
    "APPROVED",
    "CANCELLED",
    "ARCHIVED",
  ])).min(1),
});

// ============================================
// BULK REMINDER TYPES
// ============================================

export type ReminderFilter =
  | "overdue"
  | "due_within_24h"
  | "due_within_48h"
  | "due_within_week"
  | "no_activity_7d"
  | "custom";

export interface BulkReminderConfig {
  filter: ReminderFilter;
  requestIds?: string[]; // For custom filter
  message?: string;
  channels: ("email" | "sms")[];
}

export const bulkReminderSchema = z.object({
  filter: z.enum([
    "overdue",
    "due_within_24h",
    "due_within_48h",
    "due_within_week",
    "no_activity_7d",
    "custom",
  ]),
  requestIds: z.array(z.string()).optional(),
  message: z.string().optional(),
  channels: z.array(z.enum(["email", "sms"])).min(1),
});

// ============================================
// UNDO OPERATION TYPES
// ============================================

export interface UndoOperation {
  operationId: string;
  type: BulkOperationType;
  undoData: unknown;
  expiresAt: Date;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique operation ID
 */
export function generateOperationId(): string {
  return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

/**
 * Estimate remaining time based on processing speed
 */
export function estimateRemainingTime(
  processedItems: number,
  totalItems: number,
  elapsedMs: number
): number {
  if (processedItems === 0) return 0;
  const avgTimePerItem = elapsedMs / processedItems;
  const remainingItems = totalItems - processedItems;
  return Math.round((remainingItems * avgTimePerItem) / 1000); // seconds
}

/**
 * Parse personalization tokens in a string
 * Supports: {{creator.name}}, {{due_date}}, {{request.title}}, etc.
 */
export function parseTokens(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split(".");
    let value: unknown = data;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return match; // Keep original if key not found
      }
    }

    return String(value ?? match);
  });
}

/**
 * Calculate staggered due dates
 */
export function calculateStaggeredDates(
  startDate: Date,
  count: number,
  intervalDays: number
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + (i * intervalDays));
    dates.push(date);
  }
  return dates;
}

/**
 * Group items by creator for notifications
 */
export function groupByCreator<T extends { creatorId: string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const existing = groups.get(item.creatorId) || [];
    groups.set(item.creatorId, [...existing, item]);
  }
  return groups;
}

/**
 * Chunk array for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Create undo window (30 seconds by default)
 */
export function createUndoWindow(windowSeconds: number = 30): Date {
  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + windowSeconds);
  return expires;
}

/**
 * Check if undo is still available
 */
export function canUndo(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}

/**
 * Format operation summary for logging
 */
export function formatOperationSummary(operation: BulkOperation): string {
  const duration = operation.completedAt
    ? Math.round((operation.completedAt.getTime() - operation.startedAt.getTime()) / 1000)
    : 0;

  return `${operation.type}: ${operation.successCount}/${operation.totalItems} succeeded in ${duration}s`;
}

/**
 * Validate bulk operation limits
 */
export function validateBulkLimits(
  itemCount: number,
  maxItems: number = 500
): { valid: boolean; error?: string } {
  if (itemCount === 0) {
    return { valid: false, error: "No items selected" };
  }
  if (itemCount > maxItems) {
    return { valid: false, error: `Maximum ${maxItems} items allowed per operation` };
  }
  return { valid: true };
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

export const BULK_REVIEW_SHORTCUTS: Record<string, { action: ReviewAction | "select_all" | "deselect_all"; label: string }> = {
  a: { action: "approve", label: "Approve selected" },
  r: { action: "reject", label: "Reject selected" },
  s: { action: "skip", label: "Skip to next" },
  ArrowRight: { action: "skip", label: "Next item" },
  ArrowLeft: { action: "skip", label: "Previous item" },
  "Ctrl+a": { action: "select_all", label: "Select all" },
  Escape: { action: "deselect_all", label: "Deselect all" },
};

// ============================================
// OPERATION PRESETS / TEMPLATES
// ============================================

export interface BulkOperationTemplate {
  id: string;
  name: string;
  description: string;
  type: BulkOperationType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  useCount: number;
  isDefault?: boolean;
  createdBy?: string;
}

export interface BulkOperationPreset {
  id: string;
  name: string;
  description: string;
  type: BulkOperationType;
  config: unknown;
  createdAt: Date;
  lastUsedAt?: Date;
  useCount: number;
}

export const DEFAULT_PRESETS: Omit<BulkOperationPreset, "id" | "createdAt" | "useCount">[] = [
  {
    name: "Archive Completed (30+ days)",
    description: "Archive all completed requests older than 30 days",
    type: "archive",
    config: { olderThanDays: 30, statuses: ["APPROVED", "CANCELLED"] },
  },
  {
    name: "Remind All Overdue",
    description: "Send reminders to all overdue requests",
    type: "reminder_send",
    config: { filter: "overdue", channels: ["email"] },
  },
  {
    name: "Remind Due This Week",
    description: "Send reminders for requests due within a week",
    type: "reminder_send",
    config: { filter: "due_within_week", channels: ["email"] },
  },
];

// ============================================
// OPERATION HISTORY
// ============================================

export interface BulkOperationHistoryEntry {
  id: string;
  operationId: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  executedBy: {
    id: string;
    name: string;
    email: string;
  };
  affectedItems: {
    id: string;
    name: string;
    previousState?: unknown;
    newState?: unknown;
  }[];
  canUndo: boolean;
  undoExpiresAt?: string;
  undoneAt?: string;
  metadata?: Record<string, unknown>;
  errors?: string[];
}

// ============================================
// DRY RUN / PREVIEW TYPES
// ============================================

export interface DryRunResult {
  operationType: BulkOperationType;
  willAffect: number;
  items: DryRunItem[];
  estimatedDuration: number; // milliseconds
  warnings: string[];
  canProceed: boolean;
}

export interface DryRunItem {
  id: string;
  name: string;
  currentState: unknown;
  proposedChange: unknown;
  changeDescription: string;
  warningMessage?: string;
}

// ============================================
// SMART SELECTION PRESETS
// ============================================

export interface SmartSelectionPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  filter: SmartSelectionFilter;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export interface SmartSelectionFilter {
  type: "overdue" | "group" | "priority" | "status" | "creator" | "date_range" | "no_activity" | "custom";
  params?: Record<string, unknown>;
}

export const SMART_SELECTION_PRESETS: SmartSelectionPreset[] = [
  {
    id: "all_overdue",
    name: "All Overdue",
    description: "Select all requests past their due date",
    icon: "AlertTriangle",
    filter: { type: "overdue" },
    badgeVariant: "destructive",
  },
  {
    id: "high_priority",
    name: "High Priority",
    description: "Select all high and urgent priority items",
    icon: "Flame",
    filter: { type: "priority", params: { priorities: ["HIGH", "URGENT"] } },
    badgeVariant: "default",
  },
  {
    id: "due_today",
    name: "Due Today",
    description: "Select all items due today",
    icon: "Calendar",
    filter: { type: "date_range", params: { daysFromNow: 0 } },
    badgeVariant: "secondary",
  },
  {
    id: "due_this_week",
    name: "Due This Week",
    description: "Select all items due within 7 days",
    icon: "CalendarDays",
    filter: { type: "date_range", params: { daysFromNow: 7 } },
    badgeVariant: "secondary",
  },
  {
    id: "no_activity_7d",
    name: "No Activity (7 days)",
    description: "Select items with no updates in 7 days",
    icon: "Clock",
    filter: { type: "no_activity", params: { days: 7 } },
    badgeVariant: "outline",
  },
  {
    id: "pending_review",
    name: "Pending Review",
    description: "Select all items awaiting review",
    icon: "Eye",
    filter: { type: "status", params: { statuses: ["PENDING", "UNDER_REVIEW"] } },
    badgeVariant: "secondary",
  },
];

// ============================================
// ENHANCED UNDO OPERATION
// ============================================

export interface EnhancedUndoOperation {
  operationId: string;
  type: BulkOperationType;
  description: string;
  affectedCount: number;
  previousStates: {
    id: string;
    entityType: string;
    previousData: unknown;
  }[];
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

// Storage key for undo operations
export const UNDO_STORAGE_KEY = "bulk_operations_undo";
export const UNDO_WINDOW_SECONDS = 300; // 5 minutes

/**
 * Create a 5-minute undo window
 */
export function createEnhancedUndoWindow(): Date {
  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + UNDO_WINDOW_SECONDS);
  return expires;
}

/**
 * Check if undo window is still valid
 */
export function isUndoWindowValid(expiresAt: string | Date): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return new Date() < expiry;
}

/**
 * Calculate remaining undo time in seconds
 */
export function getRemainingUndoTime(expiresAt: string | Date): number {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const remaining = Math.floor((expiry.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

// ============================================
// TEMPLATE STORAGE UTILITIES
// ============================================

export const TEMPLATES_STORAGE_KEY = "bulk_operation_templates";
export const HISTORY_STORAGE_KEY = "bulk_operation_history";
export const MAX_HISTORY_ENTRIES = 100;

/**
 * Generate a unique template ID
 */
export function generateTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new template from current configuration
 */
export function createTemplate(
  name: string,
  description: string,
  type: BulkOperationType,
  config: Record<string, unknown>
): BulkOperationTemplate {
  const now = new Date().toISOString();
  return {
    id: generateTemplateId(),
    name,
    description,
    type,
    config,
    createdAt: now,
    updatedAt: now,
    useCount: 0,
  };
}

/**
 * Get formatted operation type label
 */
export function getOperationTypeLabel(type: BulkOperationType): string {
  const labels: Record<BulkOperationType, string> = {
    request_create: "Request Creation",
    upload_review: "Upload Review",
    status_update: "Status Update",
    reminder_send: "Send Reminders",
    archive: "Archive",
  };
  return labels[type] || type;
}

/**
 * Get operation type icon name
 */
export function getOperationTypeIcon(type: BulkOperationType): string {
  const icons: Record<BulkOperationType, string> = {
    request_create: "Users",
    upload_review: "FileCheck",
    status_update: "RefreshCw",
    reminder_send: "Bell",
    archive: "Archive",
  };
  return icons[type] || "Settings";
}
