"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X, Pin, PinOff } from "lucide-react";

// ============================================
// TYPES
// ============================================

export type TooltipPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

export interface TooltipEnhancedProps {
  /** Tooltip content - can be text or rich content */
  content: React.ReactNode;
  /** Position relative to trigger */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  delayShow?: number;
  /** Delay before hiding (ms) */
  delayHide?: number;
  /** Allow click to pin tooltip open */
  allowPin?: boolean;
  /** Show arrow pointer */
  showArrow?: boolean;
  /** Additional class for tooltip content */
  className?: string;
  /** Maximum width of tooltip */
  maxWidth?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Children (trigger element) */
  children: React.ReactElement;
  /** Side offset from trigger */
  sideOffset?: number;
  /** Callback when tooltip visibility changes */
  onOpenChange?: (open: boolean) => void;
}

// ============================================
// ARROW COMPONENT
// ============================================

interface TooltipArrowProps {
  position: TooltipPosition;
  className?: string;
}

function TooltipArrow({ position, className }: TooltipArrowProps) {
  const getArrowClasses = () => {
    switch (position) {
      case "top":
      case "top-start":
      case "top-end":
        return "bottom-0 left-1/2 -translate-x-1/2 translate-y-full";
      case "bottom":
      case "bottom-start":
      case "bottom-end":
        return "top-0 left-1/2 -translate-x-1/2 -translate-y-full rotate-180";
      case "left":
        return "right-0 top-1/2 -translate-y-1/2 translate-x-full -rotate-90";
      case "right":
        return "left-0 top-1/2 -translate-y-1/2 -translate-x-full rotate-90";
      default:
        return "bottom-0 left-1/2 -translate-x-1/2 translate-y-full";
    }
  };

  return (
    <div className={cn("absolute pointer-events-none", getArrowClasses(), className)}>
      <svg
        width="12"
        height="6"
        viewBox="0 0 12 6"
        className="fill-popover drop-shadow-sm"
      >
        <path d="M0 6 L6 0 L12 6" />
      </svg>
    </div>
  );
}

// ============================================
// TOOLTIP CONTENT COMPONENT
// ============================================

interface TooltipContentProps {
  content: React.ReactNode;
  position: TooltipPosition;
  targetRect: DOMRect;
  showArrow: boolean;
  isPinned: boolean;
  onPin?: () => void;
  onClose: () => void;
  className?: string;
  maxWidth: number;
  sideOffset: number;
  allowPin: boolean;
}

function TooltipContent({
  content,
  position,
  targetRect,
  showArrow,
  isPinned,
  onPin,
  onClose,
  className,
  maxWidth,
  sideOffset,
  allowPin,
}: TooltipContentProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = sideOffset;

    let top = 0;
    let left = 0;
    let finalPosition = position;

    const calculatePosition = (pos: TooltipPosition) => {
      switch (pos) {
        case "top":
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          break;
        case "top-start":
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.left;
          break;
        case "top-end":
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.right - tooltipRect.width;
          break;
        case "bottom":
          top = targetRect.bottom + gap;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          break;
        case "bottom-start":
          top = targetRect.bottom + gap;
          left = targetRect.left;
          break;
        case "bottom-end":
          top = targetRect.bottom + gap;
          left = targetRect.right - tooltipRect.width;
          break;
        case "left":
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
          left = targetRect.left - tooltipRect.width - gap;
          break;
        case "right":
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
          left = targetRect.right + gap;
          break;
      }
      return { top, left };
    };

    const initialPos = calculatePosition(position);
    top = initialPos.top;
    left = initialPos.left;

    // Check viewport bounds and adjust
    const fitsInViewport = (t: number, l: number) => {
      return (
        t >= 8 &&
        l >= 8 &&
        t + tooltipRect.height <= viewportHeight - 8 &&
        l + tooltipRect.width <= viewportWidth - 8
      );
    };

    if (!fitsInViewport(top, left)) {
      const alternatives: TooltipPosition[] = [
        "bottom",
        "top",
        "right",
        "left",
        "bottom-start",
        "bottom-end",
        "top-start",
        "top-end",
      ];

      for (const alt of alternatives) {
        if (alt === position) continue;
        const altPos = calculatePosition(alt);
        if (fitsInViewport(altPos.top, altPos.left)) {
          top = altPos.top;
          left = altPos.left;
          finalPosition = alt;
          break;
        }
      }
    }

    // Clamp to viewport bounds
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));

    setAdjustedPosition(finalPosition);
    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
    });

    // Trigger animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [targetRect, position, sideOffset]);

  const isRichContent = typeof content !== "string";

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className={cn(
        "fixed z-[9999] pointer-events-auto",
        "bg-popover text-popover-foreground",
        "border border-border/50 shadow-lg rounded-lg",
        "transition-all duration-150 ease-out",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
      style={{
        ...tooltipStyle,
        maxWidth: `${maxWidth}px`,
      }}
    >
      {/* Pin/Close buttons for pinned state */}
      {isPinned && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          <button
            onClick={onClose}
            className="h-5 w-5 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors shadow-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "relative",
          isRichContent ? "p-3" : "px-3 py-2"
        )}
      >
        {isRichContent ? (
          content
        ) : (
          <p className="text-sm leading-relaxed">{content}</p>
        )}

        {/* Pin button inline for non-pinned state */}
        {allowPin && !isPinned && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin?.();
            }}
            className="absolute top-1 right-1 h-5 w-5 rounded hover:bg-muted flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
            title="Pin tooltip"
          >
            <Pin className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Arrow */}
      {showArrow && <TooltipArrow position={adjustedPosition} />}
    </div>,
    document.body
  );
}

