"use client";

import { SmartSuggestions } from "./smart-suggestions";
import type { SuggestionContext } from "@/lib/suggestions";

interface UploadsSuggestionsProps {
  pendingUploads: number;
  totalUploads: number;
}

export function UploadsSuggestions({
  pendingUploads,
  totalUploads,
}: UploadsSuggestionsProps) {
  // Only show if there are pending uploads to review
  if (pendingUploads === 0) {
    return null;
  }

  const context: Omit<SuggestionContext, "dismissedSuggestions"> = {
    currentPage: "uploads",
    awaitingReview: pendingUploads,
    pendingUploads: totalUploads,
  };

  return (
    <SmartSuggestions
      context={context}
      variant="compact"
      maxSuggestions={1}
    />
  );
}
