/**
 * Creator messaging: which channels (email, text) each creator-facing message
 * goes out on, and when reminders go out. One decision module; every send path
 * and the reminder scheduler ask it instead of deciding inline.
 *
 * Client-safe (no database). The loaders that read the agency, template and
 * request live in `messaging-server.ts`.
 *
 * Precedence, most specific first:
 *   1. the creator's own reminder settings (CreatorReminderOverride: their
 *      schedule, or reminders switched off for them)
 *   2. the request's messaging snapshot (copied from its template when the
 *      request was made, editable per request)
 *   3. the template's messaging (only before a request exists: previews)
 *   4. the agency defaults (Agency.settings.messaging), and for reminder steps
 *      the urgency's ReminderRule when nothing above sets a schedule
 * Then the creator's consent filter (`applyConsent`).
 *
 * The consent rule, with "Respect each creator's contact preference" on:
 *   - Texts go only to creators who prefer texts (SMS) or both (BOTH), and only
 *     to a phone number we have. A creator who prefers email never gets a text.
 *   - A creator who prefers texts still gets an email wherever the plan sends
 *     one: email is the record with the full details and link.
 *   - "One message, by their preference" (pick: preferred): when a step has
 *     both channels on, the creator gets one: a text if they prefer texts
 *     only, otherwise the email. This is how reminders worked before plans
 *     existed (reminders were never sent twice), so the agency defaults keep it.
 *   - If nothing can reach the creator (a text-only plan and they prefer email
 *     or have no phone), the message goes by email, so it never vanishes.
 *     Messages switched off in the plan stay off.
 * With the switch off (the default), texts go to every creator with a phone
 * number, but only for the messages a plan switches texts on for.
 *
 * Texts cost money, so the agency defaults text only the portal invite;
 * everything else goes by email unless a template, a request or the agency
 * switches texts on for it.
 */
import { z } from "zod";

// EVENTS

export const MESSAGE_EVENTS = [
  { id: "creator.invite", label: "Portal invite", sentence: "a creator is invited to set up their portal", kind: "invite" },
  { id: "request.new", label: "New request", sentence: "a new request is sent", kind: "once" },
  { id: "reminder.before", label: "Reminder before the due day", sentence: "a reminder goes out before the due day", kind: "reminder" },
  { id: "reminder.dueToday", label: "Reminder on the due day", sentence: "a reminder goes out on the due day", kind: "reminder" },
  { id: "reminder.overdue", label: "Reminder once overdue", sentence: "a reminder goes out once a request is overdue", kind: "reminder" },
  { id: "reminder.manual", label: "Reminder sent by hand", sentence: "someone on the team sends a reminder now", kind: "once" },
  { id: "request.changes", label: "Changes requested", sentence: "changes are asked for", kind: "once" },
  { id: "request.approved", label: "Content approved", sentence: "content is approved", kind: "once" },
] as const;

export type MessageEvent = (typeof MESSAGE_EVENTS)[number]["id"];
export const MESSAGE_EVENT_IDS = MESSAGE_EVENTS.map((e) => e.id) as [MessageEvent, ...MessageEvent[]];
/** The events a template or a request can set (an invite comes before any request) */
export const REQUEST_EVENTS = MESSAGE_EVENTS.filter((e) => e.kind !== "invite");
export const SCHEDULE_EVENTS: MessageEvent[] = ["reminder.before", "reminder.dueToday", "reminder.overdue"];
export const eventLabel = (e: MessageEvent) => MESSAGE_EVENTS.find((x) => x.id === e)?.label ?? e;

// CHANNELS

export type ContactPreference = "EMAIL" | "SMS" | "BOTH";

/** What an event or a step asks for, before the creator's consent */
export interface ChannelChoice {
  email: boolean;
  sms: boolean;
  /** "all": every channel that's on. "preferred": one message, by the creator's preference */
  pick?: "all" | "preferred";
}

