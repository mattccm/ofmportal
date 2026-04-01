"use client";

import { SmartSuggestions } from "./smart-suggestions";
import type { SuggestionContext } from "@/lib/suggestions";

interface RequestsSuggestionsProps {
  pendingRequests: number;
  overdueRequests: number;
}

export function RequestsSuggestions({
  pendingRequests,
  overdueRequests,
}: RequestsSuggestionsProps) {
  // Only show if there are actionable items
  if (pendingRequests === 0 && overdueRequests === 0) {
    return null;
  }

  const context: Omit<SuggestionContext, "dismissedSuggestions"> = {
    currentPage: "requests",
    pendingRequests,
    overdueItems: overdueRequests,
  };

  return (
    <SmartSuggestions
      context={context}
      variant="compact"
      maxSuggestions={2}
    />
  );
}
