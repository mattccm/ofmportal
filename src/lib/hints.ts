"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================
// HINT IDS - Register all hints here
// ============================================

export const HINT_IDS = {
  // Dashboard hints
  DASHBOARD_STATS: "dashboard_stats",
  DASHBOARD_ACTIVITY: "dashboard_activity",
  DASHBOARD_QUICK_ACTIONS: "dashboard_quick_actions",
  DASHBOARD_DEADLINES: "dashboard_deadlines",

  // Request hints
  REQUEST_CREATE: "request_create",
  REQUEST_TEMPLATE: "request_template",
  REQUEST_BULK_ACTIONS: "request_bulk_actions",
  REQUEST_FILTERS: "request_filters",
  REQUEST_DUE_DATE: "request_due_date",

  // Creator hints
  CREATOR_INVITE: "creator_invite",
  CREATOR_PORTAL: "creator_portal",
  CREATOR_PERFORMANCE: "creator_performance",
  CREATOR_VAULT: "creator_vault",

  // Upload hints
  UPLOAD_REVIEW: "upload_review",
  UPLOAD_BULK_APPROVE: "upload_bulk_approve",
  UPLOAD_DOWNLOAD: "upload_download",
  UPLOAD_COMMENTS: "upload_comments",

  // Template hints
  TEMPLATE_CREATE: "template_create",
  TEMPLATE_VARIABLES: "template_variables",
  TEMPLATE_DUPLICATE: "template_duplicate",

  // Settings hints
  SETTINGS_NOTIFICATIONS: "settings_notifications",
  SETTINGS_SECURITY: "settings_security",
  SETTINGS_TEAM: "settings_team",
  SETTINGS_BRANDING: "settings_branding",

  // Analytics hints
  ANALYTICS_OVERVIEW: "analytics_overview",
  ANALYTICS_EXPORT: "analytics_export",

  // Feature announcements
  FEATURE_COLLECTIONS: "feature_collections",
  FEATURE_AUTOMATIONS: "feature_automations",
  FEATURE_BULK_REMINDERS: "feature_bulk_reminders",
  FEATURE_DARK_MODE: "feature_dark_mode",
  FEATURE_KEYBOARD_SHORTCUTS: "feature_keyboard_shortcuts",

  // Portal hints (for creators)
  PORTAL_UPLOAD: "portal_upload",
  PORTAL_REQUESTS: "portal_requests",
  PORTAL_MESSAGES: "portal_messages",
  PORTAL_SETTINGS: "portal_settings",
} as const;

export type HintId = (typeof HINT_IDS)[keyof typeof HINT_IDS];

// ============================================
// HINT CONFIGURATION
// ============================================

export interface HintConfig {
  id: HintId;
  title: string;
  description: string;
  isNew?: boolean;
  version?: string;
  learnMoreUrl?: string;
  priority?: "low" | "medium" | "high";
  targetAudience?: "agency" | "creator" | "all";
  releaseDate?: string;
}

