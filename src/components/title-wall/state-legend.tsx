import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FieldCell, StateIcon } from "./field-strip";
import { FIELD_STATE_ORDER, stateShort, type FieldState, type StateAudience } from "./types";

const PILL_VARIANT = {
  waiting: "todo",
  ready: "ready",
  approved: "approved",
  changes: "changes",
  overdue: "overdue",
} as const satisfies Record<FieldState, string>;

export interface StatePillProps {
  state: FieldState;
  /** Whose words to use ("Ready to review" for staff, "Waiting for review" for creators) */
  audience?: StateAudience;
  /** Overrides the word, e.g. "3 to review"; the icon and colour stay the state's */
  children?: ReactNode;
  className?: string;
}

/** A state chip: icon, word and tint from the one vocabulary. Sits in rows and tiles, never above a heading. */
export function StatePill({ state, audience = "staff", children, className }: StatePillProps) {
  return (
    <Badge variant={PILL_VARIANT[state]} className={className}>
      {children ?? stateShort(state, audience)}
    </Badge>
  );
}

export interface StateLegendProps {
  /** Which states to explain (all five by default, in reading order) */
  states?: FieldState[];
  audience?: StateAudience;
  /** "cells" pairs each word with its field cell (beside strips); "icons" with its icon (beside chips) */
  kind?: "cells" | "icons";
  className?: string;
}

/**
 * The key to the field states: each one's cell (or icon) and word in a row.
 * Drop it beside a field strip or under a list that uses the cells.
 */
export function StateLegend({ states = FIELD_STATE_ORDER, audience = "staff", kind = "cells", className }: StateLegendProps) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] leading-normal text-ink-2", className)} aria-label="What the colours mean">
      {states.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          {kind === "cells" ? <FieldCell state={s} audience={audience} className="!size-3.5" /> : <StateIcon state={s} />}
          {stateShort(s, audience)}
        </li>
      ))}
    </ul>
  );
}