/** A template's or a request's choice for one event */
export type EventChoice = "inherit" | "email" | "sms" | "both" | "off";
export const EVENT_CHOICES: { id: EventChoice; label: string }[] = [
  { id: "inherit", label: "Agency default" },
  { id: "email", label: "Email" },
  { id: "sms", label: "Text" },
  { id: "both", label: "Email and text" },
  { id: "off", label: "Don't send" },
];

export function choiceToChannels(c: Exclude<EventChoice, "inherit">): ChannelChoice {
  return { email: c === "email" || c === "both", sms: c === "sms" || c === "both", pick: "all" };
}

// AGENCY DEFAULTS (Agency.settings.messaging)

export interface AgencyMessaging {
  version: 1;
  respectPreference: boolean;
  events: Record<MessageEvent, ChannelChoice>;
}

/** Email for everything; a text only with the portal invite. Texts are switched on where they're worth paying for */
export const DEFAULT_AGENCY_MESSAGING: AgencyMessaging = {
  version: 1,
  respectPreference: false,
  events: {
    "creator.invite": { email: true, sms: true, pick: "all" },
    "request.new": { email: true, sms: false, pick: "all" },
    "reminder.before": { email: true, sms: false, pick: "all" },
    "reminder.dueToday": { email: true, sms: false, pick: "all" },
    "reminder.overdue": { email: true, sms: false, pick: "all" },
    "reminder.manual": { email: true, sms: false, pick: "all" },
    "request.changes": { email: true, sms: false, pick: "all" },
    "request.approved": { email: true, sms: false, pick: "all" },
  },
};

const channelChoiceSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  pick: z.enum(["all", "preferred"]).optional(),
});

export const agencyMessagingSchema = z.object({
  version: z.literal(1).default(1),
  respectPreference: z.boolean(),
  events: z.object(Object.fromEntries(MESSAGE_EVENT_IDS.map((e) => [e, channelChoiceSchema.optional()])) as Record<MessageEvent, z.ZodOptional<typeof channelChoiceSchema>>),
});

/** Agency.settings JSON → messaging defaults (missing or invalid parts fall back to the defaults) */
export function readAgencyMessaging(settings: unknown): AgencyMessaging {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>).messaging : undefined;
  if (!raw || typeof raw !== "object") return DEFAULT_AGENCY_MESSAGING;
  const r = raw as Partial<AgencyMessaging>;
  const events = { ...DEFAULT_AGENCY_MESSAGING.events };
  for (const e of MESSAGE_EVENT_IDS) {
    const parsed = channelChoiceSchema.safeParse(r.events?.[e]);
    if (parsed.success) events[e] = { pick: "all", ...parsed.data };
  }
  return {
    version: 1,
    respectPreference: typeof r.respectPreference === "boolean" ? r.respectPreference : DEFAULT_AGENCY_MESSAGING.respectPreference,
    events,
  };
}

// TEMPLATE / REQUEST PLANS

export type ReminderStep =
  | { id: string; when: "before"; days: number; email: boolean; sms: boolean }
  | { id: string; when: "due"; email: boolean; sms: boolean }
  | { id: string; when: "overdue"; every: number; max: number; email: boolean; sms: boolean };

export interface PlanOrigin {
  kind: "template" | "request";
  templateId?: string;
  templateName?: string;
}

export interface MessagingPlan {
  v: 1;
  /** Per-event choice; missing = "inherit" */
  events: Partial<Record<MessageEvent, EventChoice>>;
  /** Reminder steps; null = the agency's reminder rules */
  schedule: ReminderStep[] | null;
  origin?: PlanOrigin;
}

export const MAX_STEPS = 10;

const stepBase = { id: z.string().min(1).max(40), email: z.boolean(), sms: z.boolean() };
export const reminderStepSchema = z.discriminatedUnion("when", [
  z.object({ ...stepBase, when: z.literal("before"), days: z.number().int().min(1).max(60) }),
  z.object({ ...stepBase, when: z.literal("due") }),
  z.object({ ...stepBase, when: z.literal("overdue"), every: z.number().int().min(1).max(30), max: z.number().int().min(1).max(10) }),
]);

