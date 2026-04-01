"use client";

import { FileText, Plus, Filter } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO REQUESTS EMPTY STATE
// ============================================

interface NoRequestsProps {
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Whether this is shown when filters are applied */
  isFiltered?: boolean;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
  /** Size variant */
  size?: EmptyStateProps["size"];
  /** Whether to show in card */
  withCard?: boolean;
  /** Optional tab context (drafts, active, completed, archived) */
  tabContext?: "all" | "drafts" | "active" | "completed" | "archived";
}

export function NoRequests({
  title,
  description,
  isFiltered = false,
  onClearFilters,
  size = "default",
  withCard = true,
  tabContext = "all",
}: NoRequestsProps) {
  // Get context-specific messaging
  const getContextMessage = () => {
    switch (tabContext) {
      case "drafts":
        return {
          title: "No draft requests",
          description: "Requests you haven't sent yet will appear here. Create a request and save it as a draft to review later.",
        };
      case "active":
        return {
          title: "No active requests",
          description: "Active requests that are pending, in progress, or awaiting review will appear here.",
        };
      case "completed":
        return {
          title: "No completed requests",
          description: "Requests that have been approved and completed will appear here.",
        };
      case "archived":
        return {
          title: "No archived requests",
          description: "Archived requests will appear here. Archive requests you no longer need to keep your list organized.",
        };
      default:
        return {
          title: "No requests yet",
          description: "Create your first content request to start collecting content from your creators. Requests help you specify exactly what you need.",
        };
    }
  };

  if (isFiltered) {
    return (
      <EmptyState
        icon={Filter}
        title={title || "No matching requests"}
        description={description || "No requests match your current search or filters. Try adjusting your criteria to see more results."}
        iconGradient="muted"
        size={size}
        withCard={withCard}
        action={onClearFilters ? {
          label: "Clear Filters",
          onClick: onClearFilters,
          variant: "outline",
        } : undefined}
      />
    );
  }

  const contextMessage = getContextMessage();

  return (
    <EmptyState
      icon={FileText}
      title={title || contextMessage.title}
      description={description || contextMessage.description}
      iconGradient="primary"
      variant="illustrated"
      size={size}
      withCard={withCard}
      action={
        tabContext === "all" || tabContext === "drafts"
          ? {
              label: "Create Request",
              href: "/dashboard/requests/new",
              icon: Plus,
            }
          : undefined
      }
      secondaryAction={
        tabContext === "all"
          ? {
              label: "Use a Template",
              href: "/dashboard/templates",
              variant: "outline",
            }
          : undefined
      }
    />
  );
}

export default NoRequests;
