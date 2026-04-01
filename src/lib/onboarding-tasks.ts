// Agency Onboarding Checklist Task Definitions
// Defines tasks for new agency users to complete during onboarding

import {
  User,
  UserPlus,
  FileText,
  Send,
  Eye,
  Users,
  Palette,
  type LucideIcon,
} from "lucide-react";

// ============================================
// TASK TYPES
// ============================================

export interface OnboardingTask {
  /** Unique task identifier */
  id: string;
  /** Display label */
  label: string;
  /** Longer description of the task */
  description: string;
  /** Icon component */
  icon: LucideIcon;
  /** Link to complete the task */
  href: string;
  /** Help documentation link */
  helpHref?: string;
  /** Order in the checklist */
  order: number;
  /** Whether this task can be auto-detected */
  autoDetect: boolean;
  /** Category grouping */
  category: "setup" | "content" | "team";
}

export interface ChecklistStatus {
  /** Task ID */
  taskId: string;
  /** Whether the task is completed */
  completed: boolean;
  /** When it was completed */
  completedAt?: Date;
  /** Whether it was auto-detected */
  autoDetected?: boolean;
}

export interface AgencyChecklistState {
  /** List of task statuses */
  tasks: ChecklistStatus[];
  /** Whether the checklist has been dismissed */
  dismissed: boolean;
  /** When it was dismissed */
  dismissedAt?: Date;
  /** Overall completion percentage */
  completionPercentage: number;
  /** Whether all tasks are complete */
  isComplete: boolean;
}

// ============================================
// TASK DEFINITIONS
// ============================================

export const AGENCY_CHECKLIST_TASKS: OnboardingTask[] = [
  {
    id: "complete_profile",
    label: "Complete your profile",
    description: "Add your name, avatar, and contact information",
    icon: User,
    href: "/dashboard/settings/profile",
    helpHref: "/dashboard/help#profile",
    order: 1,
    autoDetect: true,
    category: "setup",
  },
  {
    id: "invite_creator",
    label: "Invite your first creator",
    description: "Add a creator to start collecting content",
    icon: UserPlus,
    href: "/dashboard/creators/invite",
    helpHref: "/dashboard/help#creators",
    order: 2,
    autoDetect: true,
    category: "content",
  },
  {
    id: "create_template",
    label: "Create a template",
    description: "Set up reusable content request templates",
    icon: FileText,
    href: "/dashboard/templates/new",
    helpHref: "/dashboard/help#templates",
    order: 3,
    autoDetect: true,
    category: "content",
  },
  {
    id: "send_request",
    label: "Send your first request",
    description: "Create and send a content request to a creator",
    icon: Send,
    href: "/dashboard/requests/new",
    helpHref: "/dashboard/help#requests",
    order: 4,
    autoDetect: true,
    category: "content",
  },
  {
    id: "review_upload",
    label: "Review an upload",
    description: "Approve or request changes on submitted content",
    icon: Eye,
    href: "/dashboard/uploads?status=pending",
    helpHref: "/dashboard/help#uploads",
    order: 5,
    autoDetect: true,
    category: "content",
  },
  {
    id: "invite_team_member",
    label: "Invite a team member",
    description: "Add colleagues to help manage your content",
    icon: Users,
    href: "/dashboard/team",
    helpHref: "/dashboard/help#team",
    order: 6,
    autoDetect: true,
    category: "team",
  },
  {
    id: "setup_branding",
    label: "Set up branding",
    description: "Customize your portal with your brand colors and logo",
    icon: Palette,
    href: "/dashboard/settings",
    helpHref: "/dashboard/help#branding",
    order: 7,
    autoDetect: true,
    category: "setup",
  },
];

// Task IDs for easy reference
export const CHECKLIST_TASK_IDS = {
  COMPLETE_PROFILE: "complete_profile",
  INVITE_CREATOR: "invite_creator",
  CREATE_TEMPLATE: "create_template",
  SEND_REQUEST: "send_request",
  REVIEW_UPLOAD: "review_upload",
  INVITE_TEAM_MEMBER: "invite_team_member",
  SETUP_BRANDING: "setup_branding",
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a task by ID
 */
export function getTaskById(taskId: string): OnboardingTask | undefined {
  return AGENCY_CHECKLIST_TASKS.find((task) => task.id === taskId);
}

/**
 * Get tasks by category
 */
export function getTasksByCategory(category: OnboardingTask["category"]): OnboardingTask[] {
  return AGENCY_CHECKLIST_TASKS.filter((task) => task.category === category);
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(completedTaskIds: string[]): number {
  const totalTasks = AGENCY_CHECKLIST_TASKS.length;
  if (totalTasks === 0) return 100;

  const completedCount = completedTaskIds.filter((id) =>
    AGENCY_CHECKLIST_TASKS.some((task) => task.id === id)
  ).length;

  return Math.round((completedCount / totalTasks) * 100);
}

/**
 * Get next incomplete task
 */
export function getNextIncompleteTask(completedTaskIds: string[]): OnboardingTask | null {
  const sortedTasks = [...AGENCY_CHECKLIST_TASKS].sort((a, b) => a.order - b.order);

  for (const task of sortedTasks) {
    if (!completedTaskIds.includes(task.id)) {
      return task;
    }
  }

  return null;
}

/**
 * Check if all tasks are complete
 */
export function isChecklistComplete(completedTaskIds: string[]): boolean {
  return AGENCY_CHECKLIST_TASKS.every((task) => completedTaskIds.includes(task.id));
}

// ============================================
// AUTO-DETECTION QUERY HELPERS
// ============================================

/**
 * Database queries to auto-detect task completion
 * These are used by the API to check if tasks have been completed
 */
export interface AutoDetectionQueries {
  /** Check if user has completed profile */
  hasCompletedProfile: (userId: string) => Promise<boolean>;
  /** Check if agency has invited a creator */
  hasInvitedCreator: (agencyId: string) => Promise<boolean>;
  /** Check if agency has created a template */
  hasCreatedTemplate: (agencyId: string) => Promise<boolean>;
  /** Check if agency has sent a request */
  hasSentRequest: (agencyId: string) => Promise<boolean>;
  /** Check if user has reviewed an upload */
  hasReviewedUpload: (userId: string) => Promise<boolean>;
  /** Check if agency has invited a team member */
  hasInvitedTeamMember: (agencyId: string) => Promise<boolean>;
  /** Check if agency has set up branding */
  hasSetupBranding: (agencyId: string) => Promise<boolean>;
}

// Storage key for checklist state in user preferences
export const CHECKLIST_STORAGE_KEY = "agency_checklist_state";

// Local storage key for dismissed state (client-side)
export const CHECKLIST_DISMISSED_KEY = "agency_checklist_dismissed";