export const messagingPlanSchema = z.object({
  v: z.literal(1).default(1),
  events: z.object(Object.fromEntries(MESSAGE_EVENT_IDS.map((e) => [e, z.enum(["inherit", "email", "sms", "both", "off"]).optional()])) as Record<MessageEvent, z.ZodOptional<z.ZodEnum<{ inherit: "inherit"; email: "email"; sms: "sms"; both: "both"; off: "off" }>>>).default({}),
  schedule: z.array(reminderStepSchema).max(MAX_STEPS).nullable().default(null),
  origin: z
    .object({ kind: z.enum(["template", "request"]), templateId: z.string().optional(), templateName: z.string().max(200).optional() })
    .optional(),
});

/** A stored JSON plan → a plan, or null when absent/invalid */
export function readPlan(raw: unknown): MessagingPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = messagingPlanSchema.safeParse(raw);
  return p.success ? (p.data as MessagingPlan) : null;
}

/** A plan that changes nothing is stored as null ("use agency defaults") */
export function isEmptyPlan(p: MessagingPlan | null | undefined): boolean {
  if (!p) return true;
  return p.schedule === null && Object.values(p.events).every((c) => !c || c === "inherit");
}

/** The snapshot a new request takes from its template */
export function snapshotFromTemplate(template: { id: string; name: string; messaging?: unknown } | null | undefined): MessagingPlan | null {
  const plan = readPlan(template?.messaging);
  if (!template || !plan || isEmptyPlan(plan)) return null;
  return { ...plan, origin: { kind: "template", templateId: template.id, templateName: template.name } };
}

// THE DECISION

export interface CreatorContact {
  name?: string | null;
  phone?: string | null;
  preferredContact?: ContactPreference | string | null;
}

export interface ChannelPlan {
  email: boolean;
  sms: boolean;
  /** Plain words: why these channels */
  reason: string;
  /** Where the event's choice came from */
  source: "request" | "template" | "agency";
}

export interface PlanContext {
  creator: CreatorContact;
  agency: AgencyMessaging;
  /** The request's snapshot (ContentRequest.messaging). Wins over the template */
  request?: { messaging?: unknown } | null;
  /** The template, used only when there is no request yet (previews) */
  template?: { messaging?: unknown; name?: string } | null;
  /** Staff asked for these channels explicitly (manual send): consent still applies */
  forced?: ChannelChoice;
}

function layerChoice(plan: MessagingPlan | null, event: MessageEvent): Exclude<EventChoice, "inherit"> | null {
  const c = plan?.events?.[event];
  return c && c !== "inherit" ? c : null;
}

/** The event's channels before consent, and where they came from */
export function eventChannels(
  event: MessageEvent,
  ctx: Pick<PlanContext, "agency" | "request" | "template">
): { choice: ChannelChoice; source: ChannelPlan["source"] } {
  const requestPlan = ctx.request ? readPlan(ctx.request.messaging) : null;
  if (ctx.request) {
    // A request's snapshot replaces its template: later template edits don't reach it
    const c = layerChoice(requestPlan, event);
    if (c) return { choice: choiceToChannels(c), source: "request" };
  } else {
    const c = layerChoice(readPlan(ctx.template?.messaging), event);
    if (c) return { choice: choiceToChannels(c), source: "template" };
  }
  return { choice: ctx.agency.events[event] ?? DEFAULT_AGENCY_MESSAGING.events[event], source: "agency" };
}

function prefOf(c: CreatorContact): ContactPreference {
  return c.preferredContact === "SMS" || c.preferredContact === "BOTH" ? c.preferredContact : "EMAIL";
}

/**
 * The consent filter: what actually goes out to this creator for a choice.
 * `fallback: false` for extras (an SMS escalation on top of a reminder) that
 * shouldn't turn into an email when a text can't go.
 */
