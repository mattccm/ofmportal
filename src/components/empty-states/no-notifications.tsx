"use client";

import { Bell, CheckCircle2, Settings, Sparkles } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "./empty-state";

// ============================================
// NO NOTIFICATIONS EMPTY STATE
// ============================================

interface NoNotificationsProps {
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Whether this is shown when filters are applied */
  isFiltered?: boolean;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
  /** Whether the user has no notifications at all (success state) */
  allCaughtUp?: boolean;
  /** Size variant */
  size?: EmptyStateProps["size"];
  /** Whether to show in card */
  withCard?: boolean;
}

export function NoNotifications({
  title,
  description,
  isFiltered = false,
  onClearFilters,
  allCaughtUp = true,
  size = "default",
  withCard = true,
}: NoNotificationsProps) {
  // When filters are applied and no results
  if (isFiltered) {
    return (
      <EmptyState
        icon={Bell}
        title={title || "No matching notifications"}
        description={description || "No notifications match your current filters. Try adjusting your search criteria."}
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

  // Success state - all caught up!
  if (allCaughtUp) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={title || "All caught up!"}
        description={
          description ||
          "You've seen all your notifications. We'll let you know when something new happens."
        }
        iconGradient="success"
        variant="success"
        size={size}
        withCard={withCard}
        action={{
          label: "Notification Settings",
          href: "/dashboard/settings/notifications",
          icon: Settings,
          variant: "outline",
        }}
      >
        {/* Celebratory element */}
        <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm mt-2">
          <Sparkles className="h-4 w-4" />
          <span>You're on top of things!</span>
        </div>
      </EmptyState>
    );
  }

  // Default - no notifications ever
  return (
    <EmptyState
      icon={Bell}
      title={title || "No notifications yet"}
      description={
        description ||
        "Notifications about uploads, requests, and team activity will appear here. Stay tuned!"
      }
      iconGradient="primary"
      size={size}
      withCard={withCard}
      action={{
        label: "Notification Settings",
        href: "/dashboard/settings/notifications",
        icon: Settings,
        variant: "outline",
      }}
    />
  );
}

export default NoNotifications;