// ============================================
// MAIN TOOLTIP COMPONENT
// ============================================

export function TooltipEnhanced({
  content,
  position = "top",
  delayShow = 300,
  delayHide = 150,
  allowPin = false,
  showArrow = true,
  className,
  maxWidth = 280,
  disabled = false,
  children,
  sideOffset = 8,
  onOpenChange,
}: TooltipEnhancedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateTargetRect = useCallback(() => {
    if (triggerRef.current) {
      setTargetRect(triggerRef.current.getBoundingClientRect());
    }
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      updateTargetRect();
      setIsOpen(true);
      onOpenChange?.(true);
    }, delayShow);
  }, [disabled, delayShow, updateTargetRect, onOpenChange]);

  const hide = useCallback(() => {
    if (isPinned) return;
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      onOpenChange?.(false);
    }, delayHide);
  }, [isPinned, delayHide, onOpenChange]);

  const handlePin = useCallback(() => {
    setIsPinned(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsPinned(false);
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleClick = useCallback(() => {
    if (allowPin && isOpen && !isPinned) {
      handlePin();
    }
  }, [allowPin, isOpen, isPinned, handlePin]);

  // Handle scroll and resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      updateTargetRect();
    };

    const handleResize = () => {
      updateTargetRect();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, updateTargetRect]);

  // Close pinned tooltip on escape
  useEffect(() => {
    if (!isPinned) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPinned, handleClose]);

  // Close pinned tooltip on outside click
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isPinned, handleClose]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Clone child element with ref and event handlers
  type ChildProps = {
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
    "aria-describedby"?: string;
  };
  const typedChildren = children as React.ReactElement<ChildProps>;
  const trigger = React.cloneElement(typedChildren, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      typedChildren.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      typedChildren.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      typedChildren.props.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      typedChildren.props.onBlur?.(e);
      hide();
    },
    onClick: (e: React.MouseEvent) => {
      typedChildren.props.onClick?.(e);
      handleClick();
    },
    "aria-describedby": isOpen ? "tooltip" : undefined,
  });

  return (
    <>
      {trigger}
      {isOpen && targetRect && (
        <TooltipContent
          content={content}
          position={position}
          targetRect={targetRect}
          showArrow={showArrow}
          isPinned={isPinned}
          onPin={handlePin}
          onClose={handleClose}
          className={className}
          maxWidth={maxWidth}
          sideOffset={sideOffset}
          allowPin={allowPin}
        />
      )}
    </>
  );
}

// ============================================
// SHORTHAND COMPONENTS
// ============================================

interface IconButtonTooltipProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  position?: TooltipPosition;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function IconButtonTooltip({
  icon,
  label,
  description,
  position = "top",
  onClick,
  className,
  disabled = false,
}: IconButtonTooltipProps) {
  return (
    <TooltipEnhanced
      content={
        description ? (
          <div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        ) : (
          label
        )
      }
      position={position}
      disabled={disabled}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center",
          "h-9 w-9 rounded-lg",
          "hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
        aria-label={label}
      >
        {icon}
      </button>
    </TooltipEnhanced>
  );
}

interface StatTooltipProps {
  value: React.ReactNode;
  label: string;
  description: string;
  trend?: {
    value: number;
    label: string;
  };
  children: React.ReactElement;
  position?: TooltipPosition;
}

export function StatTooltip({
  value,
  label,
  description,
  trend,
  children,
  position = "top",
}: StatTooltipProps) {
  return (
    <TooltipEnhanced
      content={
        <div className="space-y-2">
          <div>
            <p className="font-semibold text-base">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.value >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              <span>{trend.value >= 0 ? "+" : ""}{trend.value}%</span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
      }
      position={position}
      allowPin
      maxWidth={240}
    >
      {children}
    </TooltipEnhanced>
  );
}

export default TooltipEnhanced;