export function applyConsent(
  choice: ChannelChoice,
  creator: CreatorContact,
  agency: Pick<AgencyMessaging, "respectPreference">,
  opts: { fallback?: boolean } = {}
): { email: boolean; sms: boolean; note: string | null } {
  const pref = prefOf(creator);
  const hasPhone = !!creator.phone;
  const name = creator.name?.trim() || "This creator";
  let { email, sms } = choice;
  let note: string | null = null;
  const wanted = email || sms;

  if (choice.pick === "preferred" && email && sms) {
    if (pref === "SMS" && hasPhone) email = false;
    else sms = false;
  }
  if (sms && agency.respectPreference && pref === "EMAIL") {
    sms = false;
    note = `${name} prefers email, so no text`;
  }
  if (sms && !hasPhone) {
    sms = false;
    note = `${name} has no phone number, so no text`;
  }
  if (wanted && !email && !sms && opts.fallback !== false) {
    email = true;
    note = `${note ?? "No text can go"}; it goes by email instead`;
  }
  return { email, sms, note };
}

/**
 * Which channels a creator-facing message goes out on.
 * `forced` (staff picked channels for a manual send) replaces the event's choice.
 */
export function planChannels(event: MessageEvent, ctx: PlanContext): ChannelPlan {
  const { choice, source } = ctx.forced ? { choice: { ...ctx.forced, pick: "all" as const }, source: "request" as const } : eventChannels(event, ctx);
  const out = applyConsent(choice, ctx.creator, ctx.agency);
  const what = out.email && out.sms ? "Email and text" : out.email ? "Email" : out.sms ? "Text" : "Nothing";
  const from = source === "request" ? "this request's plan" : source === "template" ? `the template${ctx.template?.name ? ` ${ctx.template.name}` : ""}` : "agency defaults";
  const reason = `${what}, from ${ctx.forced ? "the channels picked" : from}${out.note ? ` (${out.note})` : ""}`;
  return { email: out.email, sms: out.sms, reason, source };
}

// THE REMINDER SCHEDULE

export type OverdueFrequencyName = "NONE" | "DAILY" | "EVERY_2_DAYS" | "EVERY_3_DAYS" | "WEEKLY";

export interface RuleScheduleConfig {
  reminderDays: number[];
  overdueReminderFrequency: OverdueFrequencyName;
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
}

export function overdueInterval(f: OverdueFrequencyName): number {
  return f === "DAILY" ? 1 : f === "EVERY_2_DAYS" ? 2 : f === "EVERY_3_DAYS" ? 3 : f === "WEEKLY" ? 7 : 0;
}

/** A step whose channels may still say "one message, by preference" */
export type ResolvedStep =
  | { when: "before"; days: number; channels: ChannelChoice }
  | { when: "due"; channels: ChannelChoice }
  | { when: "overdue"; every: number; max: number; channels: ChannelChoice };

export type ScheduleSource = "creator" | "request" | "template" | "rule" | "default";

export interface ResolvedSchedule {
  source: ScheduleSource;
  /** "From template Story clips", "Agency defaults", "Jade's own schedule" */
  sourceLabel: string;
  steps: ResolvedStep[];
  /** Reminders are switched off for this creator */
  disabled: boolean;
  /** SMS escalation from a reminder rule or the creator's own settings */
  escalation: { afterDays: number } | null;
}

export interface ScheduleContext extends Omit<PlanContext, "forced"> {
  /** CreatorReminderOverride, when it exists */
  creatorOverride?: (RuleScheduleConfig & { useCustomSettings: boolean; disableReminders: boolean }) | null;
  /** The active ReminderRule for the request's urgency */
  rule?: RuleScheduleConfig | null;
  /** Used when there is no rule */
  fallbackRule?: RuleScheduleConfig;
}

export const DEFAULT_RULE: RuleScheduleConfig = {
  reminderDays: [3, 1, 0],
  overdueReminderFrequency: "DAILY",
  maxOverdueReminders: 5,
  smsEscalationDays: null,
  escalateToSms: false,
};

function possessive(name: string | null | undefined): string {
  const n = name?.trim().split(/\s+/)[0] || "The creator";
  return n.endsWith("s") ? `${n}'` : `${n}'s`;
}

