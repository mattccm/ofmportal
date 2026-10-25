import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { FIELD_STATE_ICON } from "@/components/title-wall/types"

/**
 * Pills sit inside rows and beside a value, never above a heading. Status
 * variants are the field-state vocabulary: a pale tint with same-hue ink and
 * the state's icon before the word (colour is never the only cue). Approved
 * is green, the only green in the product.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border border-transparent px-2 text-xs font-medium leading-none whitespace-nowrap tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-late [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        /** Neutral pill on a tile */
        default: "bg-raised text-foreground [a]:hover:bg-raised-hi",
        secondary: "bg-tile-hi text-foreground [a]:hover:bg-raised",
        destructive: "bg-late/15 text-late [a]:hover:bg-late/25",
        outline: "border-ctl text-foreground [a]:hover:bg-tile-hi",
        ghost: "hover:bg-tile-hi",
        link: "text-foreground underline underline-offset-[3px] decoration-ctl-hi hover:decoration-ink",
        /* field and request states (each draws its icon; see STATUS_ICON) */
        /** To do, not uploaded yet: an outline with a dashed-circle icon */
        todo: "border-ctl-hi bg-transparent text-ink-2 [&>svg]:text-waiting",
        /** Uploaded, waiting for review: blue, clock */
        ready: "bg-ready/12 text-ready",
        /** Approved: green, check */
        approved: "bg-approved/12 text-approved",
        /** Needs changes: orange, undo arrow */
        changes: "bg-changes/12 text-changes",
        /** Overdue: red, alert triangle */
        overdue: "bg-late/10 text-late",
        /** Not sent yet: an outline only, no icon (a draft is not a state) */
        draft: "border-ctl-hi bg-transparent text-ink-2",
        /** Highlight for the one item that needs action now (sparingly) */
        accent: "bg-acc text-acc-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** The icon each status variant draws before its word */
const STATUS_ICON: Partial<Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, LucideIcon>> = {
  todo: FIELD_STATE_ICON.waiting,
  ready: FIELD_STATE_ICON.ready,
  approved: FIELD_STATE_ICON.approved,
  changes: FIELD_STATE_ICON.changes,
  overdue: FIELD_STATE_ICON.overdue,
}

function Badge({
  className,
  variant = "default",
  render,
  icon = true,
  children,
  ...props
}: useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Status variants draw their state icon; pass false when the pill already has one */
    icon?: boolean
  }) {
  const Icon = icon && variant ? STATUS_ICON[variant] : undefined
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: Icon ? (
          <>
            <Icon aria-hidden="true" data-icon="inline-start" />
            {children}
          </>
        ) : (
          children
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