export const HINT_CONFIGS: Record<HintId, HintConfig> = {
  // Dashboard hints
  [HINT_IDS.DASHBOARD_STATS]: {
    id: HINT_IDS.DASHBOARD_STATS,
    title: "Quick Stats Overview",
    description: "These cards show your key metrics at a glance. Click on any card to see more details.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.DASHBOARD_ACTIVITY]: {
    id: HINT_IDS.DASHBOARD_ACTIVITY,
    title: "Activity Feed",
    description: "Stay updated with real-time activity from your team. Uploads, comments, and status changes appear here.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.DASHBOARD_QUICK_ACTIONS]: {
    id: HINT_IDS.DASHBOARD_QUICK_ACTIONS,
    title: "Quick Actions",
    description: "Access your most common tasks with one click. Create requests, invite creators, and more.",
    priority: "high",
    targetAudience: "agency",
  },
  [HINT_IDS.DASHBOARD_DEADLINES]: {
    id: HINT_IDS.DASHBOARD_DEADLINES,
    title: "Upcoming Deadlines",
    description: "Keep track of approaching deadlines. Items are color-coded by urgency - red means action needed now.",
    priority: "high",
    targetAudience: "agency",
  },

  // Request hints
  [HINT_IDS.REQUEST_CREATE]: {
    id: HINT_IDS.REQUEST_CREATE,
    title: "Create Content Request",
    description: "Start by selecting a creator and describing what content you need. You can also use templates to save time.",
    priority: "high",
    targetAudience: "agency",
  },
  [HINT_IDS.REQUEST_TEMPLATE]: {
    id: HINT_IDS.REQUEST_TEMPLATE,
    title: "Use Templates",
    description: "Templates save time by pre-filling common request details. Create your own or use our defaults.",
    isNew: true,
    priority: "medium",
    targetAudience: "agency",
    learnMoreUrl: "/dashboard/templates",
  },
  [HINT_IDS.REQUEST_BULK_ACTIONS]: {
    id: HINT_IDS.REQUEST_BULK_ACTIONS,
    title: "Bulk Actions",
    description: "Select multiple requests to perform bulk actions like sending reminders or changing status.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.REQUEST_FILTERS]: {
    id: HINT_IDS.REQUEST_FILTERS,
    title: "Filter & Search",
    description: "Use filters to find specific requests. Filter by status, creator, date, or search by title.",
    priority: "low",
    targetAudience: "agency",
  },
  [HINT_IDS.REQUEST_DUE_DATE]: {
    id: HINT_IDS.REQUEST_DUE_DATE,
    title: "Due Dates",
    description: "Set a due date to help creators prioritize. They'll receive reminders as the deadline approaches.",
    priority: "medium",
    targetAudience: "agency",
  },

  // Creator hints
  [HINT_IDS.CREATOR_INVITE]: {
    id: HINT_IDS.CREATOR_INVITE,
    title: "Invite Creators",
    description: "Send an invitation email with a unique portal link. Creators can set up their account and start uploading.",
    priority: "high",
    targetAudience: "agency",
  },
  [HINT_IDS.CREATOR_PORTAL]: {
    id: HINT_IDS.CREATOR_PORTAL,
    title: "Creator Portal",
    description: "Each creator gets their own branded portal to view requests and upload content securely.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.CREATOR_PERFORMANCE]: {
    id: HINT_IDS.CREATOR_PERFORMANCE,
    title: "Performance Metrics",
    description: "Track creator performance including upload count, approval rate, and response time.",
    priority: "low",
    targetAudience: "agency",
  },
  [HINT_IDS.CREATOR_VAULT]: {
    id: HINT_IDS.CREATOR_VAULT,
    title: "Creator Vault",
    description: "Access all uploads from a specific creator in one place. Perfect for finding past content.",
    isNew: true,
    priority: "medium",
    targetAudience: "agency",
  },

  // Upload hints
  [HINT_IDS.UPLOAD_REVIEW]: {
    id: HINT_IDS.UPLOAD_REVIEW,
    title: "Review Uploads",
    description: "Review each upload by approving, rejecting, or requesting revisions. Add comments for feedback.",
    priority: "high",
    targetAudience: "agency",
  },
  [HINT_IDS.UPLOAD_BULK_APPROVE]: {
    id: HINT_IDS.UPLOAD_BULK_APPROVE,
    title: "Bulk Approve",
    description: "Select multiple uploads to approve them all at once. Great for batch processing.",
    isNew: true,
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.UPLOAD_DOWNLOAD]: {
    id: HINT_IDS.UPLOAD_DOWNLOAD,
    title: "Download Options",
    description: "Download individual files or select multiple to download as a ZIP archive.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.UPLOAD_COMMENTS]: {
    id: HINT_IDS.UPLOAD_COMMENTS,
    title: "Comments & Feedback",
    description: "Leave comments on uploads. Creators will be notified and can respond in the portal.",
    priority: "medium",
    targetAudience: "agency",
  },

  // Template hints
  [HINT_IDS.TEMPLATE_CREATE]: {
    id: HINT_IDS.TEMPLATE_CREATE,
    title: "Create Templates",
    description: "Templates let you save common request configurations. Reuse them to create requests faster.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.TEMPLATE_VARIABLES]: {
    id: HINT_IDS.TEMPLATE_VARIABLES,
    title: "Template Variables",
    description: "Use variables like {{creator_name}} or {{due_date}} to personalize templates automatically.",
    isNew: true,
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.TEMPLATE_DUPLICATE]: {
    id: HINT_IDS.TEMPLATE_DUPLICATE,
    title: "Duplicate Templates",
    description: "Create a copy of any template to customize for different use cases.",
    priority: "low",
    targetAudience: "agency",
  },

  // Settings hints
  [HINT_IDS.SETTINGS_NOTIFICATIONS]: {
    id: HINT_IDS.SETTINGS_NOTIFICATIONS,
    title: "Notification Preferences",
    description: "Control which notifications you receive via email, SMS, or in-app. Customize for each event type.",
    priority: "medium",
    targetAudience: "all",
  },
  [HINT_IDS.SETTINGS_SECURITY]: {
    id: HINT_IDS.SETTINGS_SECURITY,
    title: "Security Settings",
    description: "Enable two-factor authentication and manage your security preferences for added protection.",
    priority: "high",
    targetAudience: "all",
  },
  [HINT_IDS.SETTINGS_TEAM]: {
    id: HINT_IDS.SETTINGS_TEAM,
    title: "Team Management",
    description: "Invite team members and assign roles. Control who can access what in your agency.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.SETTINGS_BRANDING]: {
    id: HINT_IDS.SETTINGS_BRANDING,
    title: "Branding Options",
    description: "Customize the creator portal with your logo and colors. Make it feel like your own.",
    isNew: true,
    priority: "low",
    targetAudience: "agency",
  },

  // Analytics hints
  [HINT_IDS.ANALYTICS_OVERVIEW]: {
    id: HINT_IDS.ANALYTICS_OVERVIEW,
    title: "Analytics Dashboard",
    description: "Get insights into your content operations. Track uploads, approvals, and team performance over time.",
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.ANALYTICS_EXPORT]: {
    id: HINT_IDS.ANALYTICS_EXPORT,
    title: "Export Reports",
    description: "Download analytics data as CSV or PDF. Perfect for sharing with stakeholders or record keeping.",
    priority: "low",
    targetAudience: "agency",
  },

  // Feature announcements
  [HINT_IDS.FEATURE_COLLECTIONS]: {
    id: HINT_IDS.FEATURE_COLLECTIONS,
    title: "Introducing Collections",
    description: "Organize your content into collections. Group related uploads together for easy access and sharing.",
    isNew: true,
    version: "2.0",
    priority: "high",
    targetAudience: "agency",
    releaseDate: "2026-03-15",
  },
  [HINT_IDS.FEATURE_AUTOMATIONS]: {
    id: HINT_IDS.FEATURE_AUTOMATIONS,
    title: "Workflow Automations",
    description: "Set up automatic actions when certain events occur. Auto-approve trusted creators, send scheduled reminders, and more.",
    isNew: true,
    version: "2.0",
    priority: "high",
    targetAudience: "agency",
    releaseDate: "2026-03-20",
  },
  [HINT_IDS.FEATURE_BULK_REMINDERS]: {
    id: HINT_IDS.FEATURE_BULK_REMINDERS,
    title: "Bulk Reminders",
    description: "Send reminders to multiple creators at once. Filter by overdue or upcoming deadlines.",
    isNew: true,
    priority: "medium",
    targetAudience: "agency",
  },
  [HINT_IDS.FEATURE_DARK_MODE]: {
    id: HINT_IDS.FEATURE_DARK_MODE,
    title: "Dark Mode",
    description: "Switch to dark mode for a more comfortable viewing experience. Find it in Settings > Appearance.",
    priority: "low",
    targetAudience: "all",
  },
  [HINT_IDS.FEATURE_KEYBOARD_SHORTCUTS]: {
    id: HINT_IDS.FEATURE_KEYBOARD_SHORTCUTS,
    title: "Keyboard Shortcuts",
    description: "Press ? anywhere to see available keyboard shortcuts. Navigate faster with your keyboard.",
    priority: "low",
    targetAudience: "all",
  },

  // Portal hints
  [HINT_IDS.PORTAL_UPLOAD]: {
    id: HINT_IDS.PORTAL_UPLOAD,
    title: "Upload Content",
    description: "Drag and drop files or click to browse. You can upload multiple files at once.",
    priority: "high",
    targetAudience: "creator",
  },
  [HINT_IDS.PORTAL_REQUESTS]: {
    id: HINT_IDS.PORTAL_REQUESTS,
    title: "Your Requests",
    description: "View all content requests from your agency. Click on any request to see details and upload files.",
    priority: "high",
    targetAudience: "creator",
  },
  [HINT_IDS.PORTAL_MESSAGES]: {
    id: HINT_IDS.PORTAL_MESSAGES,
    title: "Messages",
    description: "Communicate directly with your agency. Ask questions or discuss content requirements.",
    priority: "medium",
    targetAudience: "creator",
  },
  [HINT_IDS.PORTAL_SETTINGS]: {
    id: HINT_IDS.PORTAL_SETTINGS,
    title: "Portal Settings",
    description: "Update your profile, notification preferences, and upload settings.",
    priority: "low",
    targetAudience: "creator",
  },
};

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

