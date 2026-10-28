import { chip, ctaButton, escapeHtml, infoCard, linkFallback, note, paragraphs, renderEmail, requestTile, textFooter, type EmailBranding } from "./email-layout";
import { DEFAULT_COPY, SEVERAL_REQUESTS_SUBJECT, fill, sampleValues, type CopyKey, type CopyValues, type MessageCopy } from "./message-copy";

/**
 * The emails creators get, built from the agency's wording (message-copy.ts)
 * inside the fixed layout (email-layout.ts). Pure: email.ts sends these and
 * Reminders > Wording previews them, so the preview is the real thing.
 */

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

const vals = (v: CopyValues) => v as unknown as Record<string, string>;
const test = (subject: string, isTest?: boolean) => (isTest ? `[TEST] ${subject}` : subject);

function build(opts: {
  copy: MessageCopy;
  values: CopyValues;
  branding: EmailBranding;
  subject?: string;
  isTest?: boolean;
  /** Under the heading, in the cover (safe HTML) */
  coverFoot?: string;
  /** Blocks between the message and the button (safe HTML), and their plain text */
  middle?: { html: string; text: string };
  link?: string;
  /** Show the paste-this-link box under the button */
  fallback?: boolean;
  /** Fixed notes after the button (plain text) */
  notes?: string[];
}): ComposedEmail {
  const v = vals(opts.values);
  const subject = test(fill(opts.subject ?? opts.copy.subject, v).trim(), opts.isTest);
  const heading = fill(opts.copy.heading, v).trim();
  const body = fill(opts.copy.body, v).trim();
  const button = fill(opts.copy.button, v).trim();
  const notes = opts.notes ?? [];

  const content = [
    paragraphs(body),
    opts.middle?.html ?? "",
    opts.link ? ctaButton(opts.link, button) : "",
    opts.link && opts.fallback ? linkFallback(opts.link) : "",
    ...notes.map((n) => note(escapeHtml(n))),
  ].join("\n");

  const text =
    [heading, body, opts.middle?.text ?? "", opts.link ? `${button}: ${opts.link}` : "", ...notes].filter(Boolean).join("\n\n") +
    textFooter(opts.branding);

  return { subject, html: renderEmail({ subject, branding: opts.branding, heading, coverFoot: opts.coverFoot, content }), text };
}

export function composeInviteEmail(copy: MessageCopy, values: CopyValues & { link: string }, branding: EmailBranding): ComposedEmail {
  return build({
    copy,
    values,
    branding,
    link: values.link,
    fallback: true,
    notes: ["For your security, this link works once and expires in 7 days.", "Weren't expecting this? You can ignore this email."],
  });
}

export function composeNewRequestEmail(
  copy: MessageCopy,
  values: CopyValues & { link: string; requestTitle: string; dueDate: string },
  branding: EmailBranding,
  opts: { count?: number } = {}
): ComposedEmail {
  const several = (opts.count ?? 1) > 1;
  const dueWord = several ? "First due" : "Due";
  const meta = values.dueDate ? `${dueWord} ${values.dueDate}` : undefined;
  return build({
    copy,
    values,
    branding,
    subject: several && copy.subject === DEFAULT_COPY["request.new"].subject ? SEVERAL_REQUESTS_SUBJECT : undefined,
    middle: { html: requestTile({ title: values.requestTitle, meta }), text: [values.requestTitle, meta].filter(Boolean).join("\n") },
    link: values.link,
  });
}

export function composeReminderEmail(
  copy: MessageCopy,
  values: CopyValues & { link: string; requestTitle: string; dueDate: string },
  branding: EmailBranding,
  opts: { daysUntilDue: number; customMessage?: string; isTest?: boolean }
): ComposedEmail {
  const overdue = opts.daysUntilDue < 0;
  const today = opts.daysUntilDue === 0;
  const tileChip = overdue ? chip("overdue") : today ? chip({ word: "Due today" }) : undefined;
  const custom = opts.customMessage?.trim();
  return build({
    copy,
    values,
    branding,
    isTest: opts.isTest,
    middle: {
      html: (custom ? infoCard(escapeHtml(custom).replace(/\n/g, "<br>"), "A note from the team") : "") + requestTile({ title: values.requestTitle, meta: values.dueDate ? `Due ${values.dueDate}` : undefined, chip: tileChip }),
      text: [custom ? `A note from the team:\n${custom}` : "", values.requestTitle, values.dueDate ? `Due ${values.dueDate}` : ""].filter(Boolean).join("\n"),
    },
    link: values.link,
  });
}

export function composeChangesEmail(
  copy: MessageCopy,
  values: CopyValues & { link: string; requestTitle: string; feedback: string },
  branding: EmailBranding
): ComposedEmail {
  const feedback = values.feedback.trim();
  return build({
    copy,
    values,
    branding,
    coverFoot: chip("changes"),
    middle: {
      html: requestTile({ title: values.requestTitle, note: feedback ? { label: "What to change", html: escapeHtml(feedback).replace(/\n/g, "<br>") } : undefined }),
      text: [values.requestTitle, feedback ? `What to change:\n${feedback}` : ""].filter(Boolean).join("\n\n"),
    },
    link: values.link,
  });
}

export function composeApprovedEmail(copy: MessageCopy, values: CopyValues & { requestTitle: string; link?: string }, branding: EmailBranding): ComposedEmail {
  return build({
    copy,
    values,
    branding,
    coverFoot: chip("approved"),
    middle: { html: requestTile({ title: values.requestTitle }), text: values.requestTitle },
    link: values.link,
  });
}

/** One message filled with sample values: the Wording preview and test emails */
export function composeSample(key: CopyKey, copy: MessageCopy, branding: EmailBranding, opts: { isTest?: boolean; appUrl?: string } = {}): ComposedEmail {
  const base = opts.appUrl ?? "https://portal.of-m.com";
  const v = { ...sampleValues(key), agencyName: branding.agencyName };
  const requestTitle = v.requestTitle ?? "Weekend story set";
  const dueDate = v.dueDate ?? "Fri 3 Nov";
  const link = `${base}/creator/requests`;
  let email: ComposedEmail;
  switch (key) {
    case "invite":
      email = composeInviteEmail(copy, { ...v, link: `${base}/portal/setup/sample-link` }, branding);
      break;
    case "request.new":
      email = composeNewRequestEmail(copy, { ...v, requestTitle, dueDate, link }, branding);
      break;
    case "reminder.before":
    case "reminder.dueToday":
    case "reminder.overdue": {
      const daysUntilDue = key === "reminder.before" ? 3 : key === "reminder.dueToday" ? 0 : -2;
      email = composeReminderEmail(copy, { ...v, requestTitle, dueDate, link }, branding, { daysUntilDue });
      break;
    }
    case "request.changes":
      email = composeChangesEmail(copy, { ...v, requestTitle, link, feedback: "Could you re-shoot the second clip in daylight, and trim the first one to 15 seconds?" }, branding);
      break;
    case "request.approved":
      email = composeApprovedEmail(copy, { ...v, requestTitle, link: `${base}/creator/dashboard` }, branding);
      break;
  }
  return opts.isTest ? { ...email, subject: `[TEST] ${email.subject}` } : email;
}
