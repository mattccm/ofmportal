"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_AGENCY_MESSAGING,
  EVENT_CHOICES,
  MAX_STEPS,
  REQUEST_EVENTS,
  SCHEDULE_EVENTS,
  describeSteps,
  newStepId,
  type AgencyMessaging,
  type ChannelChoice,
  type EventChoice,
  type MessageEvent,
  type MessagingPlan,
  type ReminderStep,
} from "@/lib/messaging";

/** The agency defaults, for showing what "Agency default" means. Falls back to the built-in defaults */
export function useAgencyMessaging(enabled = true): AgencyMessaging {
  const [value, setValue] = React.useState<AgencyMessaging>(DEFAULT_AGENCY_MESSAGING);
  React.useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/api/settings/messaging")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d?.messaging && setValue(d.messaging))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return value;
}

export function channelWords(c: ChannelChoice): string {
  if (!c.email && !c.sms) return "Don't send";
  if (c.email && c.sms) return c.pick === "preferred" ? "Email or text, by preference" : "Email and text";
  return c.email ? "Email" : "Text";
}

/** A two-to-four option segmented control (radio semantics) on the well track */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full gap-0.5 rounded-[8px] bg-well p-0.5", className)}>
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i + 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i - 1);
            }
          }}
          className={cn(
            "inline-flex h-10 items-center whitespace-nowrap rounded-[7px] px-3 text-sm font-medium text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring md:h-8",
            value === o.id && "bg-tile-hi text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Email / Text as two pressable chips */
export function ChannelToggles({
  email,
  sms,
  onChange,
  label,
}: {
  email: boolean;
  sms: boolean;
  onChange: (next: { email: boolean; sms: boolean }) => void;
  label: string;
}) {
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-10 min-w-[64px] items-center justify-center rounded-[8px] border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-8",
      on ? "border-transparent bg-ink text-ground hover:bg-white" : "border-ctl text-ink-2 hover:border-ctl-hi hover:text-ink"
    );
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1.5">
      <button type="button" aria-pressed={email} className={chip(email)} onClick={() => onChange({ email: !email, sms })}>
        Email
      </button>
      <button type="button" aria-pressed={sms} className={chip(sms)} onClick={() => onChange({ email, sms: !sms })}>
        Text
      </button>
    </div>
  );
}

type When = ReminderStep["when"];
const WHEN_OPTIONS: { id: When; label: string }[] = [
  { id: "before", label: "Days before" },
  { id: "due", label: "On the due day" },
  { id: "overdue", label: "Once overdue" },
];

function clampInt(v: string, min: number, max: number, fallback: number) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Ordered reminder steps: timing + channels, add / remove / move */
export function StepsEditor({ steps, onChange, idPrefix }: { steps: ReminderStep[]; onChange: (s: ReminderStep[]) => void; idPrefix: string }) {
  const set = (i: number, s: ReminderStep) => onChange(steps.map((x, j) => (j === i ? s : x)));
  const swap = (i: number, j: number) => {
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const retime = (s: ReminderStep, when: When): ReminderStep => {
    const base = { id: s.id, email: s.email, sms: s.sms };
    if (when === "before") return { ...base, when, days: s.when === "before" ? s.days : 1 };
    if (when === "due") return { ...base, when };
    return { ...base, when, every: s.when === "overdue" ? s.every : 1, max: s.when === "overdue" ? s.max : 3 };
  };
  const add = () => {
    const last = steps[steps.length - 1];
    const next: ReminderStep = !last
      ? { id: newStepId(), when: "before", days: 3, email: true, sms: false }
      : last.when === "before" && last.days > 1
        ? { id: newStepId(), when: "before", days: Math.max(1, last.days - 2), email: true, sms: false }
        : last.when === "overdue"
          ? { id: newStepId(), when: "before", days: 1, email: true, sms: false }
          : { id: newStepId(), when: "overdue", every: 2, max: 3, email: true, sms: false };
    onChange([...steps, next]);
  };

  return (
    <div className="space-y-2">
      {steps.length === 0 && <p className="text-sm text-ink-2">No reminders. Add a step, or creators get none for these requests.</p>}
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const name = `Step ${i + 1}`;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] bg-tile-hi px-3 py-2.5">
              <Select value={s.when} onValueChange={(v) => set(i, retime(s, v as When))}>
                <SelectTrigger aria-label={`${name}: when`} className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHEN_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {s.when === "before" && (
                <label className="inline-flex items-center gap-2 text-sm text-ink-2">
                  <Input
                    id={`${idPrefix}-d-${s.id}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={s.days}
                    onChange={(e) => set(i, { ...s, days: clampInt(e.target.value, 1, 60, s.days) })}
                    className="w-[72px] tabular-nums"
                    aria-label={`${name}: days before the due day`}
                  />
                  {s.days === 1 ? "day before" : "days before"}
                </label>
              )}
              {s.when === "overdue" && (
                <span className="inline-flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  every
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    value={s.every}
                    onChange={(e) => set(i, { ...s, every: clampInt(e.target.value, 1, 30, s.every) })}
                    className="w-[64px] tabular-nums"
                    aria-label={`${name}: every how many days`}
                  />
                  {s.every === 1 ? "day, up to" : "days, up to"}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    value={s.max}
                    onChange={(e) => set(i, { ...s, max: clampInt(e.target.value, 1, 10, s.max) })}
                    className="w-[64px] tabular-nums"
                    aria-label={`${name}: at most how many times`}
                  />
                  {s.max === 1 ? "time" : "times"}
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1.5">
                <ChannelToggles label={`${name}: channels`} email={s.email} sms={s.sms} onChange={(c) => set(i, { ...s, ...c })} />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => swap(i, i - 1)} disabled={i === 0} aria-label={`Move ${name.toLowerCase()} up`}>
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => swap(i, i + 1)} disabled={i === steps.length - 1} aria-label={`Move ${name.toLowerCase()} down`}>
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label={`Remove ${name.toLowerCase()}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </span>
              {!s.email && !s.sms && <p className="basis-full text-[13px] text-ink-2">Pick email, text or both, or this step sends nothing.</p>}
            </li>
          );
        })}
      </ol>
      {steps.length < MAX_STEPS && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden="true" />
          Add a step
        </Button>
      )}
    </div>
  );
}