function stepsFromRule(cfg: RuleScheduleConfig, ctx: Pick<PlanContext, "agency" | "request" | "template">): ResolvedStep[] {
  const ch = (e: MessageEvent) => eventChannels(e, ctx).choice;
  const steps: ResolvedStep[] = [];
  for (const d of [...new Set(cfg.reminderDays)].sort((a, b) => b - a)) {
    if (d < 0) continue;
    steps.push(d === 0 ? { when: "due", channels: ch("reminder.dueToday") } : { when: "before", days: d, channels: ch("reminder.before") });
  }
  const every = overdueInterval(cfg.overdueReminderFrequency);
  if (every > 0 && cfg.maxOverdueReminders > 0) steps.push({ when: "overdue", every, max: cfg.maxOverdueReminders, channels: ch("reminder.overdue") });
  return steps;
}

function stepsFromPlan(steps: ReminderStep[]): ResolvedStep[] {
  return steps.map((s) => {
    const channels: ChannelChoice = { email: s.email, sms: s.sms, pick: "all" };
    return s.when === "before" ? { when: "before", days: s.days, channels } : s.when === "due" ? { when: "due", channels } : { when: "overdue", every: s.every, max: s.max, channels };
  });
}

const escalationOf = (c: RuleScheduleConfig) => (c.escalateToSms && c.smsEscalationDays !== null ? { afterDays: c.smsEscalationDays } : null);

/** The reminder schedule that applies, and where it came from */
export function resolveSchedule(ctx: ScheduleContext): ResolvedSchedule {
  const o = ctx.creatorOverride;
  const own = possessive(ctx.creator.name);
  if (o?.disableReminders) return { source: "creator", sourceLabel: `${own} own settings: reminders off`, steps: [], disabled: true, escalation: null };
  if (o?.useCustomSettings) return { source: "creator", sourceLabel: `${own} own schedule`, steps: stepsFromRule(o, ctx), disabled: false, escalation: escalationOf(o) };

  if (ctx.request) {
    const plan = readPlan(ctx.request.messaging);
    if (plan?.schedule) {
      const label = plan.origin?.kind === "template" && plan.origin.templateName ? `From template ${plan.origin.templateName}` : "Set for this request";
      return { source: plan.origin?.kind === "template" ? "template" : "request", sourceLabel: label, steps: stepsFromPlan(plan.schedule), disabled: false, escalation: null };
    }
  } else {
    const plan = readPlan(ctx.template?.messaging);
    if (plan?.schedule) return { source: "template", sourceLabel: `From template ${ctx.template?.name ?? ""}`.trim(), steps: stepsFromPlan(plan.schedule), disabled: false, escalation: null };
  }

  if (ctx.rule) return { source: "rule", sourceLabel: "Agency defaults", steps: stepsFromRule(ctx.rule, ctx), disabled: false, escalation: escalationOf(ctx.rule) };
  return { source: "default", sourceLabel: "Agency defaults", steps: stepsFromRule(ctx.fallbackRule ?? DEFAULT_RULE, ctx), disabled: false, escalation: escalationOf(ctx.fallbackRule ?? DEFAULT_RULE) };
}

/** One Reminder row to create */
export interface PlannedReminder {
  /** The creator-local calendar day it goes out on (YYYY-MM-DD) */
  day: string;
  /** Days relative to the due day: -3 = three days before, 2 = two days overdue */
  daysFromDue: number;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  isEscalation: boolean;
}

