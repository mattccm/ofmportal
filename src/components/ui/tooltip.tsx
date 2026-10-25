"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  children,
  delayDuration,
}: {
  children: React.ReactNode
  delayDuration?: number
}) {
  return (
    <TooltipPrimitive.Provider delay={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

function Tooltip({
  children,
  ...props
}: TooltipPrimitive.Root.Props) {
  return (
    <TooltipPrimitive.Root {...props}>
      {children}
    </TooltipPrimitive.Root>
  )
}

interface TooltipTriggerProps extends Omit<TooltipPrimitive.Trigger.Props, 'children'> {
  children: React.ReactNode
  asChild?: boolean
}

function TooltipTrigger({
  className,
  children,
  asChild,
  ...props
}: TooltipTriggerProps) {
  // asChild: hand Base UI the element itself so it merges props (chaining the
  // child's own handlers and keeping its children) instead of a render function
  // that would overwrite them
  if (asChild && React.isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger
        className={className}
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }
  return (
    <TooltipPrimitive.Trigger className={cn("cursor-default", className)} {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  )
}

function TooltipPortal({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Portal>{children}</TooltipPrimitive.Portal>
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  sideOffset?: number
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          className={cn(
            "z-50 overflow-hidden rounded-[6px] bg-popover px-2.5 py-1 text-[13px] font-medium leading-normal text-popover-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortal,
}
