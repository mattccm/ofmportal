"use client";

import * as React from "react";
import { createContext, useContext } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ============================================
// HEADING LEVEL CONTEXT
// ============================================

/**
 * Context for managing heading hierarchy automatically.
 * Ensures proper nesting of heading levels for accessibility.
 */
const HeadingLevelContext = createContext<number>(1);

export function useHeadingLevel() {
  return useContext(HeadingLevelContext);
}

interface HeadingSectionProps {
  children: React.ReactNode;
  /** Optional override for the heading level */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Wraps a section and increments the heading level for children.
 * Use this to automatically manage heading hierarchy.
 *
 * @example
 * <HeadingSection>
 *   <Heading>This is h1</Heading>
 *   <HeadingSection>
 *     <Heading>This is h2</Heading>
 *   </HeadingSection>
 * </HeadingSection>
 */
export function HeadingSection({ children, level }: HeadingSectionProps) {
  const currentLevel = useHeadingLevel();
  const nextLevel = level ?? Math.min(currentLevel + 1, 6);

  return (
    <HeadingLevelContext.Provider value={nextLevel}>
      {children}
    </HeadingLevelContext.Provider>
  );
}

// ============================================
// HEADING VARIANTS
// ============================================

const headingVariants = cva("font-bold tracking-tight text-foreground", {
  variants: {
    size: {
      "4xl": "text-4xl md:text-5xl",
      "3xl": "text-3xl md:text-4xl",
      "2xl": "text-2xl md:text-3xl",
      xl: "text-xl md:text-2xl",
      lg: "text-lg md:text-xl",
      base: "text-base md:text-lg",
      sm: "text-sm md:text-base",
    },
    weight: {
      bold: "font-bold",
      semibold: "font-semibold",
      medium: "font-medium",
      normal: "font-normal",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    size: "2xl",
    weight: "bold",
    align: "left",
  },
});

// ============================================
// HEADING COMPONENT
// ============================================

interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  /** Override the heading level (1-6) */
  as?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Visual level independent of semantic level */
  visualLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

/**
 * Accessible heading component that automatically determines the correct
 * heading level based on context, or allows explicit override.
 *
 * @example
 * // Automatic level based on context
 * <Heading>This will be h1, h2, etc. based on nesting</Heading>
 *
 * @example
 * // Explicit level
 * <Heading as={2}>This is always h2</Heading>
 *
 * @example
 * // Visual styling independent of semantic level
 * <Heading as={3} visualLevel={1}>
 *   Looks like h1 but is semantically h3
 * </Heading>
 */
export function Heading({
  as,
  visualLevel,
  size,
  weight,
  align,
  className,
  children,
  ...props
}: HeadingProps) {
  const contextLevel = useHeadingLevel();
  const level = as ?? contextLevel;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  // Map visual level to size if provided
  const visualSize = visualLevel
    ? ({
        1: "4xl",
        2: "3xl",
        3: "2xl",
        4: "xl",
        5: "lg",
        6: "base",
      }[visualLevel] as "4xl" | "3xl" | "2xl" | "xl" | "lg" | "base")
    : size;

  return (
    <Tag
      className={cn(headingVariants({ size: visualSize, weight, align }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

// ============================================
// SPECIFIC HEADING LEVELS
// ============================================

type SpecificHeadingProps = Omit<HeadingProps, "as">;

export function H1(props: SpecificHeadingProps) {
  return <Heading as={1} size="4xl" {...props} />;
}

export function H2(props: SpecificHeadingProps) {
  return <Heading as={2} size="3xl" {...props} />;
}

export function H3(props: SpecificHeadingProps) {
  return <Heading as={3} size="2xl" {...props} />;
}

export function H4(props: SpecificHeadingProps) {
  return <Heading as={4} size="xl" {...props} />;
}

export function H5(props: SpecificHeadingProps) {
  return <Heading as={5} size="lg" {...props} />;
}

export function H6(props: SpecificHeadingProps) {
  return <Heading as={6} size="base" {...props} />;
}

// ============================================
// PAGE TITLE
// ============================================

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** The main title */
  children: React.ReactNode;
  /** Optional subtitle/description */
  description?: React.ReactNode;
  /** Actions to display alongside the title */
  actions?: React.ReactNode;
}

/**
 * Page-level title component with proper heading structure.
 * Includes optional description and action buttons.
 */
export function PageTitle({
  children,
  description,
  actions,
  className,
  ...props
}: PageTitleProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <h1
            className="text-2xl md:text-3xl font-bold tracking-tight text-foreground"
            {...props}
          >
            {children}
          </h1>
          {description && (
            <p className="text-sm md:text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SECTION TITLE
// ============================================

interface SectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  /** Optional subtitle */
  subtitle?: React.ReactNode;
  /** Heading level (defaults to 2) */
  as?: 2 | 3 | 4 | 5 | 6;
}

/**
 * Section title component for content sections.
 */
export function SectionTitle({
  children,
  subtitle,
  as = 2,
  className,
  ...props
}: SectionTitleProps) {
  const Tag = `h${as}` as "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <div className={cn("space-y-0.5", className)}>
      <Tag
        className="text-lg md:text-xl font-semibold tracking-tight text-foreground"
        {...props}
      >
        {children}
      </Tag>
      {subtitle && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================
// CARD TITLE
// ============================================

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  /** Heading level (defaults to 3) */
  as?: 2 | 3 | 4 | 5 | 6;
}

/**
 * Card title component with proper heading semantics.
 */
export function CardTitle({
  children,
  as = 3,
  className,
  ...props
}: CardTitleProps) {
  const Tag = `h${as}` as "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <Tag
      className={cn(
        "text-base md:text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

// ============================================
// EXPORTS
// ============================================

export { headingVariants };
export default Heading;
