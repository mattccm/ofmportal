"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"
import { useMergedRef, useWarnIfUnnamed } from "./dev-a11y"

interface SwitchProps extends Omit<SwitchPrimitive.Root.Props, 'render'> {
  className?: string
  ref?: React.Ref<HTMLElement>
}

function Switch({ className, ref, ...props }: SwitchProps) {
  const innerRef = React.useRef<HTMLElement>(null)
  const mergedRef = useMergedRef(innerRef, ref)
  // <Label htmlFor> does not name this span: call sites need aria-label(ledby).
  useWarnIfUnnamed(innerRef, "Switch")
  return (
    <SwitchPrimitive.Root
      ref={mergedRef}
      data-slot="switch"
      className={cn(
        // On is light ink (never green); off is a control-grey track.
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-ctl transition-colors duration-150 after:absolute after:-inset-y-2.5 after:-inset-x-0.5 hover:bg-ctl-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-ink",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-5 w-5 rounded-full bg-ink ring-0 transition-[transform,background-color] duration-200 ease-out translate-x-0 data-[checked]:translate-x-5 data-[checked]:bg-ground motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
