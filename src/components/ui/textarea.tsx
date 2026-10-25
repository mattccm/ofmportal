import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[84px] w-full rounded-md border border-ctl bg-well px-3 py-2.5 text-base leading-normal text-foreground transition-colors duration-150 placeholder:text-[#8e939c] hover:border-ctl-hi focus-visible:border-acc focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-line disabled:text-ink-2 aria-invalid:border-late md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
