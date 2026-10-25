import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // A well one step below the tile, with a control border
        "flex w-full min-w-0 rounded-md border border-ctl bg-well px-3 text-foreground transition-colors duration-150 outline-none",
        // 44px on touch, 36px from md up
        "h-11 md:h-9",
        // 16px on phones so iOS does not zoom
        "text-base md:text-sm",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-[#8e939c]",
        "hover:border-ctl-hi",
        "focus-visible:border-acc focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-line disabled:text-ink-2",
        "aria-invalid:border-late",
        className
      )}
      {...props}
    />
  )
}

export { Input }
