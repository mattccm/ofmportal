import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        "flex w-full min-w-0 rounded-xl border border-input bg-background px-3 transition-all duration-200 outline-none",
        // Height - 44px minimum for touch targets on mobile
        "h-11 md:h-10",
        // Typography - 16px minimum to prevent iOS zoom
        "text-base md:text-sm",
        // File inputs
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Placeholder
        "placeholder:text-muted-foreground",
        // Focus states
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        // Disabled states
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        // Error states
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        // Dark mode
        "dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
