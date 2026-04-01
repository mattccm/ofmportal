"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HelpCircle,
  ExternalLink,
  PlayCircle,
  ChevronRight,
  Lightbulb,
  X,
  BookOpen,
} from "lucide-react";
import { getHelpContent, type HelpContent, type HelpLink } from "@/lib/help-content";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

export interface ContextualHelpProps {
  /** The help content key to display */
  helpKey: string;
  /** Custom help content (overrides helpKey lookup) */
  content?: HelpContent;
  /** Size of the help icon */
  size?: "sm" | "md" | "lg";
  /** Position of the popover */
  position?: "top" | "bottom" | "left" | "right";
  /** Additional class name for the trigger button */
  className?: string;
  /** Whether to show the help icon inline with text */
  inline?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Show tips section */
  showTips?: boolean;
  /** Show documentation links */
  showLinks?: boolean;
  /** Callback when help is opened */
  onOpen?: () => void;
  /** Callback when help is closed */
  onClose?: () => void;
}

export interface HelpTriggerProps {
  size: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
  isOpen?: boolean;
}

// ============================================
// SIZE CONFIGURATIONS
// ============================================

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const buttonSizeClasses = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

// ============================================
// HELP ICON TRIGGER
// ============================================

function HelpTrigger({ size, inline, className, isOpen }: HelpTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all duration-200",
        "text-muted-foreground hover:text-primary hover:bg-primary/10",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        inline ? "ml-1" : buttonSizeClasses[size],
        isOpen && "text-primary bg-primary/10",
        className
      )}
      aria-label="Help"
    >
      <HelpCircle className={cn(sizeClasses[size], "transition-transform", isOpen && "rotate-12")} />
    </button>
  );
}

// ============================================
// LINK BUTTON COMPONENT
// ============================================

interface LinkButtonProps {
  link: HelpLink;
  icon: React.ReactNode;
  variant?: "primary" | "secondary";
}

function LinkButton({ link, icon, variant = "secondary" }: LinkButtonProps) {
  const baseClasses = cn(
    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
    "hover:scale-[1.02] active:scale-[0.98]"
  );

  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-muted hover:bg-muted/80 text-foreground",
  };

  const content = (
    <>
      {icon}
      <span className="flex-1 text-left">{link.label}</span>
      {link.isExternal && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
      {!link.isExternal && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
    </>
  );

  if (link.isExternal) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseClasses, variantClasses[variant])}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={link.url} className={cn(baseClasses, variantClasses[variant])}>
      {content}
    </Link>
  );
}

// ============================================
// TIPS SECTION
// ============================================

interface TipsSectionProps {
  tips: string[];
}