const STORAGE_KEY = "uploadportal_hints";
const PERMANENT_DISMISS_KEY = "uploadportal_hints_permanent";

interface HintStorage {
  dismissed: string[];
  lastSeen: Record<string, string>;
  updatedAt: string;
}

function getHintStorage(): HintStorage {
  if (typeof window === "undefined") {
    return { dismissed: [], lastSeen: {}, updatedAt: new Date().toISOString() };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error reading hints from localStorage:", error);
  }

  return { dismissed: [], lastSeen: {}, updatedAt: new Date().toISOString() };
}

function setHintStorage(storage: HintStorage): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error("Error saving hints to localStorage:", error);
  }
}

function getPermanentDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = localStorage.getItem(PERMANENT_DISMISS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (error) {
    console.error("Error reading permanent dismissals:", error);
  }

  return new Set();
}

function setPermanentDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PERMANENT_DISMISS_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error("Error saving permanent dismissals:", error);
  }
}

// ============================================
// HINTS HOOK
// ============================================

export interface UseHintsReturn {
  /** Check if a hint has been dismissed */
  isHintDismissed: (hintId: HintId) => boolean;
  /** Dismiss a hint (will show again after session/storage clear) */
  dismissHint: (hintId: HintId) => void;
  /** Permanently dismiss a hint (won't show again) */
  dismissHintPermanently: (hintId: HintId) => void;
  /** Reset all dismissed hints */
  resetHints: () => void;
  /** Reset only session dismissed hints (not permanent) */
  resetSessionHints: () => void;
  /** Get all new feature hints that haven't been dismissed */
  getNewFeatureHints: () => HintConfig[];
  /** Get hint configuration */
  getHintConfig: (hintId: HintId) => HintConfig | undefined;
  /** Record that a hint was seen (for analytics) */
  markHintSeen: (hintId: HintId) => void;
  /** Get count of undismissed hints */
  undismissedCount: number;
}

