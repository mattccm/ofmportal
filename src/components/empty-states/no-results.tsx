"use client";

import { Search, X, RefreshCw, Filter } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO RESULTS EMPTY STATE (FOR SEARCH)
// ============================================

interface NoResultsProps {
  /** The search query that returned no results */
  searchQuery?: string;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Callback when clear search/filters is clicked */
  onClear?: () => void;
  /** Callback to try again/refresh */
  onRetry?: () => void;
  /** Size variant */
  size?: EmptyStateProps["size"];
  /** Whether to show in card */
  withCard?: boolean;
  /** Type of search context */
  context?: "search" | "filter" | "combined";
}

export function NoResults({
  searchQuery,
  title,
  description,
  onClear,
  onRetry,
  size = "default",
  withCard = true,
  context = "search",
}: NoResultsProps) {
  // Generate contextual messaging
  const getMessage = () => {
    if (searchQuery) {
      return {
        title: `No results for "${searchQuery}"`,
        description: "We couldn't find anything matching your search. Try different keywords or check for typos.",
      };
    }

    switch (context) {
      case "filter":
        return {
          title: "No matching results",
          description: "No items match your current filters. Try adjusting or removing some filters.",
        };
      case "combined":
        return {
          title: "No results found",
          description: "Your search and filters returned no results. Try broadening your criteria.",
        };
      default:
        return {
          title: "No results found",
          description: "We couldn't find what you're looking for. Try a different search term.",
        };
    }
  };

  const defaultMessage = getMessage();

  return (
    <EmptyState
      icon={context === "filter" ? Filter : Search}
      title={title || defaultMessage.title}
      description={description || defaultMessage.description}
      iconGradient="muted"
      size={size}
      withCard={withCard}
      action={onClear ? {
        label: searchQuery ? "Clear Search" : "Clear Filters",
        onClick: onClear,
        icon: X,
        variant: "outline",
      } : undefined}
      secondaryAction={onRetry ? {
        label: "Try Again",
        onClick: onRetry,
        icon: RefreshCw,
        variant: "ghost",
      } : undefined}
    >
      {/* Search tips */}
      {searchQuery && (
        <div className="mt-4 text-left w-full max-w-sm">
          <p className="text-xs font-medium text-muted-foreground mb-2">Search tips:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-primary">-</span>
              <span>Check your spelling</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">-</span>
              <span>Try more general terms</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">-</span>
              <span>Use fewer keywords</span>
            </li>
          </ul>
        </div>
      )}
    </EmptyState>
  );
}

export default NoResults;
