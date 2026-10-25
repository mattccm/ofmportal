"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fillCell } from "./motion";
import {
  FIELD_STATE_ICON,
  FIELD_STATE_TEXT,
  UNSENT_ICON,
  fieldStateLabel,
  fieldStateShort,
  isUnsent,
  stripLabel,
  type FieldState,
  type FieldSummary,
  type StateAudience,
} from "./types";

export interface FieldCellProps {
  state: FieldState;
  /** The field's name, used for the tooltip */
  name?: string;
  /** Whose words the tooltip uses ("Ready to review" or "Waiting for review") */
  audience?: StateAudience;
  /** Creator side: a ready field not sent in yet (tooltip reads "Uploaded, not sent yet") */
  unsent?: boolean;
  className?: string;
}

/**
 * One field's state. Shape carries it as well as colour: to do is a hollow
 * grey outline, overdue a hollow red outline with an exclamation mark, ready
 * a plain blue fill, approved a green fill with a check, needs changes an
 * orange fill with an undo arrow (marks are drawn in CSS where the cell is
 * big enough; spines and bars keep fill versus outline). When the state
 * changes the fill animates in from its leading edge (none under reduced
 * motion).
 */
export function FieldCell({ state, name, audience = "staff", unsent, className }: FieldCellProps) {
  const inner = useRef<HTMLElement | null>(null);
  const prev = useRef(state);
  useEffect(() => {
    if (prev.current !== state && state !== "waiting" && state !== "overdue") fillCell(inner.current);
    prev.current = state;
  }, [state]);

  const label = fieldStateLabel(state, audience, unsent);
  return (
    <i
      ref={inner}
      className={cn("tw-cell", className)}
      data-state={state}
      title={name ? `${name}: ${label}` : label}
    >
      <span className="tw-cell-fill" />
    </i>
  );
}

export interface StateIconProps {
  state: FieldState;
  /** Creator side: draws the neutral upload icon for a ready field not sent in yet */
  unsent?: boolean;
  audience?: StateAudience;
  className?: string;
}

/** A state's icon in its colour. Decorative: the word beside it carries the meaning. */
export function StateIcon({ state, unsent, audience = "staff", className }: StateIconProps) {
  if (isUnsent(state, unsent, audience)) {
    return <UNSENT_ICON aria-hidden="true" className={cn("size-3.5 shrink-0 text-ink-2", className)} />;
  }
  const Icon = FIELD_STATE_ICON[state];
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", FIELD_STATE_TEXT[state], className)} />;
}

export interface StateWordProps extends StateIconProps {
  /** Overrides the word; the icon stays the state's */
  children?: ReactNode;
}

/**
 * A state written out as its icon and word, for a row or a field header. The
 * word stays quiet ink (the icon carries the hue) except for needs changes and
 * overdue, which ask the reader to act.
 */
export function StateWord({ state, unsent, audience = "staff", className, children }: StateWordProps) {
  const loud = !isUnsent(state, unsent, audience) && (state === "changes" || state === "overdue");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium",
        loud ? FIELD_STATE_TEXT[state] : "text-ink-2",
        className
      )}
    >
      <StateIcon state={state} unsent={unsent} audience={audience} />
      {children ?? fieldStateShort(state, audience, unsent)}
    </span>
  );
}

export interface FieldStripProps {
  fields: FieldSummary[];
  /**
   * - "cells": a row of small squares (list rows, tile details)
   * - "spine": the vertical strip down a request title card
   * - "labelled": one segment per field with its name, then the state's icon and word
   */
  variant?: "cells" | "spine" | "labelled";
  /** Whose words to use for the states (staff by default) */
  audience?: StateAudience;
  className?: string;
  /** Overrides the generated accessible name */
  label?: string;
}

/** The field strip: every field of a request, in order, as state. */
export function FieldStrip({ fields, variant = "cells", audience = "staff", className, label }: FieldStripProps) {
  const name = label ?? stripLabel(fields, audience);

  if (variant === "labelled") {
    return (
      <ol className={cn("tw-lstrip", className)} aria-label={name}>
        {fields.map((f, i) => (
          <li key={f.id ?? `${f.name}-${i}`} data-state={f.state}>
            <FieldCell state={f.state} name={f.name} audience={audience} unsent={f.unsent} />
            <span className="tw-lstrip-name" aria-hidden="true">{f.name}</span>
            <span className="tw-lstrip-state" aria-hidden="true">
              <StateIcon state={f.state} unsent={f.unsent} audience={audience} className="size-3" />
              {fieldStateShort(f.state, audience, f.unsent)}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <span
      className={cn(variant === "spine" ? "tw-spine" : "tw-cells", className)}
      role="img"
      aria-label={name}
    >
      {fields.map((f, i) => (
        <FieldCell key={f.id ?? `${f.name}-${i}`} state={f.state} name={f.name} audience={audience} unsent={f.unsent} />
      ))}
    </span>
  );
}
