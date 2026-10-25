"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"
import { useMergedRef, useWarnIfUnnamed } from "./dev-a11y"

function Checkbox({
  className,
  ref,
  ...props
}: CheckboxPrimitive.Root.Props & { ref?: React.Ref<HTMLElement> }) {
  const innerRef = React.useRef<HTMLElement>(null)
  const mergedRef = useMergedRef(innerRef, ref)
  // <Label htmlFor> does not name this span: call sites need aria-label(ledby).
  useWarnIfUnnamed(innerRef, "Checkbox")
  return (
    <CheckboxPrimitive.Root
      ref={mergedRef}
      data-slot="checkbox"
      className={cn(
        // Checked is light ink with a ground-coloured tick: state, not the accent.
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-ctl-hi bg-well transition-colors duration-150 group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-late data-checked:border-ink data-checked:bg-ink data-checked:text-ground data-indeterminate:border-ink data-indeterminate:bg-ink data-indeterminate:text-ground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:stroke-[3]"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
