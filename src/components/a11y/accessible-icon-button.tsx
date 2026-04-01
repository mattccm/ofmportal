"use client";

import * as React from "react";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "./visually-hidden";

// ============================================
// VARIANTS
// ============================================

const iconButtonVariants = cva(
  [
    // Base styles
    "inline-flex items-center justify-center shrink-0",
    "rounded-md transition-all duration-200",
    // Focus styles
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // Disabled styles
    "disabled:pointer-events-none disabled:opacity-50",
    // Touch target
    "touch-manipulation",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 w-10",
        sm: "h-9 w-9",
        lg: "h-11 w-11",
        xl: "h-12 w-12",
        // Touch-optimized sizes (44px minimum)
        touch: "h-11 w-11 md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  }
);

// ============================================
// TYPES
// ============================================

export interface AccessibleIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible label for the button (required for screen readers) */
  "aria-label": string;
  /** Icon to display */
  icon: React.ReactNode;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Loading indicator to show when loading */
  loadingIcon?: React.ReactNode;
  /** Whether to show a tooltip with the label */
  showTooltip?: boolean;
}

// ============================================
// COMPONENT
// ============================================

/**
 * An accessible icon button component that ensures proper labeling
 * for screen readers and keyboard users.
 *
 * @example
 * <AccessibleIconButton
 *   aria-label="Close dialog"
 *   icon={<XIcon className="h-4 w-4" />}
 *   onClick={handleClose}
 * />
 */
export const AccessibleIconButton = forwardRef<
  HTMLButtonElement,
  AccessibleIconButtonProps
>(
  (
    {
      className,
      variant,
      size,
      icon,
      loading = false,
      loadingIcon,
      showTooltip = false,
      disabled,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(iconButtonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={loading}
        title={showTooltip ? ariaLabel : undefined}
        {...props}
      >
        {loading && loadingIcon ? (
          loadingIcon
        ) : loading ? (
          <LoadingSpinner className="h-4 w-4 animate-spin" />
        ) : (
          <span aria-hidden="true">{icon}</span>
        )}
        <VisuallyHidden>{ariaLabel}</VisuallyHidden>
      </button>
    );
  }
);

AccessibleIconButton.displayName = "AccessibleIconButton";

// ============================================
// LOADING SPINNER
// ============================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================
// ACCESSIBLE BUTTON GROUP
// ============================================

interface AccessibleButtonGroupProps {
  children: React.ReactNode;
  /** Label for the button group */
  "aria-label": string;
  /** Orientation of the group */
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * A group of buttons with proper accessibility labeling.
 */
export function AccessibleButtonGroup({
  children,
  "aria-label": ariaLabel,
  orientation = "horizontal",
  className,
}: AccessibleButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={cn(
        "inline-flex",
        orientation === "horizontal"
          ? "flex-row items-center"
          : "flex-col items-stretch",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// ACCESSIBLE TOGGLE BUTTON
// ============================================

interface AccessibleToggleButtonProps
  extends Omit<AccessibleIconButtonProps, "aria-label"> {
  /** Label when not pressed */
  labelOff: string;
  /** Label when pressed */
  labelOn: string;
  /** Whether the button is pressed */
  pressed: boolean;
  /** Callback when pressed state changes */
  onPressedChange: (pressed: boolean) => void;
  /** Icon when not pressed */
  iconOff: React.ReactNode;
  /** Icon when pressed */
  iconOn: React.ReactNode;
}

/**
 * A toggle button with proper accessibility for pressed state.
 */
export const AccessibleToggleButton = forwardRef<
  HTMLButtonElement,
  AccessibleToggleButtonProps
>(
  (
    {
      className,
      variant,
      size,
      pressed,
      onPressedChange,
      labelOff,
      labelOn,
      iconOff,
      iconOn,
      disabled,
      ...props
    },
    ref
  ) => {
    const label = pressed ? labelOn : labelOff;
    const icon = pressed ? iconOn : iconOff;

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={pressed}
        aria-label={label}
        className={cn(
          iconButtonVariants({ variant, size }),
          pressed && "bg-accent",
          className
        )}
        disabled={disabled}
        onClick={() => onPressedChange(!pressed)}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
        <VisuallyHidden>{label}</VisuallyHidden>
      </button>
    );
  }
);

AccessibleToggleButton.displayName = "AccessibleToggleButton";

// ============================================
// EXPORTS
// ============================================

export { iconButtonVariants };
export default AccessibleIconButton;