function TipsSection({ tips }: TipsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Lightbulb className="h-3.5 w-3.5" />
        <span>Tips</span>
      </div>
      <ul className="space-y-1.5">
        {tips.map((tip, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60 mt-1.5 shrink-0" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// MAIN CONTEXTUAL HELP COMPONENT
// ============================================

export function ContextualHelp({
  helpKey,
  content: customContent,
  size = "sm",
  position = "bottom",
  className,
  inline = false,
  trigger,
  showTips = true,
  showLinks = true,
  onOpen,
  onClose,
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = customContent || getHelpContent(helpKey);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        onOpen?.();
      } else {
        onClose?.();
      }
    },
    [onOpen, onClose]
  );

  if (!content) {
    console.warn(`No help content found for key: ${helpKey}`);
    return null;
  }

  const alignMap = {
    top: "center" as const,
    bottom: "center" as const,
    left: "end" as const,
    right: "start" as const,
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || (
          <HelpTrigger
            size={size}
            inline={inline}
            className={className}
            isOpen={isOpen}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align={alignMap[position]}
        className={cn(
          "w-80 p-0 overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <h4 className="font-semibold text-sm text-foreground">
                {content.title}
              </h4>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          <p className="text-sm text-foreground leading-relaxed">
            {content.description}
          </p>

          {/* Details */}
          {content.details && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {content.details}
            </p>
          )}

          {/* Tips */}
          {showTips && content.tips && content.tips.length > 0 && (
            <TipsSection tips={content.tips} />
          )}

          {/* Links */}
          {showLinks && (content.docsLink || content.videoLink) && (
            <div className="pt-2 space-y-2">
              {content.docsLink && (
                <LinkButton
                  link={content.docsLink}
                  icon={<BookOpen className="h-4 w-4" />}
                  variant="primary"
                />
              )}
              {content.videoLink && (
                <LinkButton
                  link={content.videoLink}
                  icon={<PlayCircle className="h-4 w-4" />}
                  variant="secondary"
                />
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// HELP LABEL COMPONENT
// Combines a label with inline help icon
// ============================================

export interface HelpLabelProps {
  /** Label text */
  label: string;
  /** Help content key */
  helpKey: string;
  /** HTML for attribute */
  htmlFor?: string;
  /** Required indicator */
  required?: boolean;
  /** Additional class name */
  className?: string;
}

export function HelpLabel({
  label,
  helpKey,
  htmlFor,
  required,
  className,
}: HelpLabelProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <ContextualHelp helpKey={helpKey} size="sm" inline />
    </div>
  );
}

// ============================================
// HELP BADGE COMPONENT
// A small help badge for compact spaces
// ============================================

export interface HelpBadgeProps {
  helpKey: string;
  className?: string;
}

export function HelpBadge({ helpKey, className }: HelpBadgeProps) {
  const content = getHelpContent(helpKey);

  if (!content) return null;

  return (
    <ContextualHelp
      helpKey={helpKey}
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
            "text-[10px] font-medium text-muted-foreground",
            "bg-muted/50 hover:bg-muted hover:text-foreground",
            "transition-colors duration-200",
            className
          )}
        >
          <HelpCircle className="h-3 w-3" />
          <span>Help</span>
        </button>
      }
    />
  );
}

// ============================================
// HELP TOOLTIP WRAPPER
// Wraps any element with help on hover
// ============================================

export interface HelpTooltipWrapperProps {
  children: React.ReactNode;
  helpKey: string;
  className?: string;
}

export function HelpTooltipWrapper({
  children,
  helpKey,
  className,
}: HelpTooltipWrapperProps) {
  const [showHelp, setShowHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setShowHelp(true);
    }, 500); // 500ms delay before showing help
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowHelp(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showHelp && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50">
          <QuickHelpCard helpKey={helpKey} onClose={() => setShowHelp(false)} />
        </div>
      )}
    </div>
  );
}

// ============================================
// QUICK HELP CARD
// Minimal help card for tooltips
// ============================================

interface QuickHelpCardProps {
  helpKey: string;
  onClose?: () => void;
}

function QuickHelpCard({ helpKey, onClose }: QuickHelpCardProps) {
  const content = getHelpContent(helpKey);

  if (!content) return null;

  return (
    <div
      className={cn(
        "w-64 p-3 rounded-lg shadow-lg border bg-popover text-popover-foreground",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h5 className="font-medium text-sm">{content.title}</h5>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {content.description}
      </p>
      {content.docsLink && (
        <Link
          href={content.docsLink.url}
          className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
        >
          Learn more
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ============================================
// INLINE HELP TEXT
// For showing help text directly in forms
// ============================================

export interface InlineHelpTextProps {
  helpKey: string;
  className?: string;
  showIcon?: boolean;
}

export function InlineHelpText({
  helpKey,
  className,
  showIcon = true,
}: InlineHelpTextProps) {
  const content = getHelpContent(helpKey);

  if (!content) return null;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      {showIcon && (
        <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
      )}
      <span>{content.description}</span>
    </p>
  );
}

// ============================================
// SECTION HELP HEADER
// For adding help to entire sections
// ============================================

export interface SectionHelpHeaderProps {
  title: string;
  helpKey: string;
  description?: string;
  className?: string;
}

export function SectionHelpHeader({
  title,
  helpKey,
  description,
  className,
}: SectionHelpHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <ContextualHelp helpKey={helpKey} size="md" />
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export default ContextualHelp;
