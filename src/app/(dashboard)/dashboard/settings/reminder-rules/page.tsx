"use client";

import * as React from "react";
import { Loader2, MessageSquare, Mail, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReminderSettingsPanel, TieredTemplatesPanel } from "@/components/reminders";
import { EmptyLine, PageHead, Panel, SettingsSection } from "@/components/creators/people-ui";
import { cityOf, contactLabel, plural, type QuietHours } from "@/components/creators/insights";
import { reminderEmailSubject, reminderSmsBody, withBrandPrefix } from "@/lib/reminder-copy";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- types

type Urgency = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type Frequency = "NONE" | "DAILY" | "EVERY_2_DAYS" | "EVERY_3_DAYS" | "WEEKLY";

interface ReminderRule {
  id?: string;
  urgency: Urgency;
  reminderDays: number[];
  overdueReminderFrequency: Frequency;
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
  isActive: boolean;
  name?: string;
  description?: string;
}

interface PreviewCreator {
  id: string;
  name: string;
  preferredContact: string;
  timezone: string;
  hasPhone: boolean;
  quiet: QuietHours;
  paused: boolean;
  disabled: boolean;
}

interface PreviewContext {
  sender: string;
  portalBase: string;
  creators: PreviewCreator[];
}

const ORDER: Urgency[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const URGENCY_LABEL: Record<Urgency, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };
const DEFAULT_DAYS: Record<Urgency, number[]> = { LOW: [5, 2, 0], NORMAL: [3, 1, 0], HIGH: [2, 1, 0], URGENT: [1, 0] };
const FREQ: { value: Frequency; label: string; every: number }[] = [
  { value: "NONE", label: "Stop at the due date", every: 0 },
  { value: "DAILY", label: "Every day", every: 1 },
  { value: "EVERY_2_DAYS", label: "Every 2 days", every: 2 },
  { value: "EVERY_3_DAYS", label: "Every 3 days", every: 3 },
  { value: "WEEKLY", label: "Every week", every: 7 },
];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

// ---------------------------------------------------------------- the schedule, as the scheduler builds it

interface Moment {
  key: string;
  /** days until due when it goes out (negative: overdue) */
  daysUntilDue: number;
  sms: boolean;
  label: string;
}

/** Mirrors calculateReminderSchedule in src/lib/auto-reminder-scheduler.ts */
function momentsOf(rule: ReminderRule, prefersSms: boolean): Moment[] {
  const out: Moment[] = [];
  for (const d of [...rule.reminderDays].sort((a, b) => b - a)) {
    out.push({ key: `b${d}`, daysUntilDue: d, sms: prefersSms, label: d === 0 ? "On the due date" : `${plural(d, "day")} before due` });
  }
  const every = FREQ.find((f) => f.value === rule.overdueReminderFrequency)?.every ?? 0;
  if (every) {
    for (let i = 1; i <= rule.maxOverdueReminders; i++) {
      const late = every * i;
      const esc = rule.escalateToSms && rule.smsEscalationDays != null && late >= rule.smsEscalationDays;
      out.push({ key: `a${late}`, daysUntilDue: -late, sms: esc || prefersSms, label: `${plural(late, "day")} overdue${esc ? ", by SMS" : ""}` });
    }
  }
  return out;
}

