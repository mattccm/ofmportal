import { z } from "zod";

/**
 * The wording of every message a creator gets, editable on Reminders >
 * Wording. Pure: the senders (src/lib/creator-emails.ts, src/lib/sms.ts)
 * and the editor's live preview use the same functions.
 *
 * Staff edit plain text with {{fill-ins}}; the layout around it (the cover,
 * the request tile, the button, the footer) stays fixed, so an edit can't
 * break the design.
 *
 * Discretion: the request and template names never go in a text (texts show
 * on lock screens). In an email's subject, heading or button they're allowed
 * since 2026-10-30 (the owner wants request names in subjects) with a
 * heads-up in the editor; the standard wording never uses them there.
 */

export const COPY_KEYS = [
  "invite",
  "request.new",
  "reminder.before",
  "reminder.dueToday",
  "reminder.overdue",
  "request.changes",
  "request.approved",
] as const;
export type CopyKey = (typeof COPY_KEYS)[number];

export interface MessageCopy {
  subject: string;
  heading: string;
  body: string;
  button: string;
  sms: string;
}
export type CopyField = keyof MessageCopy;

export interface FillIn {
  key: string;
  label: string;
  sample: string;
}

const FIRST: FillIn = { key: "firstName", label: "First name", sample: "Jade" };
const FULL: FillIn = { key: "fullName", label: "Full name", sample: "Jade Kim" };
const AGENCY: FillIn = { key: "agencyName", label: "Agency", sample: "CCM" };
const TEAM: FillIn = { key: "teamMember", label: "Who looks after them", sample: "Fer" };
const TITLE: FillIn = { key: "requestTitle", label: "Request name", sample: "Weekend story set" };
const TEMPLATE: FillIn = { key: "templateName", label: "Template", sample: "Story clips" };
const PRIORITY: FillIn = { key: "priority", label: "Priority", sample: "High" };
const ITEMS: FillIn = { key: "itemCount", label: "Number of items", sample: "5" };
const COUNT: FillIn = { key: "requestCount", label: "Number of new requests", sample: "1" };
const DUE: FillIn = { key: "due", label: "Due, in words", sample: "due in 3 days" };
const DUE_DATE: FillIn = { key: "dueDate", label: "Due date", sample: "Fri 3 Nov" };
const DAYS_LEFT: FillIn = { key: "daysLeft", label: "Days left", sample: "3" };
const DAYS_OVER: FillIn = { key: "daysOverdue", label: "Days overdue", sample: "2" };
const LINK: FillIn = { key: "link", label: "Link (texts)", sample: "https://portal.of-m.com/creator/requests/cm0000000000000000000000" };

/** Fill-ins that name the request: never in a text, and a heads-up anywhere a lock screen or inbox list shows */
export const REVEALING_FILL_INS = ["requestTitle", "templateName"];

const REQUEST = [TITLE, TEMPLATE, PRIORITY, ITEMS];
export const COPY_MESSAGES: Record<CopyKey, { label: string; when: string; fillIns: FillIn[]; smsNeedsLink: boolean }> = {
  invite: { label: "Portal invite", when: "A creator is invited to set up their portal", fillIns: [FIRST, FULL, AGENCY, LINK], smsNeedsLink: true },
  "request.new": { label: "New request", when: "A request is sent", fillIns: [FIRST, FULL, AGENCY, TEAM, ...REQUEST, DUE_DATE, COUNT, LINK], smsNeedsLink: true },
  "reminder.before": { label: "Reminder before the due day", when: "Reminders before the due day", fillIns: [FIRST, FULL, AGENCY, TEAM, ...REQUEST, DUE, DUE_DATE, DAYS_LEFT, LINK], smsNeedsLink: true },
  "reminder.dueToday": { label: "Reminder on the due day", when: "The reminder on the due day", fillIns: [FIRST, FULL, AGENCY, TEAM, ...REQUEST, DUE, DUE_DATE, LINK], smsNeedsLink: true },
  "reminder.overdue": { label: "Reminder once overdue", when: "Reminders once a request is overdue", fillIns: [FIRST, FULL, AGENCY, TEAM, ...REQUEST, DUE, DUE_DATE, DAYS_OVER, LINK], smsNeedsLink: true },
  "request.changes": { label: "Changes requested", when: "Someone asks for changes", fillIns: [FIRST, FULL, AGENCY, TEAM, TITLE, TEMPLATE, LINK], smsNeedsLink: true },
  "request.approved": { label: "Content approved", when: "Content is approved", fillIns: [FIRST, FULL, AGENCY, TEAM, TITLE, TEMPLATE], smsNeedsLink: false },
};

