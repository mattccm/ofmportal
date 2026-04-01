/**
 * Smart Suggestions System
 *
 * A context-aware suggestion engine that provides helpful,
 * non-intrusive recommendations based on user behavior and data state.
 */

export type SuggestionType = 'optimize_workflow' | 'try_feature' | 'fix_issue' | 'action_needed';

export type SuggestionPriority = 'low' | 'medium' | 'high';

export type SuggestionCategory =
  | 'pending_reviews'
  | 'inactive_creators'
  | 'overdue_requests'
  | 'pending_requests'
  | 'no_templates'
  | 'bulk_reminders'
  | 'analytics'
  | 'team_invite'
  | 'onboarding';

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  learnMoreHref?: string;
  icon: string; // Lucide icon name
  contextData?: Record<string, unknown>;
  dismissible: boolean;
}

export interface SuggestionContext {
  // Dashboard stats
  pendingRequests?: number;
  awaitingReview?: number;
  overdueItems?: number;
  activeCreators?: number;
  totalTemplates?: number;
  teamMembers?: number;

  // Creator-specific context
  creatorsWithoutActivity?: Array<{
    id: string;
    name: string;
    daysSinceLastSubmission: number;
  }>;

  // Upload-specific context
  pendingUploads?: number;
  uploadsAwaitingAction?: number;

  // Feature usage
  hasUsedTemplates?: boolean;
  hasUsedReminders?: boolean;
  hasUsedAnalytics?: boolean;
  hasUsedCollections?: boolean;

  // Current page context
  currentPage: 'dashboard' | 'creators' | 'uploads' | 'requests' | 'templates' | 'settings' | 'other';

  // User preferences
  dismissedSuggestions: string[];
}

// Storage key for dismissed suggestions
const DISMISSED_SUGGESTIONS_KEY = 'uploadportal_dismissed_suggestions';

/**
 * Get dismissed suggestions from localStorage
 */
