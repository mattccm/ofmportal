"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Context to track tab values
interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant?: "default" | "line"
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider")
  }
  return context
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
}

function Tabs({
  className,
  orientation = "horizontal",
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const handleValueChange = React.useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
  }, [controlledValue, onValueChange])

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit max-w-full items-center justify-start overflow-x-auto scrollbar-hide rounded-[10px] p-[3px] text-ink-2",
  {
    variants: {
      variant: {
        default: "bg-well h-10 gap-0.5",
        line: "gap-1 bg-transparent rounded-none border-b border-line p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof tabsListVariants> {}

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsListProps) {
  return (
    <div
      data-slot="tabs-list"
      data-variant={variant}
      role="tablist"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const context = useTabsContext()
  const isActive = context.value === value

  return (
    <button
      data-slot="tabs-trigger"
      role="tab"
      type="button"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex h-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] px-3 text-sm font-medium text-ink-2 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        "data-[state=active]:bg-tile-hi data-[state=active]:text-foreground",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:pb-2 group-data-[variant=line]/tabs-list:shadow-none",
        "group-data-[variant=line]/tabs-list:h-10 group-data-[variant=line]/tabs-list:data-[state=active]:border-ink group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const context = useTabsContext()
  const isActive = context.value === value

  if (!isActive) return null

  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      data-state={isActive ? "active" : "inactive"}
      className={cn("mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