function ruleSummary(r: ReminderRule): string {
  const days = [...r.reminderDays].sort((a, b) => b - a);
  const before = days.map((d) => (d === 0 ? "on the due date" : `${d} ${d === 1 ? "day" : "days"} before`));
  const list = before.length > 1 ? `${before.slice(0, -1).join(", ")} and ${before[before.length - 1]}` : before[0] ?? "no reminders before the due date";
  const f = FREQ.find((x) => x.value === r.overdueReminderFrequency);
  const after = f && f.every ? `, then ${f.label.toLowerCase()} while overdue, up to ${r.maxOverdueReminders}` : "";
  const sms = r.escalateToSms && r.smsEscalationDays ? `. SMS from ${plural(r.smsEscalationDays, "day")} overdue` : "";
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}${after}${sms}.`;
}

/** Minutes after midnight for "HH:mm" */
const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

function inQuiet(local: number, q: QuietHours): boolean {
  if (!q.enabled) return false;
  const s = mins(q.start);
  const e = mins(q.end);
  return s > e ? local >= s || local < e : local >= s && local < e;
}

/**
 * When a reminder for `sendDay` reaches the creator, in their own time.
 * Reminders are scheduled for the start of the day on the server (UTC) and
 * the hourly run holds them back through quiet hours.
 */
function arrival(sendDay: Date, tz: string, q: QuietHours): { time: string; day: Date } {
  const at = new Date(Date.UTC(sendDay.getFullYear(), sendDay.getMonth(), sendDay.getDate(), 0, 0));
  let hh = 0;
  let mm = 0;
  let localDay = sendDay;
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    hh = get("hour") % 24;
    mm = get("minute");
    localDay = new Date(get("year"), get("month") - 1, get("day"));
  } catch {
    /* unknown zone: keep UTC midnight */
  }
  let local = hh * 60 + mm;
  if (inQuiet(local, q)) {
    const end = mins(q.end);
    if (end < local) localDay = new Date(localDay.getTime() + 86_400_000);
    local = end;
  } else if (mm > 0) {
    local = (hh + 1) * 60; // the next hourly run
  }
  const t = `${String(Math.floor(local / 60) % 24).padStart(2, "0")}:${String(local % 60).padStart(2, "0")}`;
  return { time: t, day: localDay };
}

const longDay = (d: Date) => d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (d: Date) => d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });

// ---------------------------------------------------------------- page

export default function ReminderRulesPage() {
  const [rules, setRules] = React.useState<ReminderRule[]>([]);
  const [missing, setMissing] = React.useState<Urgency[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Urgency | null>(null);
  const [saving, setSaving] = React.useState<Urgency | null>(null);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [ctx, setCtx] = React.useState<PreviewContext | null>(null);
  const [creatorId, setCreatorId] = React.useState<string>("");
  const [ruleKey, setRuleKey] = React.useState<Urgency>("NORMAL");
  const [momentKey, setMomentKey] = React.useState<string>("");
  const [quietSaving, setQuietSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.all([fetch("/api/reminder-rules"), fetch("/api/reminder-rules/preview")]);
      if (!r1.ok) throw new Error();
      const data = await r1.json();
      setRules(data.rules);
      setMissing(data.missingUrgencies);
      if (r2.ok) {
        const c: PreviewContext = await r2.json();
        setCtx(c);
        setCreatorId((prev) => prev || c.creators[0]?.id || "");
      }
    } catch {
      setError("Reminder rules could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...rules].sort((a, b) => ORDER.indexOf(a.urgency) - ORDER.indexOf(b.urgency));
  const on = rules.filter((r) => r.isActive);

  // ---------- rule writes
  const putRule = async (rule: ReminderRule, patch: Partial<ReminderRule>) => {
    const body = rule.id ? { id: rule.id, ...patch } : { ...rule, ...patch };
    const res = await fetch("/api/reminder-rules", {
      method: rule.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error || "The rule could not be saved");
    }
    const d = await res.json();
    setRules((prev) => prev.map((r) => (r.urgency === rule.urgency ? d.rule : r)));
    return d.rule as ReminderRule;
  };

  const toggle = async (rule: ReminderRule, next: boolean) => {
    setRules((prev) => prev.map((r) => (r.urgency === rule.urgency ? { ...r, isActive: next } : r)));
    try {
      const saved = await putRule(rule, { isActive: next });
      const label = `${URGENCY_LABEL[rule.urgency]} rule ${next ? "on" : "off"}`;
      toast(label, {
        action: {
          label: "Undo",
          onClick: () => {
            setRules((prev) => prev.map((r) => (r.urgency === rule.urgency ? { ...r, isActive: !next } : r)));
            putRule(saved, { isActive: !next }).catch(() => toast.error("Undo failed. Flip the switch back instead."));
          },
        },
      });
    } catch (e) {
      setRules((prev) => prev.map((r) => (r.urgency === rule.urgency ? { ...r, isActive: !next } : r)));
      toast.error(`${e instanceof Error ? e.message : "The rule could not be saved"}. Only owners and admins can change rules.`);
    }
  };

  const saveRule = async (rule: ReminderRule) => {
    setSaving(rule.urgency);
    try {
      await putRule(rule, rule);
      toast.success(`${URGENCY_LABEL[rule.urgency]} rule saved`);
      setEditing(null);
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "The rule could not be saved"}. Check the numbers and try again.`);
    } finally {
      setSaving(null);
    }
  };

  const removeRule = async (rule: ReminderRule) => {
    if (rule.id) {
      const res = await fetch(`/api/reminder-rules?id=${rule.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("The rule could not be removed. Try again.");
        return;
      }
      toast(`${URGENCY_LABEL[rule.urgency]} rule removed. Requests of that urgency fall back to 3, 1 and 0 days before.`);
    }
    setRules((prev) => prev.filter((r) => r.urgency !== rule.urgency));
    setMissing((prev) => [...prev, rule.urgency]);
    setEditing(null);
  };

  const addRule = (u: Urgency) => {
    setRules((prev) => [
      ...prev,
      {
        urgency: u,
        reminderDays: DEFAULT_DAYS[u],
        overdueReminderFrequency: "DAILY",
        maxOverdueReminders: 5,
        smsEscalationDays: null,
        escalateToSms: false,
        isActive: true,
      },
    ]);
    setMissing((prev) => prev.filter((x) => x !== u));
    setEditing(u);
  };

  const rescheduleAll = async () => {
    setRescheduling(true);
    try {
      const res = await fetch("/api/reminder-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, rescheduleExisting: true }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      toast.success(`Reminders rescheduled for ${plural(d.rescheduleResult?.success || 0, "request")}`);
    } catch {
      toast.error("Reminders could not be rescheduled. Try again.");
    } finally {
      setRescheduling(false);
    }
  };

  // ---------- quiet hours
  const setQuiet = async (c: PreviewCreator, q: QuietHours) => {
    const before = c.quiet;
    const apply = (val: QuietHours) =>
      setCtx((prev) => (prev ? { ...prev, creators: prev.creators.map((x) => (x.id === c.id ? { ...x, quiet: val } : x)) } : prev));
    apply({ ...q, isDefault: false });
    setQuietSaving(c.id);
    try {
      const res = await fetch(`/api/creators/${c.id}/quiet-hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: q.enabled, start: q.start, end: q.end }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Quiet hours could not be saved");
      }
      const d = await res.json();
      apply(d.quiet);
    } catch (e) {
      apply(before);
      toast.error(`${e instanceof Error ? e.message : "Quiet hours could not be saved"}. Try again.`);
    } finally {
      setQuietSaving(null);
    }
  };

  // ---------- preview
  const creator = ctx?.creators.find((c) => c.id === creatorId) ?? null;
  const previewRule = rules.find((r) => r.urgency === ruleKey) ?? sorted[0];
  const prefersSms = creator?.preferredContact === "SMS";
  const moments = previewRule ? momentsOf(previewRule, prefersSms) : [];
  const moment = moments.find((m) => m.key === momentKey) ?? moments[0];
  const sampleDue = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 7);
    return d;
  }, []);
  const sendDay = moment ? new Date(sampleDue.getTime() - moment.daysUntilDue * 86_400_000) : sampleDue;
  const arrive = creator ? arrival(sendDay, creator.timezone, creator.quiet) : { time: "09:00", day: sendDay };
  const smsGoes = !!moment && moment.sms && !!creator?.hasPhone;
  const emailGoes = !!moment && !moment.sms;
  const firstName = creator?.name ?? "Jade";
  const link = `${ctx?.portalBase ?? "/portal/"}…`;
  const sms = moment ? withBrandPrefix(reminderSmsBody({ creatorName: firstName, daysUntilDue: moment.daysUntilDue, portalLink: link })) : "";
  const subject = moment ? reminderEmailSubject(moment.daysUntilDue) : "";

  const lede = loading
    ? "Loading reminder rules"
    : error
      ? error
      : `${on.length} of ${plural(rules.length, "rule")} on. Texts and emails never carry a request title.`;

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHead title="Reminder rules" lede={lede} back={{ href: "/dashboard/settings", label: "Settings" }} />
        <div className="h-64 rounded-[10px] bg-tile motion-safe:animate-pulse" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHead
        title="Reminder rules"
        lede={lede}
        back={{ href: "/dashboard/settings", label: "Settings" }}
        actions={
          <Button variant="outline" onClick={rescheduleAll} disabled={rescheduling || rules.length === 0}>
            {rescheduling ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            Reschedule open requests
          </Button>
        }
      />

      {error && (
        <EmptyLine>
          {error}{" "}
          <button type="button" onClick={() => void load()} className="font-medium text-ink underline underline-offset-[3px]">
            Try again
          </button>
        </EmptyLine>
      )}

      {/* ---------------- rules ---------------- */}
      <SettingsSection
        id="rules"
        title="Rules by urgency"
        description="Each request follows the rule for its urgency, by the channel the creator prefers. A creator with their own schedule overrides these. Changes apply to new requests; Reschedule open requests applies them to the rest."
      >
        <Panel className="p-0 sm:p-0">
          {sorted.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">No rules yet. Without one, requests remind 3 days, 1 day and 0 days before they are due.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sorted.map((r) => (
                <li key={r.urgency} className="px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-ink">
                        {URGENCY_LABEL[r.urgency]} urgency
                        {!r.id && <span className="text-[13px] font-medium text-ink-2">not saved yet</span>}
                      </p>
                      <p className={cn("mt-0.5 text-sm", r.isActive ? "text-ink" : "text-ink-2")}>
                        {r.isActive ? ruleSummary(r) : "Off. Requests of this urgency use the default 3, 1 and 0 days before."}
                      </p>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      aria-expanded={editing === r.urgency}
                      onClick={() => setEditing(editing === r.urgency ? null : r.urgency)}
                    >
                      {editing === r.urgency ? "Close" : "Edit"}
                    </Button>
                    {r.id && (
                      <Switch
                        checked={r.isActive}
                        onCheckedChange={(v) => void toggle(r, v)}
                        aria-label={`${URGENCY_LABEL[r.urgency]} urgency rule`}
                        className="mt-1"
                      />
                    )}
                  </div>
                  {editing === r.urgency && (
                    <RuleEditor
                      rule={r}
                      saving={saving === r.urgency}
                      onChange={(patch) => setRules((prev) => prev.map((x) => (x.urgency === r.urgency ? { ...x, ...patch } : x)))}
                      onSave={() => void saveRule(r)}
                      onRemove={() => void removeRule(r)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
              <span className="text-sm text-ink-2">Add a rule for</span>
              {ORDER.filter((u) => missing.includes(u)).map((u) => (
                <Button key={u} variant="outline" size="sm" onClick={() => addRule(u)}>
                  <Plus aria-hidden="true" />
                  {URGENCY_LABEL[u]}
                </Button>
              ))}
            </div>
          )}
        </Panel>
      </SettingsSection>

      {/* ---------------- lock screen ---------------- */}
      <SettingsSection
        id="lock"
        title="On a creator’s lock screen"
        description="The reminder exactly as it lands, for the creator and moment you pick. It follows the rules and quiet hours on this page."
        aside={
          ctx && ctx.creators.length > 0 ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="pv-creator" className="mb-1.5 block text-sm font-medium text-ink">
                  Creator
                </label>
                <Select value={creatorId} onValueChange={setCreatorId}>
                  <SelectTrigger id="pv-creator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ctx.creators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="pv-rule" className="mb-1.5 block text-sm font-medium text-ink">
                  Rule
                </label>
                <Select
                  value={previewRule?.urgency ?? ""}
                  onValueChange={(v) => {
                    setRuleKey(v as Urgency);
                    setMomentKey("");
                  }}
                >
                  <SelectTrigger id="pv-rule">
                    <SelectValue placeholder="No rules yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {sorted.map((r) => (
                      <SelectItem key={r.urgency} value={r.urgency}>
                        {URGENCY_LABEL[r.urgency]} urgency{r.isActive ? "" : " (off)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="pv-moment" className="mb-1.5 block text-sm font-medium text-ink">
                  Reminder
                </label>
                <Select value={moment?.key ?? ""} onValueChange={setMomentKey}>
                  <SelectTrigger id="pv-moment">
                    <SelectValue placeholder="This rule sends nothing" />
                  </SelectTrigger>
                  <SelectContent>
                    {moments.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : undefined
        }
      >
        {!ctx || !creator ? (
          <EmptyLine>The preview appears once there is a creator to send to.</EmptyLine>
        ) : (
          <Panel className="grid gap-6 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
            <div
              className="mx-auto flex w-full max-w-[320px] flex-col rounded-[28px] bg-ground px-4 pb-8 pt-6"
              role="img"
              aria-label={`${firstName}'s lock screen at ${arrive.time}: ${[smsGoes ? `a text reading ${sms}` : null, emailGoes ? `an email from ${ctx.sender} with the subject ${subject}` : null].filter(Boolean).join(", and ") || "nothing"}`}
            >
              <p className="text-center text-sm text-ink-2" aria-hidden="true">
                {longDay(arrive.day)}
              </p>
              <p className="text-center text-[40px] font-bold leading-none tracking-[-0.02em] text-ink tabular-nums" aria-hidden="true">
                {arrive.time}
              </p>
              <div className="mt-6 space-y-2" aria-hidden="true">
                {smsGoes && (
                  <div className="rounded-[16px] bg-raised p-3">
                    <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <MessageSquare className="size-3.5" />
                      <span className="flex-1 font-semibold text-ink">Messages</span>
                      {arrive.time}
                    </p>
                    <p className="mt-1 break-words text-[13.5px] leading-snug text-ink">{sms}</p>
                  </div>
                )}
                {emailGoes && (
                  <div className="rounded-[16px] bg-raised p-3">
                    <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <Mail className="size-3.5" />
                      <span className="flex-1 truncate font-semibold text-ink">Mail · {ctx.sender}</span>
                      {arrive.time}
                    </p>
                    <p className="mt-1 text-[13.5px] font-semibold leading-snug text-ink">{subject}</p>
                  </div>
                )}
                {!smsGoes && !emailGoes && (
                  <p className="rounded-[16px] bg-raised p-3 text-[13.5px] text-ink-2">Nothing arrives: this reminder goes by SMS and {firstName} has no phone number.</p>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">{creator.name}</h3>
              <dl className="mt-2 divide-y divide-line text-sm">
                {[
                  ["Arrives", `${arrive.time} their time, ${shortDay(arrive.day)}`],
                  ["Goes by", moment ? (moment.sms ? (creator.hasPhone ? "SMS" : "SMS, but no phone number") : "Email") : "Nothing"],
                  ["They prefer", contactLabel(creator.preferredContact)],
                  ["Time zone", cityOf(creator.timezone)],
                  ["Quiet hours", creator.quiet.enabled ? `${creator.quiet.start}–${creator.quiet.end}` : "None"],
                  ["Request title shown", "Never"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                For a request due {shortDay(sampleDue)}.
                {creator.preferredContact === "BOTH" ? " Creators who prefer both get reminders by email; SMS joins once a rule escalates." : ""}
                {creator.paused ? ` ${firstName}'s reminders are paused right now, so nothing goes out until they resume.` : ""}
                {creator.disabled ? ` Reminders are turned off for ${firstName}.` : ""}
                {previewRule && !previewRule.isActive ? " This rule is off, so the default schedule applies instead." : ""}
              </p>
            </div>
          </Panel>
        )}
      </SettingsSection>

      {/* ---------------- quiet hours ---------------- */}
      <SettingsSection
        id="quiet"
        title="Quiet hours"
        description="No reminder lands in these hours, in the creator's own time. A reminder due inside them waits until they end. Every creator starts on 22:00 to 08:00."
        aside={
          ctx ? (
            <p>
              <b className="font-semibold">{plural(ctx.creators.filter((c) => !c.quiet.isDefault).length, "creator")}</b> keep their own hours;{" "}
              {ctx.creators.filter((c) => c.quiet.isDefault).length} use the default.
            </p>
          ) : undefined
        }
      >
        <Panel className="p-0 sm:p-0">
          {!ctx || ctx.creators.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">Quiet hours are set per creator. Invite a creator to set theirs.</p>
          ) : (
            <ul className="divide-y divide-line">
              {ctx.creators.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <div className="min-w-[140px] flex-1">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-[13px] text-ink-2">
                      {cityOf(c.timezone)}
                      {c.quiet.isDefault ? " · default" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={c.quiet.start}
                      disabled={!c.quiet.enabled || quietSaving === c.id}
                      onValueChange={(v) => void setQuiet(c, { ...c.quiet, start: v })}
                    >
                      <SelectTrigger className="w-[108px] md:w-[96px]" aria-label={`Quiet hours for ${c.name} start`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-ink-2">to</span>
                    <Select
                      value={c.quiet.end}
                      disabled={!c.quiet.enabled || quietSaving === c.id}
                      onValueChange={(v) => void setQuiet(c, { ...c.quiet, end: v })}
                    >
                      <SelectTrigger className="w-[108px] md:w-[96px]" aria-label={`Quiet hours for ${c.name} end`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={c.quiet.enabled}
                      disabled={quietSaving === c.id}
                      onCheckedChange={(v) => void setQuiet(c, { ...c.quiet, enabled: v })}
                      aria-label={`Quiet hours for ${c.name}`}
                      className="ml-2"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </SettingsSection>

      {/* ---------------- wording and tests (kept) ---------------- */}
      <SettingsSection
        id="more"
        title="Wording and tests"
        description="Message templates by tier, a test reminder to yourself, and the schedule laid out on a calendar."
      >
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Message templates</TabsTrigger>
            <TabsTrigger value="test">Test and calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <TieredTemplatesPanel />
          </TabsContent>
          <TabsContent value="test">
            <ReminderSettingsPanel rules={rules} />
          </TabsContent>
        </Tabs>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------- inline editor

function RuleEditor({
  rule,
  saving,
  onChange,
  onSave,
  onRemove,
}: {
  rule: ReminderRule;
  saving: boolean;
  onChange: (patch: Partial<ReminderRule>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const [days, setDays] = React.useState(rule.reminderDays.join(", "));
  const id = `rule-${rule.urgency}`;
  const commitDays = () => {
    const parsed = [...new Set(days.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 30))].sort((a, b) => b - a);
    setDays(parsed.join(", "));
    onChange({ reminderDays: parsed.length ? parsed : [0] });
  };
  return (
    <div className="mt-4 grid gap-4 rounded-[8px] bg-well p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-days`} className="mb-1.5 block text-sm font-medium text-ink">
          Days before the due date
        </label>
        <Input id={`${id}-days`} value={days} onChange={(e) => setDays(e.target.value)} onBlur={commitDays} inputMode="numeric" placeholder="3, 1, 0" />
        <p className="mt-1 text-[13px] text-ink-2">Comma-separated. 0 is the due date itself.</p>
      </div>
      <div>
        <label htmlFor={`${id}-freq`} className="mb-1.5 block text-sm font-medium text-ink">
          While overdue
        </label>
        <Select value={rule.overdueReminderFrequency} onValueChange={(v) => onChange({ overdueReminderFrequency: v as Frequency })}>
          <SelectTrigger id={`${id}-freq`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label htmlFor={`${id}-max`} className="mb-1.5 block text-sm font-medium text-ink">
          At most
        </label>
        <Input
          id={`${id}-max`}
          type="number"
          min={0}
          max={20}
          value={rule.maxOverdueReminders}
          disabled={rule.overdueReminderFrequency === "NONE"}
          onChange={(e) => onChange({ maxOverdueReminders: Math.min(20, Math.max(0, parseInt(e.target.value) || 0)) })}
        />
      </div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <div>
          <p className="text-sm font-medium text-ink">Switch to SMS when overdue</p>
          <p className="text-[13px] text-ink-2">For creators with a phone number.</p>
        </div>
        <div className="flex items-center gap-3">
          {rule.escalateToSms && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              after
              <Input
                type="number"
                min={1}
                max={30}
                value={rule.smsEscalationDays ?? 2}
                onChange={(e) => onChange({ smsEscalationDays: Math.min(30, Math.max(1, parseInt(e.target.value) || 2)) })}
                className="w-[72px]"
                aria-label="Days overdue before SMS"
              />
              days
            </label>
          )}
          <Switch
            checked={rule.escalateToSms}
            onCheckedChange={(v) => onChange({ escalateToSms: v, smsEscalationDays: v ? rule.smsEscalationDays || 2 : null })}
            aria-label="Switch to SMS when overdue"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        <Button variant="ghost" size="sm" className="text-late" onClick={onRemove}>
          <X aria-hidden="true" />
          Remove rule
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {rule.id ? "Save rule" : "Create rule"}
        </Button>
      </div>
    </div>
  );
}
