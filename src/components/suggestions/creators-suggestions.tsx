"use client";

import { SmartSuggestions } from "./smart-suggestions";
import type { SuggestionContext } from "@/lib/suggestions";

interface CreatorsSuggestionsProps {
  inactiveCreators: Array<{
    id: string;
    name: string;
    daysSinceLastSubmission: number;
  }>;
  totalCreators: number;
}

export function CreatorsSuggestions({
  inactiveCreators,
  totalCreators,
}: CreatorsSuggestionsProps) {
  // Only show suggestions if there are inactive creators
  if (inactiveCreators.length === 0) {
    return null;
  }

  const context: Omit<SuggestionContext, "dismissedSuggestions"> = {
    currentPage: "creators",
    activeCreators: totalCreators,
    creatorsWithoutActivity: inactiveCreators,
    hasUsedReminders: false,
  };

  return (
    <SmartSuggestions
      context={context}
      variant="compact"
      maxSuggestions={2}
    />
  );
}