export function getDismissedSuggestions(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Dismiss a suggestion (stored in localStorage)
 */
export function dismissSuggestion(suggestionId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const dismissed = getDismissedSuggestions();
    if (!dismissed.includes(suggestionId)) {
      dismissed.push(suggestionId);
      localStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(dismissed));
    }
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Clear all dismissed suggestions
 */
export function clearDismissedSuggestions(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(DISMISSED_SUGGESTIONS_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Generate a unique suggestion ID based on category and context
 */
function generateSuggestionId(category: SuggestionCategory, contextKey?: string): string {
  return contextKey ? `${category}_${contextKey}` : category;
}

/**
 * Suggestion rules engine - generates suggestions based on context
 */
export function generateSuggestions(context: SuggestionContext): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const { dismissedSuggestions, currentPage } = context;

  // Helper to check if suggestion should be shown
  const shouldShow = (id: string): boolean => !dismissedSuggestions.includes(id);

  // ===========================================
  // HIGH PRIORITY - Action Needed Suggestions
  // ===========================================

  // Pending uploads need review
  if (context.awaitingReview && context.awaitingReview > 0) {
    const id = generateSuggestionId('pending_reviews');
    if (shouldShow(id) && ['dashboard', 'uploads'].includes(currentPage)) {
      suggestions.push({
        id,
        category: 'pending_reviews',
        type: 'action_needed',
        priority: 'high',
        title: `${context.awaitingReview} upload${context.awaitingReview > 1 ? 's are' : ' is'} awaiting review`,
        description: 'Content has been submitted and needs your approval before it can be used.',
        actionLabel: 'Review uploads',
        actionHref: '/dashboard/uploads?status=pending',
        icon: 'Eye',
        dismissible: true,
      });
    }
  }

  // Overdue requests
  if (context.overdueItems && context.overdueItems > 0) {
    const id = generateSuggestionId('overdue_requests');
    if (shouldShow(id) && ['dashboard', 'requests'].includes(currentPage)) {
      suggestions.push({
        id,
        category: 'overdue_requests',
        type: 'fix_issue',
        priority: 'high',
        title: `${context.overdueItems} request${context.overdueItems > 1 ? 's are' : ' is'} overdue`,
        description: 'These requests have passed their due date and may need attention or rescheduling.',
        actionLabel: 'View overdue',
        actionHref: '/dashboard/requests?status=overdue',
        icon: 'AlertTriangle',
        dismissible: true,
      });
    }
  }

  // Pending requests need action
  if (context.pendingRequests && context.pendingRequests >= 5) {
    const id = generateSuggestionId('pending_requests');
    if (shouldShow(id) && currentPage === 'dashboard') {
      suggestions.push({
        id,
        category: 'pending_requests',
        type: 'action_needed',
        priority: 'medium',
        title: `You have ${context.pendingRequests} pending requests`,
        description: 'Review these requests to keep your content workflow moving smoothly.',
        actionLabel: 'Review requests',
        actionHref: '/dashboard/requests?status=pending',
        icon: 'FileText',
        dismissible: true,
      });
    }
  }

  // ===========================================
  // MEDIUM PRIORITY - Workflow Optimization
  // ===========================================

  // Inactive creators
  if (context.creatorsWithoutActivity && context.creatorsWithoutActivity.length > 0) {
    const inactiveCount = context.creatorsWithoutActivity.length;
    const longestInactive = context.creatorsWithoutActivity[0];

    if (longestInactive && longestInactive.daysSinceLastSubmission >= 14) {
      const id = generateSuggestionId('inactive_creators', longestInactive.id);
      if (shouldShow(id) && ['dashboard', 'creators'].includes(currentPage)) {
        suggestions.push({
          id,
          category: 'inactive_creators',
          type: 'optimize_workflow',
          priority: 'medium',
          title: inactiveCount > 1
            ? `${inactiveCount} creators haven't submitted recently`
            : `${longestInactive.name} hasn't submitted in ${longestInactive.daysSinceLastSubmission} days`,
          description: 'Consider sending a friendly reminder to keep content flowing.',
          actionLabel: 'Send reminder',
          actionHref: '/dashboard/reminders',
          icon: 'Bell',
          contextData: {
            creatorId: longestInactive.id,
            creatorName: longestInactive.name,
            daysSinceLastSubmission: longestInactive.daysSinceLastSubmission
          },
          dismissible: true,
        });
      }
    }
  }

  // Suggest bulk reminders when multiple pending
  if (context.pendingRequests && context.pendingRequests >= 3 && !context.hasUsedReminders) {
    const id = generateSuggestionId('bulk_reminders');
    if (shouldShow(id) && ['dashboard', 'requests'].includes(currentPage)) {
      suggestions.push({
        id,
        category: 'bulk_reminders',
        type: 'try_feature',
        priority: 'low',
        title: 'Save time with bulk reminders',
        description: 'Send reminders to multiple creators at once to speed up your workflow.',
        actionLabel: 'Try reminders',
        actionHref: '/dashboard/reminders',
        learnMoreHref: '/dashboard/help#reminders',
        icon: 'Zap',
        dismissible: true,
      });
    }
  }

  // ===========================================
  // LOW PRIORITY - Feature Discovery
  // ===========================================

  // Suggest templates if not used
  if (context.totalTemplates === 0 && context.activeCreators && context.activeCreators > 0) {
    const id = generateSuggestionId('no_templates');
    if (shouldShow(id) && ['dashboard', 'requests', 'templates'].includes(currentPage)) {
      suggestions.push({
        id,
        category: 'no_templates',
        type: 'try_feature',
        priority: 'low',
        title: 'Create consistent requests with templates',
        description: 'Save time by creating reusable templates for common content requests.',
        actionLabel: 'Create template',
        actionHref: '/dashboard/templates/new',
        learnMoreHref: '/dashboard/help#templates',
        icon: 'Layout',
        dismissible: true,
      });
    }
  }

  // Suggest analytics
  if (!context.hasUsedAnalytics && context.activeCreators && context.activeCreators >= 3) {
    const id = generateSuggestionId('analytics');
    if (shouldShow(id) && currentPage === 'dashboard') {
      suggestions.push({
        id,
        category: 'analytics',
        type: 'try_feature',
        priority: 'low',
        title: 'Track your content performance',
        description: 'See insights about creator activity, approval rates, and more.',
        actionLabel: 'View analytics',
        actionHref: '/dashboard/analytics',
        icon: 'BarChart3',
        dismissible: true,
      });
    }
  }

  // Suggest team invites for solo users
  if (context.teamMembers === 1 && context.activeCreators && context.activeCreators >= 5) {
    const id = generateSuggestionId('team_invite');
    if (shouldShow(id) && currentPage === 'dashboard') {
      suggestions.push({
        id,
        category: 'team_invite',
        type: 'try_feature',
        priority: 'low',
        title: 'Collaborate with your team',
        description: 'Invite team members to help manage creators and review content.',
        actionLabel: 'Invite team',
        actionHref: '/dashboard/team',
        icon: 'Users',
        dismissible: true,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<SuggestionPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}

/**
 * Filter suggestions by type
 */
export function filterSuggestionsByType(
  suggestions: Suggestion[],
  types: SuggestionType[]
): Suggestion[] {
  return suggestions.filter(s => types.includes(s.type));
}

/**
 * Get the maximum number of suggestions to show based on page
 */
export function getMaxSuggestionsForPage(page: SuggestionContext['currentPage']): number {
  switch (page) {
    case 'dashboard':
      return 3;
    case 'creators':
    case 'uploads':
    case 'requests':
      return 2;
    default:
      return 1;
  }
}

/**
 * Get contextual suggestions for a specific page with limits
 */
export function getSuggestionsForPage(
  context: SuggestionContext
): Suggestion[] {
  const allSuggestions = generateSuggestions(context);
  const maxSuggestions = getMaxSuggestionsForPage(context.currentPage);

  return allSuggestions.slice(0, maxSuggestions);
}
