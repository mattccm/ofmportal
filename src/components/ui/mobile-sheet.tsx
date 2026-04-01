"use client";

import * as React from "react";
import { useRef, useCallback, useEffect, useState } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// Sheet height variants
type SheetHeight = "quarter" | "half" | "three-quarter" | "full" | "auto";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  height?: SheetHeight;
  showHandle?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const heightClasses: Record<SheetHeight, string> = {
  quarter: "max-h-[25vh]",
  half: "max-h-[50vh]",
  "three-quarter": "max-h-[75vh]",
  full: "max-h-[100vh]",
  auto: "max-h-[85vh]",
};

const heightValues: Record<SheetHeight, number> = {
  quarter: 0.25,
  half: 0.5,
  "three-quarter": 0.75,
  full: 1,
  auto: 0.85,
};

export function MobileSheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  height = "auto",
  showHandle = true,
  showCloseButton = false,
  className,
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragCurrentY = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Swipe threshold to dismiss (in pixels)
  const DISMISS_THRESHOLD = 100;
  // Velocity threshold for quick swipe dismiss
  const VELOCITY_THRESHOLD = 0.5;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!showHandle) return;

    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragCurrentY.current = touch.clientY;
    setIsDragging(true);
  }, [showHandle]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !showHandle) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY.current;

    // Only allow downward swipe
    if (deltaY > 0) {
      dragCurrentY.current = touch.clientY;
      setDragOffset(deltaY);

      // Add haptic feedback at threshold
      if (deltaY >= DISMISS_THRESHOLD && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, [isDragging, showHandle]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !showHandle) return;

    const deltaY = dragCurrentY.current - dragStartY.current;
    const velocity = deltaY / (e.timeStamp - (e.timeStamp - 100)); // Approximate velocity

    // Dismiss if dragged past threshold or with high velocity
    if (deltaY > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      onOpenChange(false);
    }

    // Reset state
    setIsDragging(false);
    setDragOffset(0);
    dragStartY.current = 0;
    dragCurrentY.current = 0;
  }, [isDragging, showHandle, onOpenChange]);

  // Reset drag offset when sheet closes
  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        {/* Overlay */}
        <SheetPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "transition-all duration-300"
          )}
        />

        {/* Sheet Content */}
        <SheetPrimitive.Content
          ref={sheetRef}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50",
            "bg-background rounded-t-3xl shadow-2xl",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "transition-transform duration-300 ease-out",
            heightClasses[height],
            className
          )}
          style={{
            transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
            transition: isDragging ? "none" : undefined,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Handle */}
          {showHandle && (
            <div
              className={cn(
                "flex justify-center py-3 cursor-grab active:cursor-grabbing",
                "touch-manipulation"
              )}
            >
              <div
                className={cn(
                  "w-10 h-1 rounded-full bg-muted-foreground/30",
                  "transition-colors duration-200",
                  isDragging && "bg-muted-foreground/50"
                )}
              />
            </div>
          )}

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 pb-4">
              <div className="flex-1">
                {title && (
                  <SheetPrimitive.Title className="text-lg font-semibold text-foreground">
                    {title}
                  </SheetPrimitive.Title>
                )}
                {description && (
                  <SheetPrimitive.Description className="text-sm text-muted-foreground mt-1">
                    {description}
                  </SheetPrimitive.Description>
                )}
              </div>
              {showCloseButton && (
                <SheetPrimitive.Close
                  className={cn(
                    "h-10 w-10 flex items-center justify-center rounded-xl",
                    "bg-muted hover:bg-muted/80 transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "touch-manipulation active:scale-95"
                  )}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                  <span className="sr-only">Close</span>
                </SheetPrimitive.Close>
              )}
            </div>
          )}

          {/* Content */}
          <div
            className={cn(
              "overflow-y-auto overscroll-contain",
              "px-6 scrollbar-hide",
              !title && !showCloseButton && showHandle && "pt-0"
            )}
            style={{
              maxHeight: `calc(${heightValues[height] * 100}vh - 80px - env(safe-area-inset-bottom, 0px))`,
            }}
          >
            {children}
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

// Export additional variants

interface ActionSheetItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  items: ActionSheetItem[];
  cancelLabel?: string;
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  items,
  cancelLabel = "Cancel",
}: ActionSheetProps) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} height="auto">
      {title && (
        <p className="text-center text-sm text-muted-foreground pb-4 border-b border-border mb-2">
          {title}
        </p>
      )}

      <div className="space-y-1">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onOpenChange(false);
            }}
            disabled={item.disabled}
            className={cn(
              "flex items-center gap-4 w-full px-4 py-4 rounded-xl",
              "text-left font-medium transition-all duration-200",
              "active:scale-[0.98] touch-manipulation",
              "min-h-[56px]",
              item.destructive
                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                : "text-foreground hover:bg-muted/50",
              item.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {item.icon && (
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                item.destructive
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                  : "bg-muted text-muted-foreground"
              )}>
                {item.icon}
              </div>
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => onOpenChange(false)}
          className={cn(
            "w-full px-4 py-4 rounded-xl",
            "text-center font-semibold text-muted-foreground",
            "transition-all duration-200 hover:bg-muted/50",
            "active:scale-[0.98] touch-manipulation",
            "min-h-[56px]"
          )}
        >
          {cancelLabel}
        </button>
      </div>
    </MobileSheet>
  );
}

// Confirmation Sheet
interface ConfirmationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmationSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  icon,
}: ConfirmationSheetProps) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} height="auto">
      <div className="text-center py-4">
        {icon && (
          <div className={cn(
            "mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center",
            destructive
              ? "bg-red-100 dark:bg-red-900/30 text-red-600"
              : "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        )}

        <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

        {description && (
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          className={cn(
            "w-full py-4 rounded-xl font-semibold",
            "transition-all duration-200",
            "active:scale-[0.98] touch-manipulation",
            "min-h-[56px]",
            destructive
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {confirmLabel}
        </button>

        <button
          onClick={() => onOpenChange(false)}
          className={cn(
            "w-full py-4 rounded-xl font-semibold",
            "text-muted-foreground bg-muted hover:bg-muted/80",
            "transition-all duration-200",
            "active:scale-[0.98] touch-manipulation",
            "min-h-[56px]"
          )}
        >
          {cancelLabel}
        </button>
      </div>
    </MobileSheet>
  );
}
