"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Cloud,
  CloudOff,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import type { AutosaveStatus } from "@/hooks/use-autosave";

/**
 * Props for AutosaveIndicator component
 */
export interface AutosaveIndicatorProps {
  /** Current autosave status */
  status: AutosaveStatus;
  /** Last saved timestamp text */
  lastSavedText?: string;
  /** Whether to show as compact (icon only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the indicator (hide when idle and no lastSavedText) */
  showWhenIdle?: boolean;
}

/**
 * Status configuration for display
 */
const STATUS_CONFIG: Record<
  AutosaveStatus,
  {
    icon: React.ElementType;
    text: string;
    className: string;
    animate?: boolean;
  }
> = {
  idle: {
    icon: Cloud,
    text: "Ready to save",
    className: "text-muted-foreground",
  },
  saving: {
    icon: Loader2,
    text: "Saving...",
    className: "text-blue-600 dark:text-blue-400",
    animate: true,
  },
  saved: {
    icon: CheckCircle,
    text: "All changes saved",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircle,
    text: "Failed to save",
    className: "text-red-600 dark:text-red-400",
  },
  offline: {
    icon: CloudOff,
    text: "Offline - saved locally",
    className: "text-amber-600 dark:text-amber-400",
  },
  conflict: {
    icon: AlertTriangle,
    text: "Unsaved changes found",
    className: "text-amber-600 dark:text-amber-400",
  },
};

/**
 * AutosaveIndicator Component
 *
 * Displays the current autosave status with appropriate icons and text.
 */
export function AutosaveIndicator({
  status,
  lastSavedText,
  compact = false,
  className,
  showWhenIdle = false,
}: AutosaveIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // Don't show when idle unless explicitly requested or there's a lastSavedText
  if (status === "idle" && !showWhenIdle && !lastSavedText) {
    return null;
  }

  // Determine the display text
  const displayText = React.useMemo(() => {
    if (status === "saved" && lastSavedText) {
      return `Saved ${lastSavedText}`;
    }
    return config.text;
  }, [status, lastSavedText, config.text]);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          config.className,
          className
        )}
        title={displayText}
      >
        <Icon
          className={cn("h-4 w-4", config.animate && "animate-spin")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm transition-all duration-300",
        config.className,
        className
      )}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", config.animate && "animate-spin")}
      />
      <span className="truncate">{displayText}</span>
    </div>
  );
}

/**
 * Props for AutosaveStatusBadge component
 */
export interface AutosaveStatusBadgeProps {
  /** Current autosave status */
  status: AutosaveStatus;
  /** Last saved timestamp text */
  lastSavedText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AutosaveStatusBadge Component
 *
 * A badge-style indicator for autosave status, suitable for headers and toolbars.
 */
export function AutosaveStatusBadge({
  status,
  lastSavedText,
  className,
}: AutosaveStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const bgClasses = {
    idle: "bg-muted/50",
    saving: "bg-blue-50 dark:bg-blue-950/50",
    saved: "bg-emerald-50 dark:bg-emerald-950/50",
    error: "bg-red-50 dark:bg-red-950/50",
    offline: "bg-amber-50 dark:bg-amber-950/50",
    conflict: "bg-amber-50 dark:bg-amber-950/50",
  };

  const displayText = React.useMemo(() => {
    if (status === "saved" && lastSavedText) {
      return `Saved ${lastSavedText}`;
    }
    return config.text;
  }, [status, lastSavedText, config.text]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300",
        bgClasses[status],
        config.className,
        className
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", config.animate && "animate-spin")}
      />
      <span>{displayText}</span>
    </div>
  );
}

/**
 * Props for FloatingAutosaveIndicator component
 */
export interface FloatingAutosaveIndicatorProps {
  /** Current autosave status */
  status: AutosaveStatus;
  /** Last saved timestamp text */
  lastSavedText?: string;
  /** Position on screen */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Additional CSS classes */
  className?: string;
  /** Auto-hide after successful save (ms) */
  autoHideDelay?: number;
}

/**
 * FloatingAutosaveIndicator Component
 *
 * A floating indicator that appears in a corner of the screen.
 */
export function FloatingAutosaveIndicator({
  status,
  lastSavedText,
  position = "bottom-right",
  className,
  autoHideDelay = 3000,
}: FloatingAutosaveIndicatorProps) {
  const [visible, setVisible] = React.useState(true);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  React.useEffect(() => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Show indicator when status changes
    setVisible(true);

    // Auto-hide after delay when saved
    if (status === "saved" && autoHideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, autoHideDelay);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [status, autoHideDelay]);

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };

  // Don't render when idle
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300",
        positionClasses[position],
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none",
        className
      )}
    >
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-2.5">
        <AutosaveIndicator status={status} lastSavedText={lastSavedText} />
      </div>
    </div>
  );
}

/**
 * Props for SaveStatusBar component
 */
export interface SaveStatusBarProps {
  /** Current autosave status */
  status: AutosaveStatus;
  /** Last saved timestamp text */
  lastSavedText?: string;
  /** Whether there are unsaved changes */
  hasChanges?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children to render (usually save button) */
  children?: React.ReactNode;
}

/**
 * SaveStatusBar Component
 *
 * A sticky bar that shows save status and optionally contains save actions.
 * Great for forms with a sticky footer.
 */
export function SaveStatusBar({
  status,
  lastSavedText,
  hasChanges = false,
  className,
  children,
}: SaveStatusBarProps) {
  const getMessage = () => {
    if (hasChanges) {
      return "You have unsaved changes";
    }
    if (status === "saved" && lastSavedText) {
      return `Last saved ${lastSavedText}`;
    }
    return "All changes saved";
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border rounded-xl shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {status !== "idle" && (
          <AutosaveIndicator status={status} compact />
        )}
        <p className="text-sm text-muted-foreground">{getMessage()}</p>
      </div>
      {children}
    </div>
  );
}

export default AutosaveIndicator;