export const DEFAULT_COPY: Record<CopyKey, MessageCopy> = {
  invite: {
    subject: "You're invited to your creator portal",
    heading: "Welcome, {{firstName}}",
    body: "We've set up a private portal just for you. It's where we'll share what we need, and where you'll upload your content and see what's approved.\n\nSetting up your account takes less than a minute.",
    button: "Set up my account",
    sms: "Hi {{firstName}}, you're invited! Set up your portal: {{link}}",
  },
  "request.new": {
    subject: "You have a new content request",
    heading: "Something new to upload",
    body: "Hi {{firstName}}, we've sent you a new request. Open it to see what we need and upload your content.",
    button: "Open the request",
    sms: "Hi {{firstName}}, you have a new content request. View it here: {{link}}",
  },
  "reminder.before": {
    subject: "Reminder: content {{due}}",
    heading: "A quick reminder",
    body: "Hi {{firstName}}, just a reminder that this request is {{due}}. Upload when you're ready and we'll take it from there.",
    button: "Upload now",
    sms: "Hi {{firstName}}, you have content {{due}}. View it here: {{link}}",
  },
  "reminder.dueToday": {
    subject: "Reminder: content due today",
    heading: "Due today",
    body: "Hi {{firstName}}, this request is due today. Upload before the end of your day.",
    button: "Upload now",
    sms: "Hi {{firstName}}, you have content due today. View it here: {{link}}",
  },
  "reminder.overdue": {
    subject: "Reminder: your content is {{due}}",
    heading: "This one's overdue",
    body: "Hi {{firstName}}, this request is now {{due}}. Upload as soon as you can, or message us if you need more time.",
    button: "Upload now",
    sms: "Hi {{firstName}}, you have content {{due}}. View it here: {{link}}",
  },
  "request.changes": {
    subject: "Changes requested on your content",
    heading: "A few changes needed",
    body: "Hi {{firstName}}, thanks for sending this in. Before we can approve it, we'd like a few changes. Update it and upload again, and we'll take another look.",
    button: "See the feedback",
    sms: "Hi {{firstName}}, changes have been requested on your content. View feedback here: {{link}}",
  },
  "request.approved": {
    subject: "Your content was approved",
    heading: "Approved. Thank you!",
    body: "Hi {{firstName}}, great news: your content is approved. Thank you for the great work.",
    button: "Open your portal",
    sms: "Hi {{firstName}}, your content has been approved.",
  },
};

/** The plural subject when one email announces several requests and the subject wasn't changed */
export const SEVERAL_REQUESTS_SUBJECT = "You have new content requests";

export const FIELD_LIMITS: Record<CopyField, number> = { subject: 120, heading: 60, body: 1500, button: 40, sms: 320 };

/** Email fields that show outside the message (lock screens, inbox lists, previews) */
const PREVIEWED_FIELDS: CopyField[] = ["subject", "heading", "button"];

export type CopyOverrides = Partial<Record<CopyKey, Partial<MessageCopy>>>;
export type AgencyCopy = Record<CopyKey, MessageCopy>;

/** Agency.settings.messageCopy → the full wording (missing fields use the defaults) */
export function readCopy(settings: unknown): AgencyCopy {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>).messageCopy : undefined;
  const messages = raw && typeof raw === "object" ? ((raw as Record<string, unknown>).messages as CopyOverrides | undefined) : undefined;
  const out = {} as AgencyCopy;
  for (const k of COPY_KEYS) {
    const o = messages?.[k] ?? {};
    const d = DEFAULT_COPY[k];
    out[k] = {
      subject: typeof o.subject === "string" && o.subject.trim() ? o.subject : d.subject,
      heading: typeof o.heading === "string" && o.heading.trim() ? o.heading : d.heading,
      body: typeof o.body === "string" && o.body.trim() ? o.body : d.body,
      button: typeof o.button === "string" && o.button.trim() ? o.button : d.button,
      sms: typeof o.sms === "string" && o.sms.trim() ? o.sms : d.sms,
    };
  }
  return out;
}

/** Only what differs from the defaults is stored */
export function toOverrides(copy: AgencyCopy): CopyOverrides {
  const out: CopyOverrides = {};
  for (const k of COPY_KEYS) {
    const diff: Partial<MessageCopy> = {};
    for (const f of Object.keys(DEFAULT_COPY[k]) as CopyField[]) {
      if (copy[k][f].trim() !== DEFAULT_COPY[k][f]) diff[f] = copy[k][f].trim();
    }
    if (Object.keys(diff).length) out[k] = diff;
  }
  return out;
}

export const isEdited = (copy: MessageCopy, key: CopyKey) => (Object.keys(DEFAULT_COPY[key]) as CopyField[]).some((f) => copy[f].trim() !== DEFAULT_COPY[key][f]);

const FILL_RE = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/** Replace {{fill-ins}} with plain-text values; unknown ones become empty */
export function fill(template: string, values: Record<string, string | undefined>): string {
  return template.replace(FILL_RE, (_m, key: string) => values[key] ?? "").replace(/[ \t]{2,}/g, " ");
}

