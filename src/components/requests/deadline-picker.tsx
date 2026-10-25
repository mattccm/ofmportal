"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, timeLeft } from "@/components/title-wall";

/**
 * The due date, in-world: quick chips plus a drawn month calendar in a
 * popover. No native date-input chrome. Values are plain days ("2026-10-30"),
 * which the wall reads as due at 23:59 that day.
 *
 * Calendar keys: arrows move a day / a week, Home / End go to the week's
 * ends, Page Up / Page Down change month, Enter or Space picks, Esc closes.
 */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysIso(n: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
  return isoDay(d);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // weeks start on Monday
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  // drop a trailing week that belongs wholly to the next month
  return days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
}

export interface QuickDue {
  days: number;
  label: string;
}

export const DEFAULT_QUICK_DUE: QuickDue[] = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
];

export interface DueDateFieldProps {
  /** "YYYY-MM-DD" or "" for no due date */
  value: string;
  onChange: (value: string) => void;
  quick?: QuickDue[];
  /** Offer a "No due date" chip */
  allowNone?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** id for the group, so a label or an error can point at it */
  id?: string;
  /** Show the "Due Thu 22 Oct, 23:59 · 6 days left" line under the chips */
  showLine?: boolean;
  className?: string;
}

export function DueDateField({
  value,
  onChange,
  quick = DEFAULT_QUICK_DUE,
  allowNone = true,
  disabled,
  invalid,
  id,
  showLine = true,
  className,
}: DueDateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const today = React.useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const quickIsos = quick.map((q) => addDaysIso(q.days, today));
  const custom = !!value && !quickIsos.includes(value);
  const past = !!value && dayFromIso(value) < today;
  const left = value ? timeLeft(value) : null;

  const chip = (pressed: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-2 rounded-[var(--tw-r-ctl)] px-3.5 text-sm font-medium transition-colors duration-150 md:h-9",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
      pressed ? "!bg-ink text-ground" : "bg-well text-ink shadow-[inset_0_0_0_1px_var(--tw-ctl)] hover:shadow-[inset_0_0_0_1px_var(--tw-ctl-hi)]",
      "disabled:pointer-events-none disabled:opacity-60"
    );

  return (
    <div className={className}>
      <div
        id={id}
        role="group"
        aria-label="Due date"
        aria-invalid={invalid || undefined}
        className="relative flex flex-wrap items-center gap-2"
      >
        {quick.map((q, i) => (
          <button
            key={q.days}
            type="button"
            disabled={disabled}
            aria-pressed={value === quickIsos[i]}
            className={chip(value === quickIsos[i])}
            onClick={() => onChange(quickIsos[i])}
          >
            {q.label}
          </button>
        ))}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={custom}
          className={chip(custom)}
          onClick={() => setOpen((o) => !o)}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          {custom ? formatDay(value) : "Pick a date"}
        </button>
        {allowNone && (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={!value}
            className={chip(!value)}
            onClick={() => onChange("")}
          >
            No due date
          </button>
        )}
        {open && (
          <CalendarPopover
            value={value}
            min={today}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            onClose={(refocus) => {
              setOpen(false);
              if (refocus) triggerRef.current?.focus();
            }}
            triggerRef={triggerRef}
          />
        )}
      </div>
      {showLine && (
        <p className={cn("mt-2 text-sm font-medium", invalid && "text-late")} aria-live="polite">
          {value ? (
            past ? (
              <>That day has passed. Pick today or later.</>
            ) : (
              <>
                Due {formatDay(value)}, 23:59{" "}
                <span className={cn("font-normal", left?.urgent ? "text-late" : "text-ink-2")}>· {left?.text}</span>
              </>
            )
          ) : (
            <span className="font-normal text-ink-2">No due date. Reminders only run when there is one.</span>
          )}
        </p>
      )}
    </div>
  );
}

function CalendarPopover({
  value,
  min,
  onPick,
  onClose,
  triggerRef,
}: {
  value: string;
  min: Date;
  onPick: (iso: string) => void;
  onClose: (refocus: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const initial = value && dayFromIso(value) >= min ? dayFromIso(value) : min;
  const [cursor, setCursor] = React.useState<Date>(initial);
  const [month, setMonth] = React.useState<Date>(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const panelRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef(false);
  const selected = value ? dayFromIso(value) : null;
  const headingId = React.useId();

  // focus the cursor day on open and after every keyboard move
  React.useEffect(() => {
    const btn = gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]');
    btn?.focus();
  }, [cursor]);

  // close on outside press
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
    const next = d < min ? min : d;
    moved.current = true;
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
      case "Escape": onClose(true); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const days = monthGrid(month);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const canPrev = new Date(month.getFullYear(), month.getMonth(), 0) >= min;
  const cursorInMonth = cursor.getMonth() === month.getMonth() && cursor.getFullYear() === month.getFullYear();
  const tabDay = cursorInMonth ? cursor : days.find((d) => d.getMonth() === month.getMonth() && d >= min) ?? cursor;

  const shiftMonth = (n: number) => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(m);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      className="absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-32px))] rounded-[var(--tw-r-tile)] bg-raised p-3 shadow-xl shadow-black/40"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose(true);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="inline-flex size-9 items-center justify-center rounded-[var(--tw-r-ctl)] text-icon hover:bg-raised-hi hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-acc"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h3 id={headingId} className="text-[15px] font-semibold" aria-live="polite">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="inline-flex size-9 items-center justify-center rounded-[var(--tw-r-ctl)] text-icon hover:bg-raised-hi hover:text-ink focus-visible:outline-2 focus-visible:outline-acc"
        >
          <ChevronRight className="size-4" />
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
              const before = d < min;
              const isSel = !!selected && sameDay(d, selected);
              const isToday = sameDay(d, min);
              const isCursor = sameDay(d, tabDay) && !outside;
              return (
                <div role="gridcell" key={d.toISOString()} aria-selected={isSel}>
                  <button
                    type="button"
                    tabIndex={isCursor ? 0 : -1}
                    disabled={before}
                    aria-label={`${formatDay(isoDay(d))}${isToday ? ", today" : ""}`}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onPick(isoDay(d))}
                    onFocus={() => {
                      if (!sameDay(d, cursor) && !before) setCursor(d);
                    }}
                    className={cn(
                      "relative flex h-10 w-full items-center justify-center rounded-[var(--tw-r-ctl)] text-sm tabular-nums transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acc",
                      isSel ? "bg-ink font-semibold text-ground" : "hover:bg-raised-hi",
                      outside && !isSel && "text-ink-2",
                      before && "cursor-default text-ctl-hi line-through decoration-ctl hover:bg-transparent",
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
      <p className="pt-2 text-xs text-ink-2">Due at 23:59 on the day you pick.</p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Compatibility: the older Date-based API, now drawn with DueDateField.    */
/* ------------------------------------------------------------------------ */

interface DeadlinePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  disabled?: boolean;
  className?: string;
}

export function DeadlinePicker({ value, onChange, disabled, className }: DeadlinePickerProps) {
  return (
    <DueDateField
      value={value ? isoDay(new Date(value)) : ""}
      onChange={(v) => onChange?.(v ? new Date(`${v}T23:59:00`) : null)}
      disabled={disabled}
      className={className}
    />
  );
}

export function DeadlineQuickPicker({ value, onChange, className }: Omit<DeadlinePickerProps, "disabled">) {
  return (
    <DueDateField
      value={value ? isoDay(new Date(value)) : ""}
      onChange={(v) => onChange?.(v ? new Date(`${v}T23:59:00`) : null)}
      showLine={false}
      className={className}
    />
  );
}