export const EMPTY_PLAN: MessagingPlan = { v: 1, events: {}, schedule: null };
export const STARTER_STEPS = (): ReminderStep[] => [
  { id: newStepId(), when: "before", days: 3, email: true, sms: false },
  { id: newStepId(), when: "before", days: 1, email: true, sms: true },
  { id: newStepId(), when: "overdue", every: 2, max: 3, email: true, sms: true },
];

/**
 * The whole plan: "Use agency defaults" or own settings (per-event channel
 * choice and reminder steps). `value` null = agency defaults.
 */
export function PlanEditor({
  value,
  onChange: setValue,
  agency,
  scope,
  idPrefix,
}: {
  value: MessagingPlan | null;
  onChange: (v: MessagingPlan | null) => void;
  agency: AgencyMessaging;
  /** "template" or "request": the words used */
  scope: "template" | "request";
  idPrefix: string;
}) {
  // Keep the last own plan so flipping to defaults and back doesn't lose it
  const [lastOwn, setLastOwn] = React.useState<MessagingPlan | null>(value);
  const onChange = (v: MessagingPlan | null) => {
    if (v) setLastOwn(v);
    setValue(v);
  };
  const own = value !== null;
  const plan = value ?? EMPTY_PLAN;
  const ownSchedule = plan.schedule !== null;

  const setEvent = (e: MessageEvent, c: EventChoice) => onChange({ ...plan, events: { ...plan.events, [e]: c } });
  const shownEvents = REQUEST_EVENTS.filter((e) => !(ownSchedule && SCHEDULE_EVENTS.includes(e.id)));

  return (
    <div className="space-y-5">
      <Segmented
        label={`Messages for this ${scope}`}
        value={own ? "own" : "defaults"}
        options={[
          { id: "defaults", label: "Use agency defaults" },
          { id: "own", label: `Set for this ${scope}` },
        ]}
        onChange={(v) => onChange(v === "defaults" ? null : (lastOwn ?? { ...EMPTY_PLAN, schedule: STARTER_STEPS() }))}
      />

      {!own ? (
        <p className="text-sm text-ink-2">
          Reminders follow the agency&rsquo;s timing, and each message goes the way Reminders, Email and texts says.
        </p>
      ) : (
        <>
          <section aria-labelledby={`${idPrefix}-rem`} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id={`${idPrefix}-rem`} className="text-[15px] font-semibold text-ink">
                Reminders
              </h3>
              <Segmented
                label="Reminder schedule"
                value={ownSchedule ? "steps" : "rules"}
                options={[
                  { id: "rules", label: "Agency reminder rules" },
                  { id: "steps", label: "Own steps" },
                ]}
                onChange={(v) => onChange({ ...plan, schedule: v === "rules" ? null : plan.schedule ?? STARTER_STEPS() })}
              />
            </div>
            {ownSchedule ? (
              <>
                <StepsEditor idPrefix={idPrefix} steps={plan.schedule!} onChange={(s) => onChange({ ...plan, schedule: s })} />
                <p className="text-sm text-ink" aria-live="polite">
                  {describeSteps(plan.schedule!)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-2">The reminder rule for the request&rsquo;s urgency decides when; the channels below decide how.</p>
            )}
          </section>

          <section aria-labelledby={`${idPrefix}-msg`} className="space-y-2">
            <h3 id={`${idPrefix}-msg`} className="text-[15px] font-semibold text-ink">
              How each message goes
            </h3>
            <ul className="divide-y divide-line">
              {shownEvents.map((e) => {
                const choice = plan.events[e.id] ?? "inherit";
                const inherited = channelWords(agency.events[e.id]);
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                    <span className="text-sm text-ink" id={`${idPrefix}-ev-${e.id}`}>
                      {e.label}
                    </span>
                    <Select value={choice} onValueChange={(v) => setEvent(e.id, v as EventChoice)}>
                      <SelectTrigger aria-labelledby={`${idPrefix}-ev-${e.id}`} className="w-full sm:w-[290px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_CHOICES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.id === "inherit" ? `Default: ${inherited.toLowerCase()}` : c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
            {agency.respectPreference && (
              <p className="text-[13px] text-ink-2">Texts only go to creators who prefer texts and have a phone number; anyone a text can&rsquo;t reach gets an email instead.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** One line for a plan: what reminders and messages it sets */
export function planSummary(plan: MessagingPlan | null, scopeWord = "Agency defaults"): string {
  if (!plan) return scopeWord;
  const parts: string[] = [];
  if (plan.schedule) parts.push(describeSteps(plan.schedule));
  else parts.push("Agency reminder rules");
  const changed = REQUEST_EVENTS.filter((e) => plan.events[e.id] && plan.events[e.id] !== "inherit" && !(plan.schedule && SCHEDULE_EVENTS.includes(e.id)));
  if (changed.length) parts.push(changed.map((e) => `${e.label.toLowerCase()}: ${EVENT_CHOICES.find((c) => c.id === plan.events[e.id])!.label.toLowerCase()}`).join(", "));
  return parts.join(" · ");
}