/** What's wrong with one message's wording, in plain words (empty = fine) */
export function copyProblems(key: CopyKey, copy: MessageCopy): { field: CopyField; message: string }[] {
  const meta = COPY_MESSAGES[key];
  const known = new Set(meta.fillIns.map((f) => f.key));
  const problems: { field: CopyField; message: string }[] = [];
  for (const field of Object.keys(FIELD_LIMITS) as CopyField[]) {
    const value = copy[field] ?? "";
    if (!value.trim()) problems.push({ field, message: "Can't be empty" });
    if (value.length > FIELD_LIMITS[field]) problems.push({ field, message: `Keep it under ${FIELD_LIMITS[field]} characters` });
    for (const m of value.matchAll(FILL_RE)) {
      const name = m[1];
      if (!known.has(name)) problems.push({ field, message: `{{${name}}} isn't a fill-in for this message` });
      else if (REVEALING_FILL_INS.includes(name) && field === "sms") problems.push({ field, message: "Request and template names can't go in a text: texts show on lock screens" });
      else if (name === "link" && field !== "sms") problems.push({ field, message: "{{link}} is for texts; the email has its own button" });
    }
  }
  if (meta.smsNeedsLink && !/\{\{\s*link\s*\}\}/.test(copy.sms)) problems.push({ field: "sms", message: "Add {{link}} so they can open it" });
  return problems;
}

/** Things worth knowing before saving, that don't stop it (e.g. a request name in a subject) */
export function copyWarnings(key: CopyKey, copy: MessageCopy): { field: CopyField; message: string }[] {
  const out: { field: CopyField; message: string }[] = [];
  for (const field of PREVIEWED_FIELDS) {
    const names = [...(copy[field] ?? "").matchAll(FILL_RE)].map((m) => m[1]).filter((n) => REVEALING_FILL_INS.includes(n));
    if (names.length)
      out.push({
        field,
        message:
          field === "subject"
            ? "The request or template name will show on lock screens, in notifications and in inbox lists. Fine if your names are safe to be seen."
            : "The request or template name will show to anyone who sees this email open.",
      });
  }
  return out;
}

/** The fill-in values for a message, from what the sender knows */
export interface CopyValues {
  firstName: string;
  fullName?: string;
  agencyName?: string;
  teamMember?: string;
  requestTitle?: string;
  templateName?: string;
  priority?: string;
  itemCount?: string;
  requestCount?: string;
  due?: string;
  dueDate?: string;
  daysLeft?: string;
  daysOverdue?: string;
  link?: string;
}

/** Fill-ins a sender has to look up (the request's template, priority, items, who looks after the creator) */
export const LOOKED_UP_FILL_INS = ["templateName", "priority", "itemCount", "teamMember"] as const;

/** Does any of this wording use one of these fill-ins? */
export function usesFillIn(copy: MessageCopy, names: readonly string[]): boolean {
  return Object.values(copy).some((t) => [...String(t).matchAll(FILL_RE)].some((m) => names.includes(m[1])));
}

export function sampleValues(key: CopyKey, daysUntilDue = 3): CopyValues {
  const due = key === "reminder.dueToday" ? "due today" : key === "reminder.overdue" ? "2 days overdue" : `due in ${daysUntilDue} days`;
  return {
    firstName: "Jade",
    fullName: "Jade Kim",
    agencyName: "CCM",
    teamMember: "Fer",
    requestTitle: "Weekend story set",
    templateName: "Story clips",
    priority: "High",
    itemCount: "5",
    requestCount: "1",
    due,
    dueDate: "Fri 3 Nov",
    daysLeft: String(daysUntilDue),
    daysOverdue: "2",
    link: LINK.sample,
  };
}

/** The text a creator gets (before the "CCM: " prefix) */
export function composeSms(copy: MessageCopy, values: CopyValues): string {
  return fill(copy.sms, values as unknown as Record<string, string>).trim();
}

/** Characters that fit a 160-character text (GSM 03.38); anything else makes it a 70-character text */
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

/** How many texts one message costs */
export function smsSegments(text: string): { length: number; segments: number; perSegment: number } {
  const gsm = GSM.test(text);
  const length = gsm ? [...text].reduce((n, ch) => n + ("^{}\\[~]|€".includes(ch) ? 2 : 1), 0) : [...text].length;
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return { length, segments: length <= single ? 1 : Math.ceil(length / multi), perSegment: single };
}

const copySchema = z.object({
  subject: z.string().max(FIELD_LIMITS.subject),
  heading: z.string().max(FIELD_LIMITS.heading),
  body: z.string().max(FIELD_LIMITS.body),
  button: z.string().max(FIELD_LIMITS.button),
  sms: z.string().max(FIELD_LIMITS.sms),
});
export const agencyCopySchema = z.object(Object.fromEntries(COPY_KEYS.map((k) => [k, copySchema])) as Record<CopyKey, typeof copySchema>);
