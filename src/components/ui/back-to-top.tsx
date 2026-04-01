"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ============================================
// TYPES
// ============================================

export interface BackToTopProps {
  /** Container element to scroll (uses window if not provided) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Scroll threshold in pixels to show the button */
  threshold?: number;
  /** Whether to use smooth scrolling */
  smooth?: boolean;
  /** Position of the button */
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  /** Additional offset from the bottom */
  bottomOffset?: number;
  /** Additional offset from the sides */
  sideOffset?: number;
  /** Custom class name */
  className?: string;
  /** Custom button content */
  children?: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Style variant */
  variant?: "default" | "gradient" | "ghost";
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Aria label for accessibility */
  "aria-label"?: string;
}

// ============================================
// BACK TO TOP COMPONENT
// ============================================

export function BackToTop({
  containerRef,
  threshold = 400,
  smooth = true,
  position = "bottom-right",
  bottomOffset = 24,
  sideOffset = 24,
  className,
  children,
  size = "md",
  variant = "default",
  showProgress = false,
  "aria-label": ariaLabel = "Back to top",
}: BackToTopProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  // Check scroll position
  const checkScrollPosition = React.useCallback(() => {
    const container = containerRef?.current;
    let scrollTop: number;
    let scrollHeight: number;
    let clientHeight: number;

    if (container) {
      scrollTop = container.scrollTop;
      scrollHeight = container.scrollHeight;
      clientHeight = container.clientHeight;
    } else {
      scrollTop = window.scrollY;
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = window.innerHeight;
    }

    setIsVisible(scrollTop > threshold);

    if (showProgress) {
      const progress = Math.min(
        (scrollTop / (scrollHeight - clientHeight)) * 100,
        100
      );
      setScrollProgress(progress);
    }
  }, [containerRef, threshold, showProgress]);

  // Scroll to top
  const scrollToTop = React.useCallback(() => {
    const container = containerRef?.current;
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, [containerRef, smooth]);

  // Set up scroll listener
  React.useEffect(() => {
    const container = containerRef?.current;
    const target = container || window;

    target.addEventListener("scroll", checkScrollPosition, { passive: true });
    checkScrollPosition(); // Check initial position

    return () => {
      target.removeEventListener("scroll", checkScrollPosition);
    };
  }, [containerRef, checkScrollPosition]);

  // Position styles
  const positionStyles = React.useMemo(() => {
    const base: React.CSSProperties = {
      position: "fixed",
      bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
      zIndex: 50,
    };

    switch (position) {
      case "bottom-left":
        return { ...base, left: sideOffset };
      case "bottom-center":
        return { ...base, left: "50%", transform: "translateX(-50%)" };
      case "bottom-right":
      default:
        return { ...base, right: sideOffset };
    }
  }, [position, bottomOffset, sideOffset]);

  // Size styles
  const sizeStyles = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  // Variant styles
  const variantStyles = {
    default:
      "bg-background border border-border shadow-lg hover:bg-accent hover:shadow-xl",
    gradient:
      "bg-gradient-to-r from-primary to-violet-500 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
    ghost: "bg-background/80 backdrop-blur-sm border border-border/50 shadow-md hover:bg-background",
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={scrollToTop}
      style={positionStyles}
      className={cn(
        // Base styles
        "rounded-full transition-all duration-300",
        // Animation
        "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4",
        // Hover effects
        "hover:scale-110 active:scale-95",
        // Size
        sizeStyles[size],
        // Variant
        variantStyles[variant],
        className
      )}
      aria-label={ariaLabel}
    >
      {showProgress && (
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden="true"
        >
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.2"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${scrollProgress}, 100`}
            strokeLinecap="round"
            className="transition-all duration-200"
          />
        </svg>
      )}
      {children || <ArrowUp className={cn(iconSizes[size])} />}
    </Button>
  );
}

// ============================================
// BACK TO TOP CONTAINER
// ============================================

export interface BackToTopContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Back to top button props */
  backToTopProps?: Omit<BackToTopProps, "containerRef">;
  /** Whether to show the back to top button */
  showBackToTop?: boolean;
}

export function BackToTopContainer({
  children,
  className,
  backToTopProps,
  showBackToTop = true,
}: BackToTopContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={cn("relative overflow-auto", className)}>
      {children}
      {showBackToTop && (
        <BackToTop
          containerRef={containerRef}
          {...backToTopProps}
        />
      )}
    </div>
  );
}

export default BackToTop;
