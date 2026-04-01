"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  children,
  delayDuration = 200,
}: {
  children: React.ReactNode
  delayDuration?: number
}) {
  return <>{children}</>
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
  // If asChild is true, we render the Trigger with the child element
  // Base UI's Tooltip.Trigger should handle render prop pattern
  return (
    <TooltipPrimitive.Trigger
      className={cn("cursor-default", className)}
      render={asChild && React.isValidElement(children) ? (triggerProps) => {
        return React.cloneElement(children as React.ReactElement<any>, {
          ...triggerProps,
          className: cn((children as React.ReactElement<any>).props.className, className),
        })
      } : undefined}
      {...props}
    >
      {!asChild ? children : undefined}
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
            "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md border border-border/50",
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
          <TooltipPrimitive.Arrow className="fill-popover [&>path]:stroke-border" />
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
