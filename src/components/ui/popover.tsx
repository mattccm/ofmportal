"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

function usePopoverContext() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within a Popover");
  }
  return context;
}

interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function PopoverTrigger({ children, asChild }: PopoverTriggerProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        (children as React.ReactElement<any>).props.onClick?.(e);
      },
      "aria-expanded": open,
      "aria-haspopup": "dialog",
    });
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  );
}

export interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  onOpenAutoFocus?: (e: Event) => void;
}

export function PopoverContent({
  children,
  className,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  onOpenAutoFocus,
}: PopoverContentProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Handle auto focus when popover opens
  React.useEffect(() => {
    if (open && contentRef.current && onOpenAutoFocus) {
      const event = new Event("focusin");
      onOpenAutoFocus(event);
    }
  }, [open, onOpenAutoFocus]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  const sideClasses = {
    top: "bottom-full mb-1",
    bottom: "top-full mt-1",
    left: "right-full mr-1 top-0",
    right: "left-full ml-1 top-0",
  };

  const sideOffsetStyle = side === "top" || side === "bottom"
    ? { [side === "top" ? "marginBottom" : "marginTop"]: sideOffset }
    : { [side === "left" ? "marginRight" : "marginLeft"]: sideOffset };

  return (
    <div
      ref={contentRef}
      role="dialog"
      className={cn(
        "absolute z-50",
        sideClasses[side],
        (side === "top" || side === "bottom") && alignmentClasses[align],
        "w-72 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      style={sideOffsetStyle}
    >
      {children}
    </div>
  );
}

export function PopoverClose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { setOpen } = usePopoverContext();

  return (
    <button
      type="button"
      className={className}
      onClick={() => setOpen(false)}
    >
      {children}
    </button>
  );
}