export function useHints(): UseHintsReturn {
  const [storage, setStorage] = useState<HintStorage>(() => getHintStorage());
  const [permanentDismissed, setPermanent] = useState<Set<string>>(() => getPermanentDismissed());

  // Sync with localStorage on mount
  useEffect(() => {
    setStorage(getHintStorage());
    setPermanent(getPermanentDismissed());
  }, []);

  const isHintDismissed = useCallback(
    (hintId: HintId): boolean => {
      return storage.dismissed.includes(hintId) || permanentDismissed.has(hintId);
    },
    [storage.dismissed, permanentDismissed]
  );

  const dismissHint = useCallback((hintId: HintId) => {
    setStorage((prev) => {
      const newStorage = {
        ...prev,
        dismissed: [...prev.dismissed, hintId],
        updatedAt: new Date().toISOString(),
      };
      setHintStorage(newStorage);
      return newStorage;
    });
  }, []);

  const dismissHintPermanently = useCallback((hintId: HintId) => {
    setPermanent((prev) => {
      const newSet = new Set(prev);
      newSet.add(hintId);
      setPermanentDismissed(newSet);
      return newSet;
    });

    // Also add to regular dismissed for immediate effect
    dismissHint(hintId);
  }, [dismissHint]);

  const resetHints = useCallback(() => {
    const newStorage: HintStorage = {
      dismissed: [],
      lastSeen: {},
      updatedAt: new Date().toISOString(),
    };
    setHintStorage(newStorage);
    setStorage(newStorage);
    setPermanentDismissed(new Set());
    setPermanent(new Set());
  }, []);

  const resetSessionHints = useCallback(() => {
    const newStorage: HintStorage = {
      dismissed: Array.from(permanentDismissed),
      lastSeen: storage.lastSeen,
      updatedAt: new Date().toISOString(),
    };
    setHintStorage(newStorage);
    setStorage(newStorage);
  }, [permanentDismissed, storage.lastSeen]);

  const getNewFeatureHints = useCallback((): HintConfig[] => {
    return Object.values(HINT_CONFIGS)
      .filter((config) => config.isNew && !isHintDismissed(config.id))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (
          (priorityOrder[a.priority || "low"]) -
          (priorityOrder[b.priority || "low"])
        );
      });
  }, [isHintDismissed]);

  const getHintConfig = useCallback((hintId: HintId): HintConfig | undefined => {
    return HINT_CONFIGS[hintId];
  }, []);

  const markHintSeen = useCallback((hintId: HintId) => {
    setStorage((prev) => {
      const newStorage = {
        ...prev,
        lastSeen: {
          ...prev.lastSeen,
          [hintId]: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
      setHintStorage(newStorage);
      return newStorage;
    });
  }, []);

  const undismissedCount = useMemo(() => {
    return Object.keys(HINT_CONFIGS).filter(
      (id) => !isHintDismissed(id as HintId)
    ).length;
  }, [isHintDismissed]);

  return {
    isHintDismissed,
    dismissHint,
    dismissHintPermanently,
    resetHints,
    resetSessionHints,
    getNewFeatureHints,
    getHintConfig,
    markHintSeen,
    undismissedCount,
  };
}

// ============================================
// HINT TARGETING HELPERS
// ============================================

export function getHintsForAudience(
  audience: "agency" | "creator",
  excludeDismissed?: Set<HintId>
): HintConfig[] {
  return Object.values(HINT_CONFIGS)
    .filter((config) => {
      if (excludeDismissed?.has(config.id)) return false;
      return config.targetAudience === audience || config.targetAudience === "all";
    })
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (
        (priorityOrder[a.priority || "low"]) -
        (priorityOrder[b.priority || "low"])
      );
    });
}

export function getNewFeatures(since?: Date): HintConfig[] {
  return Object.values(HINT_CONFIGS)
    .filter((config) => {
      if (!config.isNew) return false;
      if (since && config.releaseDate) {
        return new Date(config.releaseDate) >= since;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.releaseDate && b.releaseDate) {
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      }
      return 0;
    });
}

export default useHints;
