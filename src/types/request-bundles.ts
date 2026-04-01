// Request Bundles / Onboarding Bundles Types
// Pre-configured sets of templates that auto-create multiple requests

export type UrgencyLevel = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type BundleTrigger = "on_creator_create" | "manual";

export interface TemplateConfig {
  templateId: string;
  defaultDueDays?: number; // Override template default
  defaultUrgency?: UrgencyLevel;
  autoAssign?: boolean; // Auto-assign to creator
  staggerDays?: number; // Stagger creation by X days from bundle execution
}

export interface RequestBundle {
  id: string;
  name: string;
  description?: string;
  templateIds: string[];
  // Configuration per template in the bundle
  templateConfigs: TemplateConfig[];
  isOnboardingBundle: boolean; // Show during creator onboarding
  autoTrigger?: BundleTrigger;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBundleInput {
  name: string;
  description?: string;
  templateIds: string[];
  templateConfigs: TemplateConfig[];
  isOnboardingBundle: boolean;
  autoTrigger?: BundleTrigger;
}

export interface UpdateBundleInput {
  name?: string;
  description?: string;
  templateIds?: string[];
  templateConfigs?: TemplateConfig[];
  isOnboardingBundle?: boolean;
  autoTrigger?: BundleTrigger;
}

// For bundle execution
export interface BundleExecutionConfig {
  bundleId: string;
  creatorIds: string[];
  // Override configurations per template
  overrides?: {
    templateId: string;
    dueDate?: string;
    urgency?: UrgencyLevel;
    sendNotification?: boolean;
  }[];
  sendNotifications?: boolean;
  startDate?: string; // Base date for staggering calculations
}

export interface BundleExecutionResult {
  bundleId: string;
  bundleName: string;
  createdRequests: {
    requestId: string;
    templateId: string;
    templateName: string;
    creatorId: string;
    creatorName: string;
    title: string;
    dueDate?: string;
    status: string;
  }[];
  failedRequests: {
    templateId: string;
    creatorId: string;
    error: string;
  }[];
  totalCreated: number;
  totalFailed: number;
}

// Preview types for UI
export interface BundlePreviewRequest {
  templateId: string;
  templateName: string;
  title: string;
  dueDate?: string;
  dueDays: number;
  urgency: UrgencyLevel;
  staggerDays: number;
  autoAssign: boolean;
}

export interface BundlePreview {
  bundle: RequestBundle;
  templates: {
    id: string;
    name: string;
    description?: string;
    fieldCount: number;
    defaultDueDays: number;
    defaultUrgency: UrgencyLevel;
  }[];
  previewRequests: BundlePreviewRequest[];
}

// List response type
export interface BundleListResponse {
  bundles: (RequestBundle & {
    templateCount: number;
    templates: { id: string; name: string }[];
  })[];
  total: number;
}

// For quick apply feature
export interface QuickApplyHistory {
  bundleId: string;
  bundleName: string;
  appliedAt: Date;
  requestsCreated: number;
}
