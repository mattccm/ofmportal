"use client";

import { SmartSuggestions } from "./smart-suggestions";
import type { SuggestionContext } from "@/lib/suggestions";

interface DashboardSuggestionsProps {
  stats: {
    activeCreators: number;
    pendingRequests: number;
    awaitingReview: number;
    overdueItems: number;
  };
  inactiveCreators?: Array<{
    id: string;
    name: string;
    daysSinceLastSubmission: number;
  }>;
  totalTemplates?: number;
  teamMembers?: number;
  hasUsedReminders?: boolean;
  hasUsedAnalytics?: boolean;
}

export function DashboardSuggestions({
  stats,
  inactiveCreators = [],
  totalTemplates = 0,
  teamMembers = 1,
  hasUsedReminders = false,
  hasUsedAnalytics = false,
}: DashboardSuggestionsProps) {
  const context: Omit<SuggestionContext, "dismissedSuggestions"> = {
    currentPage: "dashboard",
    activeCreators: stats.activeCreators,
    pendingRequests: stats.pendingRequests,
    awaitingReview: stats.awaitingReview,
    overdueItems: stats.overdueItems,
    creatorsWithoutActivity: inactiveCreators,
    totalTemplates,
    teamMembers,
    hasUsedReminders,
    hasUsedAnalytics,
  };

  return (
    <SmartSuggestions
      context={context}
      title="Suggested for you"
      collapsible
      maxSuggestions={3}
    />
  );
}
