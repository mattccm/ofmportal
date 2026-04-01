"use client";

import { FileText, Plus, Layers, Filter, Zap } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO TEMPLATES EMPTY STATE
// ============================================

interface NoTemplatesProps {
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
  /** Filter context */
  filterContext?: "active" | "inactive" | "search";
}

export function NoTemplates({
  title,
  description,
  isFiltered = false,
  onClearFilters,
  size = "default",
  withCard = true,
  filterContext,
}: NoTemplatesProps) {
  // When filters are applied
  if (isFiltered) {
    const filterMessage = () => {
      switch (filterContext) {
        case "active":
          return "No active templates found. Activate a template to use it for new requests.";
        case "inactive":
          return "No inactive templates found. Deactivate templates you're not currently using.";
        case "search":
          return "No templates match your search. Try different keywords.";
        default:
          return "No templates match your current filters. Try adjusting your criteria.";
      }
    };

    return (
      <EmptyState
        icon={Filter}
        title={title || "No templates found"}
        description={description || filterMessage()}
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

  // Default - no templates yet
  return (
    <EmptyState
      icon={Layers}
      title={title || "No templates yet"}
      description={
        description ||
        "Templates help you create consistent content requests. Define the fields and requirements once, then reuse them for future requests."
      }
      iconGradient="primary"
      variant="illustrated"
      size={size}
      withCard={withCard}
      action={{
        label: "Create Template",
        href: "/dashboard/templates/new",
        icon: Plus,
      }}
      secondaryAction={{
        label: "Learn More",
        href: "/help/templates",
        variant: "ghost",
      }}
    >
      {/* Benefits list */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>Custom fields</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Faster creation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>Reusable</span>
        </div>
      </div>
    </EmptyState>
  );
}

export default NoTemplates;
