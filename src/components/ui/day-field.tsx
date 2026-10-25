"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayFromIso, isoDay } from "@/components/requests/deadline-picker";

/**
 * A single day, picked from the same drawn month calendar the request Due
 * field uses: no native date-input chrome. Unlike the Due field it allows past
 * days, so it suits filters ("uploaded from", "uploaded until").
 *
 * Value is a plain day ("2026-10-30") or "" for none.
 *
 * Calendar keys: arrows move a day / a week, Home / End go to the week's
 * ends, Page Up / Page Down change month, Enter or Space picks, Esc closes
 * and returns focus to the trigger.
 */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Thu 22 Oct", from a local day */
const dayLabel = (d: Date) => `${DOW_SUN[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // weeks start on Monday
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(first.getFullYear(), first.getMonth(), 1 - lead + i));
  return days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
}

export interface DayFieldProps {
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, also the trigger's text when empty ("Uploaded from") */
  label: string;
  /** Shorter visible text when empty; defaults to `label` */
  placeholder?: string;
  /** Earliest and latest days that can be picked ("YYYY-MM-DD") */
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

export function DayField({ value, onChange, label, placeholder, min, max, disabled, className }: DayFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [alignRight, setAlignRight] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const picked = value ? dayFromIso(value) : null;

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setAlignRight(r.left + 320 > window.innerWidth - 16);
    }
    setOpen((o) => !o);
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={picked ? `${label}: ${dayLabel(picked)}` : label}
        onClick={toggle}
        className={cn(
          "inline-flex h-11 w-full items-center gap-2 rounded-[var(--tw-r-ctl)] border border-input bg-well pl-3 text-left text-base transition-colors duration-150 hover:border-ctl-hi md:h-9 md:text-sm",
          "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          "disabled:pointer-events-none disabled:opacity-60",
          picked ? "pr-9 text-ink" : "pr-3 text-[#8e939c]"
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-icon" aria-hidden="true" />
        <span className="truncate">{picked ? dayLabel(picked) : placeholder ?? label}</span>
      </button>
      {picked && !disabled && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange("");
            triggerRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-icon hover:bg-tile-hi hover:text-ink focus-visible:outline-2 focus-visible:outline-ring md:size-7"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      {open && (
        <DayCalendar
          label={label}
          value={value}
          min={min ? dayFromIso(min) : null}
          max={max ? dayFromIso(max) : null}
          alignRight={alignRight}
          triggerRef={triggerRef}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
            triggerRef.current?.focus();
          }}
          onClose={(refocus) => {
            setOpen(false);
            if (refocus) triggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function DayCalendar({
  label,
  value,
  min,
  max,
  alignRight,
  triggerRef,
  onPick,
  onClose,
}: {
  label: string;
  value: string;
  min: Date | null;
  max: Date | null;
  alignRight: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onPick: (iso: string) => void;
  onClose: (refocus: boolean) => void;
}) {
  const today = React.useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const clamp = React.useCallback(
    (d: Date) => (min && d < min ? min : max && d > max ? max : d),
    [min, max]
  );
  const selected = value ? dayFromIso(value) : null;
  const [cursor, setCursor] = React.useState<Date>(() => clamp(selected ?? today));
  const [month, setMonth] = React.useState<Date>(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const panelRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const headingId = React.useId();

  // focus the cursor day on open and after every keyboard move
  React.useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [cursor]);

  // close on an outside press
  React.useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose, triggerRef]);

  const go = (d: Date) => {
    const next = clamp(d);
    setCursor(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const c = cursor;
    const at = (n: number) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + n);
    switch (e.key) {
      case "ArrowLeft": go(at(-1)); break;
      case "ArrowRight": go(at(1)); break;
      case "ArrowUp": go(at(-7)); break;
      case "ArrowDown": go(at(7)); break;
      case "Home": go(at(-((c.getDay() + 6) % 7))); break;
      case "End": go(at(6 - ((c.getDay() + 6) % 7))); break;
      case "PageUp": go(new Date(c.getFullYear(), c.getMonth() - 1, c.getDate())); break;
      case "PageDown": go(new Date(c.getFullYear(), c.getMonth() + 1, c.getDate())); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const days = monthGrid(month);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const out = (d: Date) => (!!min && d < min) || (!!max && d > max);
  const canPrev = !min || new Date(month.getFullYear(), month.getMonth(), 0) >= min;
  const canNext = !max || new Date(month.getFullYear(), month.getMonth() + 1, 1) <= max;
  const cursorInMonth = cursor.getMonth() === month.getMonth() && cursor.getFullYear() === month.getFullYear();
  const tabDay = cursorInMonth ? cursor : days.find((d) => d.getMonth() === month.getMonth() && !out(d)) ?? cursor;

  const navBtn =
    "inline-flex size-9 items-center justify-center rounded-[var(--tw-r-ctl)] text-icon hover:bg-raised-hi hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-acc";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      className={cn(
        "absolute top-full z-50 mt-2 w-[min(320px,calc(100vw-32px))] rounded-[var(--tw-r-tile)] bg-raised p-3 shadow-xl shadow-black/40",
        alignRight ? "right-0" : "left-0"
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose(true);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!canPrev} aria-label="Previous month" className={navBtn}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <h3 id={headingId} className="text-[15px] font-semibold" aria-live="polite">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h3>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} disabled={!canNext} aria-label="Next month" className={navBtn}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={headingId} onKeyDown={onKey} className="grid gap-0.5">
        <div role="row" className="grid grid-cols-7 gap-0.5">
          {DOW.map((d) => (
            <span key={d} role="columnheader" aria-label={d} className="py-1 text-center text-xs text-ink-2">
              {d.slice(0, 2)}
            </span>
          ))}
        </div>
        {weeks.map((w, wi) => (
          <div role="row" key={wi} className="grid grid-cols-7 gap-0.5">
            {w.map((d) => {
              const outside = d.getMonth() !== month.getMonth();
              const blocked = out(d);
              const isSel = !!selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              const isCursor = sameDay(d, tabDay) && !outside;
              return (
                <div role="gridcell" key={d.toISOString()} aria-selected={isSel}>
                  <button
                    type="button"
                    tabIndex={isCursor ? 0 : -1}
                    disabled={blocked}
                    aria-label={`${dayLabel(d)} ${d.getFullYear()}${isToday ? ", today" : ""}`}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onPick(isoDay(d))}
                    onFocus={() => {
                      if (!sameDay(d, cursor) && !blocked) setCursor(d);
                    }}
                    className={cn(
                      "relative flex h-10 w-full items-center justify-center rounded-[var(--tw-r-ctl)] text-sm tabular-nums transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acc",
                      isSel ? "bg-ink font-semibold text-ground" : "hover:bg-raised-hi",
                      outside && !isSel && "text-ink-2",
                      blocked && "cursor-default text-ctl-hi line-through decoration-ctl hover:bg-transparent",
                      isToday && !isSel && "font-semibold underline decoration-2 underline-offset-4"
                    )}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
