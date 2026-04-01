"use client";

import { Upload, Clock, FileStack, Filter } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO UPLOADS EMPTY STATE
// ============================================

interface NoUploadsProps {
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
  /** Context for the empty state */
  context?: "all" | "pending" | "approved" | "rejected" | "request";
}

export function NoUploads({
  title,
  description,
  isFiltered = false,
  onClearFilters,
  size = "default",
  withCard = true,
  context = "all",
}: NoUploadsProps) {
  // Get context-specific messaging
  const getContextMessage = () => {
    switch (context) {
      case "pending":
        return {
          title: "No pending uploads",
          description: "All uploads have been reviewed. Check back later for new submissions from your creators.",
          icon: Clock,
        };
      case "approved":
        return {
          title: "No approved uploads",
          description: "Approved uploads will appear here. Review pending submissions to approve content.",
          icon: Upload,
        };
      case "rejected":
        return {
          title: "No rejected uploads",
          description: "Rejected uploads will appear here. Creators can resubmit improved versions.",
          icon: Upload,
        };
      case "request":
        return {
          title: "Waiting for uploads",
          description: "No uploads have been submitted for this request yet. The creator will upload content when ready.",
          icon: Clock,
        };
      default:
        return {
          title: "No uploads yet",
          description: "Uploads from your creators will appear here once they start submitting content. Create a request to get started.",
          icon: FileStack,
        };
    }
  };

  if (isFiltered) {
    return (
      <EmptyState
        icon={Filter}
        title={title || "No uploads found"}
        description={description || "No uploads match your current filters. Try adjusting your search criteria."}
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
      icon={contextMessage.icon}
      title={title || contextMessage.title}
      description={description || contextMessage.description}
      iconGradient={context === "pending" || context === "request" ? "warning" : "primary"}
      size={size}
      withCard={withCard}
      animated={context === "request"}
      action={
        context === "all"
          ? {
              label: "Create Request",
              href: "/dashboard/requests/new",
            }
          : undefined
      }
    >
      {/* Waiting indicator for request context */}
      {context === "request" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span>Waiting for creator to upload</span>
        </div>
      )}
    </EmptyState>
  );
}

export default NoUploads;
