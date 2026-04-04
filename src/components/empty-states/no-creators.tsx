"use client";

import { Users, UserPlus, Mail, Link as LinkIcon } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO CREATORS EMPTY STATE
// ============================================

interface NoCreatorsProps {
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
}

export function NoCreators({
  title,
  description,
  isFiltered = false,
  onClearFilters,
  size = "default",
  withCard = true,
}: NoCreatorsProps) {
  if (isFiltered) {
    return (
      <EmptyState
        icon={Users}
        title={title || "No creators found"}
        description={description || "No creators match your current search or filters. Try adjusting your criteria."}
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

  return (
    <EmptyState
      icon={Users}
      title={title || "No creators yet"}
      description={
        description ||
        "Get started by inviting your first creator. They'll receive an email with instructions to set up their account and start submitting content."
      }
      iconGradient="primary"
      variant="illustrated"
      size={size}
      withCard={withCard}
      action={{
        label: "Invite Creator",
        href: "/dashboard/creators/invite",
        icon: UserPlus,
      }}
      secondaryAction={{
        label: "View Invitations",
        href: "/dashboard/creators?tab=invitations",
        variant: "ghost",
      }}
    >
      {/* Additional tips */}
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          <span>Email invites</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" />
          <span>Shareable links</span>
        </div>
      </div>
    </EmptyState>
  );
}

export default NoCreators;