function addDaysToDayKey(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * Turn a resolved schedule into Reminder rows (one per channel) on the
 * creator's calendar. `dueDay` and `today` are creator-local day keys.
 * Rows on days before `today` are skipped; several steps landing on one day
 * collapse into one message per channel.
 */
export function plannedReminders(
  schedule: ResolvedSchedule,
  dueDay: string,
  today: string,
  creator: CreatorContact,
  agency: Pick<AgencyMessaging, "respectPreference">
): PlannedReminder[] {
  if (schedule.disabled) return [];
  const byKey = new Map<string, PlannedReminder>();
  const add = (daysFromDue: number, channels: ChannelChoice, opts: { fallback?: boolean; escalation?: boolean } = {}) => {
    const day = addDaysToDayKey(dueDay, daysFromDue);
    if (day < today) return;
    const out = applyConsent(channels, creator, agency, { fallback: opts.fallback });
    const type: PlannedReminder["type"] = opts.escalation ? "ESCALATION" : daysFromDue < 0 ? "UPCOMING" : daysFromDue === 0 ? "DUE_TODAY" : "OVERDUE";
    for (const channel of [out.email && "EMAIL", out.sms && "SMS"].filter(Boolean) as ("EMAIL" | "SMS")[]) {
      const key = `${day}|${channel}`;
      if (!byKey.has(key) || opts.escalation) byKey.set(key, { day, daysFromDue, type, channel, isEscalation: !!opts.escalation });
    }
  };

  for (const s of schedule.steps) {
    if (s.when === "before") add(-s.days, s.channels);
    else if (s.when === "due") add(0, s.channels);
    else {
      for (let i = 1; i <= s.max; i++) {
        const d = s.every * i;
        // SMS escalation (rule or creator settings): from N days overdue the
        // reminder becomes a text, if the creator can get one
        if (schedule.escalation && d >= schedule.escalation.afterDays) {
          const esc = applyConsent({ email: false, sms: true }, creator, agency, { fallback: false });
          if (esc.sms) {
            add(d, { email: false, sms: true }, { escalation: true, fallback: false });
            continue;
          }
        }
        add(d, s.channels);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => (a.day === b.day ? a.channel.localeCompare(b.channel) : a.day.localeCompare(b.day)));
}

// WORDS

const channelWords = (email: boolean, sms: boolean) => (email && sms ? "email and text" : email ? "email" : sms ? "text" : "nothing");

/** "3 days before: email · 1 day before: email and text · overdue every 2 days: text, up to 4 times" */
export function describeSteps(steps: (ReminderStep | ResolvedStep)[], opts: { preferred?: string } = {}): string {
  if (steps.length === 0) return "No reminders";
  const parts = steps.map((s) => {
    const ch = "channels" in s ? s.channels : { email: s.email, sms: s.sms, pick: "all" as const };
    const how = ch.pick === "preferred" && ch.email && ch.sms ? (opts.preferred ?? "email or text, by preference") : channelWords(ch.email, ch.sms);
    const when =
      s.when === "before" ? `${s.days} ${s.days === 1 ? "day" : "days"} before` : s.when === "due" ? "due day" : `overdue every ${s.every === 1 ? "day" : `${s.every} days`}`;
    const times = s.when === "overdue" ? `, up to ${s.max} ${s.max === 1 ? "time" : "times"}` : "";
    return { when, how, times };
  });
  const cap = (t: string) => t.replace(/^./, (c) => c.toUpperCase());
  // Same channels on every step: say them once
  if (parts.length > 1 && parts.every((x) => x.how === parts[0].how))
    return cap(`${parts.map((x) => x.when + x.times).join(" · ")}. Each by ${parts[0].how}`);
  return cap(parts.map((x) => `${x.when}: ${x.how}${x.times}`).join(" · "));
}

/** The preview line for an agency grid row */
export function describeChoice(c: ChannelChoice, respectPreference: boolean): string {
  if (!c.email && !c.sms) return "Nothing is sent.";
  if (c.email && !c.sms) return "Creators get an email.";
  if (!c.email && c.sms)
    return respectPreference
      ? "Creators who prefer texts get a text; everyone else gets an email instead."
      : "Creators with a phone number get a text; the rest get an email instead.";
  if (c.pick === "preferred") return "One message: a text for creators who prefer texts only, an email for everyone else.";
  return respectPreference
    ? "Creators get an email; those who prefer texts also get a text."
    : "Creators get an email, and a text when they have a phone number.";
}

let stepSeq = 0;
export function newStepId(): string {
  stepSeq += 1;
  return `s${Date.now().toString(36)}${stepSeq}`;
}
