"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// TYPES
// ============================================

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export interface EmptyStateProps {
  /** Icon to display in the empty state */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  /** Description text below the title */
  description: string;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action (link or button) */
  secondaryAction?: EmptyStateAction;
  /** Visual variant of the empty state */
  variant?: "default" | "success" | "muted" | "illustrated";
  /** Icon gradient colors - defaults to primary */
  iconGradient?: "primary" | "success" | "warning" | "info" | "muted";
  /** Whether to wrap in a Card component */
  withCard?: boolean;
  /** Additional class names */
  className?: string;
  /** Whether to animate the icon */
  animated?: boolean;
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Custom children below actions */
  children?: React.ReactNode;
}

// ============================================
// GRADIENT CONFIGS
// ============================================

const ICON_GRADIENTS = {
  primary: "from-primary/20 to-violet-500/20",
  success: "from-emerald-500/20 to-green-500/20",
  warning: "from-amber-500/20 to-orange-500/20",
  info: "from-blue-500/20 to-cyan-500/20",
  muted: "from-muted to-muted/50",
};

const ICON_COLORS = {
  primary: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
  muted: "text-muted-foreground",
};

const SIZES = {
  sm: {
    container: "py-8",
    iconWrapper: "h-12 w-12 rounded-xl",
    icon: "h-6 w-6",
    title: "text-base",
    description: "text-sm",
    button: "h-9",
  },
  default: {
    container: "py-12",
    iconWrapper: "h-16 w-16 rounded-2xl",
    icon: "h-8 w-8",
    title: "text-lg",
    description: "text-sm",
    button: "h-10",
  },
  lg: {
    container: "py-16",
    iconWrapper: "h-20 w-20 rounded-2xl",
    icon: "h-10 w-10",
    title: "text-xl",
    description: "text-base",
    button: "h-11",
  },
};

// ============================================
// ILLUSTRATION PATTERNS (SVG backgrounds)
// ============================================

function IllustrationPattern({ variant }: { variant: "primary" | "success" | "muted" }) {
  const colors = {
    primary: { stroke: "stroke-primary/10", fill: "fill-primary/5" },
    success: { stroke: "stroke-emerald-500/10", fill: "fill-emerald-500/5" },
    muted: { stroke: "stroke-muted-foreground/10", fill: "fill-muted/30" },
  };

  const { stroke, fill } = colors[variant];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute -top-1/2 -right-1/4 w-full h-full opacity-50"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Decorative circles */}
        <circle cx="200" cy="200" r="150" className={cn(stroke, "stroke-[1]")} strokeDasharray="8 8" />
        <circle cx="200" cy="200" r="100" className={cn(stroke, "stroke-[1]")} strokeDasharray="4 4" />
        <circle cx="200" cy="200" r="50" className={cn(fill)} />

        {/* Floating dots */}
        <circle cx="320" cy="150" r="4" className={fill} />
        <circle cx="80" cy="250" r="6" className={fill} />
        <circle cx="300" cy="320" r="3" className={fill} />
        <circle cx="120" cy="100" r="5" className={fill} />
      </svg>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  iconGradient = "primary",
  withCard = true,
  className,
  animated = false,
  size = "default",
  children,
}: EmptyStateProps) {
  const sizeConfig = SIZES[size];
  const gradientClass = ICON_GRADIENTS[iconGradient];
  const iconColorClass = ICON_COLORS[iconGradient];

  const content = (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center text-center px-4",
        sizeConfig.container,
        variant === "illustrated" && "overflow-hidden",
        className
      )}
    >
      {/* Illustration background for illustrated variant */}
      {variant === "illustrated" && (
        <IllustrationPattern
          variant={iconGradient === "success" ? "success" : iconGradient === "muted" ? "muted" : "primary"}
        />
      )}

      {/* Icon Container */}
      <div
        className={cn(
          "relative mx-auto flex items-center justify-center mb-4",
          sizeConfig.iconWrapper,
          `bg-gradient-to-br ${gradientClass}`,
          animated && "animate-pulse"
        )}
      >
        {/* Subtle ring animation for success variant */}
        {variant === "success" && (
          <>
            <span className="absolute inset-0 rounded-inherit animate-ping opacity-20 bg-emerald-500" />
            <span className="absolute -inset-2 rounded-inherit border-2 border-emerald-500/20 animate-pulse" />
          </>
        )}
        <Icon className={cn(sizeConfig.icon, iconColorClass)} />
      </div>

      {/* Text Content */}
      <h3
        className={cn(
          "font-semibold text-foreground",
          sizeConfig.title
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "mt-2 text-muted-foreground max-w-sm mx-auto",
          sizeConfig.description
        )}
      >
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {action && (
            <ActionButton action={action} size={size} isPrimary />
          )}
          {secondaryAction && (
            <ActionButton action={secondaryAction} size={size} />
          )}
        </div>
      )}

      {/* Custom children */}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );

  if (withCard) {
    return (
      <Card className={cn(
        "card-elevated overflow-hidden",
        variant === "success" && "border-emerald-200 dark:border-emerald-800/50"
      )}>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
}

// ============================================
// ACTION BUTTON HELPER
// ============================================

interface ActionButtonProps {
  action: EmptyStateAction;
  size: "sm" | "default" | "lg";
  isPrimary?: boolean;
}

function ActionButton({ action, size, isPrimary }: ActionButtonProps) {
  const sizeClass = SIZES[size].button;
  const variant = action.variant || (isPrimary ? "default" : "outline");
  const Icon = action.icon;

  const buttonContent = (
    <>
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Button
        asChild
        variant={variant}
        className={cn(
          "min-h-[44px] w-full sm:w-auto",
          sizeClass,
          isPrimary && variant === "default" && "btn-gradient"
        )}
      >
        <Link href={action.href}>{buttonContent}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={action.onClick}
      className={cn(
        "min-h-[44px] w-full sm:w-auto",
        sizeClass,
        isPrimary && variant === "default" && "btn-gradient"
      )}
    >
      {buttonContent}
    </Button>
  );
}

// ============================================
// EXPORTS
// ============================================

export default EmptyState;
