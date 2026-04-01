"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** If true, content is visible when focused (useful for skip links) */
  focusable?: boolean;
  /** HTML element to render */
  as?: keyof React.JSX.IntrinsicElements;
}

// ============================================
// VISUALLY HIDDEN COMPONENT
// ============================================

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use this for content that should be announced but not displayed visually.
 *
 * @example
 * // Hide helper text from sighted users
 * <VisuallyHidden>Opens in a new window</VisuallyHidden>
 *
 * @example
 * // Create a skip link that becomes visible on focus
 * <VisuallyHidden focusable>
 *   <a href="#main">Skip to main content</a>
 * </VisuallyHidden>
 */
export function VisuallyHidden({
  children,
  focusable = false,
  as: Component = 'span',
  className,
  ...props
}: VisuallyHiddenProps) {
  const Comp = Component as React.ElementType;

  return (
    <Comp
      className={cn(
        // Hidden styles
        !focusable && "sr-only",
        // Focusable variant - visible when focused
        focusable && [
          "sr-only",
          "focus-within:not-sr-only",
          "focus-within:fixed focus-within:top-4 focus-within:left-4 focus-within:z-[9999]",
          "focus-within:block focus-within:px-4 focus-within:py-2",
          "focus-within:bg-primary focus-within:text-primary-foreground",
          "focus-within:rounded-lg focus-within:shadow-lg",
        ],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

// ============================================
// SCREEN READER ONLY TEXT
// ============================================

interface SrOnlyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Screen reader only text component.
 * A simpler alternative to VisuallyHidden for static text.
 */
export function SrOnly({ children, className }: SrOnlyProps) {
  return <span className={cn("sr-only", className)}>{children}</span>;
}

// ============================================
// ACCESSIBLE ICON WRAPPER
// ============================================

interface AccessibleIconProps {
  children: React.ReactNode;
  /** Label for screen readers */
  label: string;
  /** Whether the icon is decorative (no label needed) */
  decorative?: boolean;
  className?: string;
}

/**
 * Wraps icons to make them accessible.
 * Use this when icons need to convey meaning to screen reader users.
 *
 * @example
 * <AccessibleIcon label="Delete item">
 *   <TrashIcon />
 * </AccessibleIcon>
 *
 * @example
 * // For decorative icons
 * <AccessibleIcon decorative label="">
 *   <SparkleIcon />
 * </AccessibleIcon>
 */
export function AccessibleIcon({
  children,
  label,
  decorative = false,
  className,
}: AccessibleIconProps) {
  if (decorative) {
    return (
      <span className={className} role="presentation" aria-hidden="true">
        {children}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={label}>
      {children}
      <SrOnly>{label}</SrOnly>
    </span>
  );
}

// ============================================
// EXPORTS
// ============================================

export default VisuallyHidden;
