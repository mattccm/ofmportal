"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

export type AnnouncementType = "INFO" | "WARNING" | "SUCCESS" | "PROMO";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  actionText?: string | null;
  actionUrl?: string | null;
  isPinned?: boolean;
  startDate: string;
  endDate?: string | null;
}

interface AnnouncementBannerProps {
  announcement: Announcement;
  onDismiss?: (id: string) => void;
  className?: string;
}

const typeConfig: Record<
  AnnouncementType,
  {
    icon: React.ElementType;
    bgClass: string;
    borderClass: string;
    textClass: string;
    iconClass: string;
    buttonClass: string;
  }
> = {
  INFO: {
    icon: Info,
    bgClass: "bg-blue-50/80 dark:bg-blue-950/30",
    borderClass: "border-blue-200/60 dark:border-blue-800/40",
    textClass: "text-blue-900 dark:text-blue-100",
    iconClass: "text-blue-500",
    buttonClass:
      "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600",
  },
  WARNING: {
    icon: AlertTriangle,
    bgClass: "bg-amber-50/80 dark:bg-amber-950/30",
    borderClass: "border-amber-200/60 dark:border-amber-800/40",
    textClass: "text-amber-900 dark:text-amber-100",
    iconClass: "text-amber-500",
    buttonClass:
      "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600",
  },
  SUCCESS: {
    icon: CheckCircle,
    bgClass: "bg-emerald-50/80 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200/60 dark:border-emerald-800/40",
    textClass: "text-emerald-900 dark:text-emerald-100",
    iconClass: "text-emerald-500",
    buttonClass:
      "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600",
  },
  PROMO: {
    icon: Sparkles,
    bgClass:
      "bg-gradient-to-r from-violet-50/80 via-purple-50/80 to-fuchsia-50/80 dark:from-violet-950/40 dark:via-purple-950/40 dark:to-fuchsia-950/40",
    borderClass:
      "border-violet-200/60 dark:border-violet-800/40 border-l-4 border-l-violet-500",
    textClass: "text-violet-900 dark:text-violet-100",
    iconClass: "text-violet-500",
    buttonClass:
      "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white",
  },
};

export function AnnouncementBanner({
  announcement,
  onDismiss,
  className,
}: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false);

  const config = typeConfig[announcement.type];
  const Icon = config.icon;

  const handleDismiss = React.useCallback(() => {
    setIsAnimatingOut(true);
    // Wait for animation to complete before removing
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.(announcement.id);
    }, 300);
  }, [announcement.id, onDismiss]);

  if (!isVisible) {
    return null;
  }

  const isExternalLink =
    announcement.actionUrl?.startsWith("http") ||
    announcement.actionUrl?.startsWith("//");

  return (
    <div
      className={cn(
        "w-full border-b transition-all duration-300 ease-out",
        config.bgClass,
        config.borderClass,
        isAnimatingOut
          ? "opacity-0 -translate-y-2 h-0 overflow-hidden"
          : "opacity-100 translate-y-0 animate-slide-down",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-[1600px] mx-auto px-4 py-3 md:px-6">
        <div className="flex items-start gap-3 md:items-center">
          {/* Icon */}
          <div
            className={cn(
              "shrink-0 mt-0.5 md:mt-0 p-1.5 rounded-full",
              announcement.type === "PROMO"
                ? "bg-violet-100 dark:bg-violet-900/50"
                : ""
            )}
          >
            <Icon className={cn("h-4 w-4 md:h-5 md:w-5", config.iconClass)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              {/* Title and message */}
              <div className="flex-1 min-w-0">
                <span className={cn("font-semibold text-sm", config.textClass)}>
                  {announcement.title}
                </span>
                {announcement.message && (
                  <span
                    className={cn(
                      "ml-2 text-sm opacity-90",
                      config.textClass
                    )}
                  >
                    {announcement.message}
                  </span>
                )}
              </div>

              {/* Action button */}
              {announcement.actionText && announcement.actionUrl && (
                <div className="shrink-0 mt-2 md:mt-0">
                  {isExternalLink ? (
                    <a
                      href={announcement.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 shadow-sm hover:shadow",
                        config.buttonClass
                      )}
                    >
                      {announcement.actionText}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Link
                      href={announcement.actionUrl}
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 shadow-sm hover:shadow",
                        config.buttonClass
                      )}
                    >
                      {announcement.actionText}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDismiss}
              className={cn(
                "shrink-0 h-7 w-7 rounded-full opacity-60 hover:opacity-100 transition-opacity",
                config.textClass
              )}
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Container for multiple announcements
interface AnnouncementStackProps {
  announcements: Announcement[];
  onDismiss?: (id: string) => void;
  className?: string;
  maxVisible?: number;
}

export function AnnouncementStack({
  announcements,
  onDismiss,
  className,
  maxVisible = 3,
}: AnnouncementStackProps) {
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    new Set()
  );

  const visibleAnnouncements = React.useMemo(() => {
    return announcements
      .filter((a) => !dismissedIds.has(a.id))
      .slice(0, maxVisible);
  }, [announcements, dismissedIds, maxVisible]);

  const handleDismiss = React.useCallback(
    (id: string) => {
      setDismissedIds((prev) => new Set([...prev, id]));
      onDismiss?.(id);
    },
    [onDismiss]
  );

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {visibleAnnouncements.map((announcement) => (
        <AnnouncementBanner
          key={announcement.id}
          announcement={announcement}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

// CSS animation keyframes (add to globals.css if not present)
// @keyframes slide-down {
//   from {
//     opacity: 0;
//     transform: translateY(-10px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }
// .animate-slide-down {
//   animation: slide-down 0.3s ease-out;
// }
