"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionPriority, SuggestionType } from "@/lib/suggestions";
import {
  X,
  Eye,
  AlertTriangle,
  FileText,
  Bell,
  Zap,
  Layout,
  BarChart3,
  Users,
  ExternalLink,
  Lightbulb,
  Wrench,
  Target,
  CheckCircle2,
} from "lucide-react";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onDismiss?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  AlertTriangle,
  FileText,
  Bell,
  Zap,
  Layout,
  BarChart3,
  Users,
  Lightbulb,
  Wrench,
  Target,
  CheckCircle2,
};

// Get styles based on suggestion type
function getTypeStyles(type: SuggestionType): {
  border: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  accentBorder: string;
} {
  switch (type) {
    case "fix_issue":
      return {
        border: "border-red-200 dark:border-red-800/50",
        bg: "bg-gradient-to-br from-red-50/50 to-orange-50/30 dark:from-red-950/20 dark:to-orange-950/10",
        iconBg: "bg-gradient-to-br from-red-500 to-orange-500",
        iconColor: "text-white",
        accentBorder: "border-l-red-500",
      };
    case "action_needed":
      return {
        border: "border-amber-200 dark:border-amber-800/50",
        bg: "bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10",
        iconBg: "bg-gradient-to-br from-amber-500 to-yellow-500",
        iconColor: "text-white",
        accentBorder: "border-l-amber-500",
      };
    case "optimize_workflow":
      return {
        border: "border-blue-200 dark:border-blue-800/50",
        bg: "bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10",
        iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
        iconColor: "text-white",
        accentBorder: "border-l-blue-500",
      };
    case "try_feature":
    default:
      return {
        border: "border-violet-200 dark:border-violet-800/50",
        bg: "bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10",
        iconBg: "bg-gradient-to-br from-violet-500 to-purple-500",
        iconColor: "text-white",
        accentBorder: "border-l-violet-500",
      };
  }
}

// Get badge for priority
function getPriorityBadge(priority: SuggestionPriority): {
  label: string;
  className: string;
} | null {
  switch (priority) {
    case "high":
      return {
        label: "Important",
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
      };
    case "medium":
      return {
        label: "Recommended",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    default:
      return null; // Don't show badge for low priority
  }
}

// Get type label
function getTypeLabel(type: SuggestionType): string {
  switch (type) {
    case "fix_issue":
      return "Needs attention";
    case "action_needed":
      return "Action needed";
    case "optimize_workflow":
      return "Tip";
    case "try_feature":
      return "Discover";
  }
}

export function SuggestionCard({
  suggestion,
  onDismiss,
  compact = false,
  className,
}: SuggestionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const styles = getTypeStyles(suggestion.type);
  const priorityBadge = getPriorityBadge(suggestion.priority);
  const IconComponent = iconMap[suggestion.icon] || Lightbulb;

  const handleDismiss = () => {
    setIsDismissing(true);
    // Small delay for animation
    setTimeout(() => {
      onDismiss?.(suggestion.id);
    }, 200);
  };

  if (compact) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
          styles.border,
          styles.bg,
          "hover:shadow-sm",
          isDismissing && "opacity-0 scale-95",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center shadow-sm",
            styles.iconBg
          )}
        >
          <IconComponent className={cn("h-4 w-4", styles.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {suggestion.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {suggestion.description}
          </p>
        </div>

        {/* Action */}
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="flex-shrink-0 h-8 text-primary hover:text-primary hover:bg-primary/10"
        >
          <Link href={suggestion.actionHref}>
            {suggestion.actionLabel}
          </Link>
        </Button>

        {/* Dismiss */}
        {suggestion.dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className={cn(
              "flex-shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground transition-opacity",
              isHovered ? "opacity-100" : "opacity-0 md:opacity-0"
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss suggestion</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 border-l-4",
        styles.border,
        styles.bg,
        styles.accentBorder,
        "hover:shadow-md",
        isDismissing && "opacity-0 scale-95",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              "flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-105",
              styles.iconBg
            )}
          >
            <IconComponent className={cn("h-5 w-5", styles.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header with type label and badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {getTypeLabel(suggestion.type)}
              </span>
              {priorityBadge && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityBadge.className)}>
                  {priorityBadge.label}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-semibold text-foreground mb-1">
              {suggestion.title}
            </h4>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-3">
              {suggestion.description}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                asChild
                className="h-8 text-xs"
              >
                <Link href={suggestion.actionHref}>
                  {suggestion.actionLabel}
                </Link>
              </Button>

              {suggestion.learnMoreHref && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Link href={suggestion.learnMoreHref}>
                    Learn more
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          {suggestion.dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className={cn(
                "flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-opacity rounded-full",
                isHovered ? "opacity-100" : "opacity-0 md:opacity-0"
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss suggestion</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Export a simpler inline suggestion for use in other contexts
export function InlineSuggestion({
  suggestion,
  onDismiss,
  className,
}: SuggestionCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const styles = getTypeStyles(suggestion.type);
  const IconComponent = iconMap[suggestion.icon] || Lightbulb;

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss?.(suggestion.id);
    }, 200);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
        styles.border,
        styles.bg,
        isDismissing && "opacity-0 scale-95",
        className
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
          styles.iconBg
        )}
      >
        <IconComponent className={cn("h-4 w-4", styles.iconColor)} />
      </div>

      <p className="flex-1 text-sm text-foreground">
        {suggestion.title}
      </p>

      <Button
        variant="link"
        size="sm"
        asChild
        className="flex-shrink-0 h-auto p-0 text-primary"
      >
        <Link href={suggestion.actionHref}>
          {suggestion.actionLabel}
        </Link>
      </Button>

      {suggestion.dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="flex-shrink-0 h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
