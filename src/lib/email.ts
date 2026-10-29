import { Resend } from "resend";
import { db } from "./db";
import type { BrandingSettings } from "./branding";
import { BRAND } from "./brand";
import { getAppUrl } from "./app-url";
import { reminderUrgencyText, smsFirstName } from "./reminder-copy";
import {
  EMAIL_COLORS,
  FONT_STACK,
  chip,
  ctaButton,
  escapeHtml,
  linkFallback,
  note,
  p,
  renderEmail,
  requestTile,
  textFooter,
  type EmailBranding,
} from "./email-layout";
import {
  composeApprovedEmail,
  composeChangesEmail,
  composeInviteEmail,
  composeNewRequestEmail,
  composeReminderEmail,
  type ComposedEmail,
} from "./creator-emails";
import { loadMessageCopy } from "./message-copy-server";

// The layout helpers live in email-layout.ts (pure, so the wording preview can
// use them); re-exported for the senders that build their own content.
export { ctaButton, escapeHtml, infoCard, note, p, renderEmail, textFooter } from "./email-layout";
export type { EmailBranding } from "./email-layout";

// Lazy initialization to avoid errors when API key is not configured
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@portal.of-m.com";

// EMAIL BRANDING
// Emails are sent as the agency ("From" is the sender name set in Branding,
// or CCM) and carry the Title Wall look (email-layout.ts). The agency's saved
// colours and logo don't change the email: the wordmark is typeset and the
// one button is always the portal's yellow.

const FALLBACK_BRANDING: EmailBranding = {
  agencyName: BRAND.name,
  fromName: BRAND.name,
  logoUrl: null,
  markUrl: `${getAppUrl()}/email/ccm-mark.png`,
  primaryColor: EMAIL_COLORS.acc,
  buttonTextColor: EMAIL_COLORS.accInk,
  signature: null,
  supportEmail: null,
  replyTo: null,
};

/** Swap old product-name literals in a saved signature for the current brand */
function normalizeSignature(signature: string | null | undefined): string | null {
  const trimmed = signature?.trim();
  if (!trimmed) return null;
  return trimmed.replace(
    /\b(?:CCM Content Portal|Content Portal|Upload Portal)\b/g,
    BRAND.productName
  );
}

/** Only absolute URLs render in email clients; relative paths must be dropped. */
function usableLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^(https?:|data:)/i.test(url) ? url : null;
}

/**
 * Load the agency's email branding. When agencyId is omitted (e.g. background
 * jobs that don't carry it) the sole agency is used — this is a single-agency
 * tool. Falls back to sensible defaults if branding can't be loaded so email
 * sending never throws on branding alone.
 */
export async function loadEmailBranding(
  agencyId?: string,
  fallbackName?: string
): Promise<EmailBranding> {
  try {
    const agency = agencyId
      ? await db.agency.findUnique({
          where: { id: agencyId },
          select: { name: true, logo: true, settings: true },
        })
      : await db.agency.findFirst({
          select: { name: true, logo: true, settings: true },
        });

    if (!agency) {
      return { ...FALLBACK_BRANDING, agencyName: fallbackName || FALLBACK_BRANDING.agencyName, fromName: fallbackName || FALLBACK_BRANDING.fromName };
    }

    const settings = (agency.settings as Record<string, unknown>) || {};
    const branding = (settings.branding as Partial<BrandingSettings>) || {};

    // Creators know the portal as CCM (their texts say so too)
    const senderName = (branding.emailFromName && branding.emailFromName.trim()) || BRAND.name;

    const logoUrl =
      branding.emailLogoEnabled === false
        ? null
        : usableLogoUrl(branding.logoLight || agency.logo);

    return {
      agencyName: agency.name,
      fromName: senderName,
      logoUrl,
      markUrl: `${getAppUrl()}/email/ccm-mark.png`,
      primaryColor: EMAIL_COLORS.acc,
      buttonTextColor: EMAIL_COLORS.accInk,
      signature: normalizeSignature(branding.emailSignature),
      supportEmail: branding.supportEmail || null,
      replyTo: branding.emailReplyTo || null,
    };
  } catch (error) {
    console.error("Failed to load email branding:", error);
    return {
      ...FALLBACK_BRANDING,
      agencyName: fallbackName || FALLBACK_BRANDING.agencyName,
      fromName: fallbackName || FALLBACK_BRANDING.fromName,
    };
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "\u2014",
  ndash: "\u2013",
  middot: "\u00b7",
  copy: "\u00a9",
  zwnj: "",
};

/**
 * Derive a readable plain-text part from email HTML. Used when a caller
 * doesn't supply its own text so every email goes out multipart.
 */
export function htmlToText(html: string): string {
  const stripTags = (value: string) => value.replace(/<[^>]+>/g, "");
  const text = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Hidden preheader
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(
      /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href: string, label: string) => {
        const cleanLabel = stripTags(label).trim();
        return cleanLabel && cleanLabel !== href ? `${cleanLabel} (${href})` : href;
      }
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = Number(code);
      // &#847; (combining grapheme joiner) is preheader padding only
      return n === 847 ? "" : String.fromCodePoint(n);
    })
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);

  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Display name for the "From" header, e.g. the agency name */
  fromName?: string;
  replyTo?: string;
}

/** Build the RFC 5322 "From" value: `Agency Name <address>` */
function buildFrom(fromName?: string): string {
  // EMAIL_FROM may be a bare address or already `Name <addr>`; extract the addr.
  const match = FROM_EMAIL.match(/<([^>]+)>/);
  const address = match ? match[1] : FROM_EMAIL;

  if (!fromName) return address;
  // Strip characters that would break the header, then quote the display name.
  const clean = fromName.replace(/["\\\r\n<>]/g, "").trim();
  if (!clean) return address;
  return `"${clean}" <${address}>`;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  fromName,
  replyTo,
}: SendEmailOptions) {
  const client = getResendClient();
  // Always send a plain-text alternative alongside the HTML
  const textPart = text && text.trim() ? text : htmlToText(html);

  if (!client) {
    console.log("[MOCK EMAIL] Would be sent:", {
      to,
      from: buildFrom(fromName),
      subject,
      preview: html.substring(0, 100) + "...",
    });
    return { success: true, mock: true };
  }

  try {
    // Resend resolves (does not throw) on API errors such as rate limits or
    // unverified domains, so surface them as thrown errors for callers.
    const { data, error } = await client.emails.send({
      from: buildFrom(fromName),
      to,
      subject,
      html,
      text: textPart,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      const err = new Error(`Resend ${error.name}: ${error.message}`);
      (err as Error & { resendError?: unknown }).resendError = error;
      throw err;
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

// BULK EMAIL RENDERING PIPELINE
// Shared by the immediate send path (api/email/send) and the
// scheduled/queued path (api/cron/email-queue) so both render identically:
// per-recipient variable substitution -> markdown-to-HTML -> template wrapper.

/** Replace {{key}} placeholders with per-recipient values */
function processVariables(
  text: string,
  variables: Record<string, string>
): string {
  let processed = text;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    processed = processed.replace(regex, value || "");
  });

  return processed;
}

/** Convert markdown-like syntax to HTML (escapes HTML entities first) */
function convertToHtml(text: string, linkColor: string): string {
  let html = text;

  // Escape HTML entities
  html = html.replace(/&/g, "&amp;");
  html = html.replace(/</g, "&lt;");
  html = html.replace(/>/g, "&gt;");
  html = html.replace(/"/g, "&quot;");

  // Links: [text](url) - converted first and swapped for placeholder tokens so
  // the emphasis rules below never touch `_` or `*` inside an href
  const links: string[] = [];
  html = html.replace(/\[([^\]]*?)\]\(([^)\s]*?)\)/g, (_m, label: string, url: string) => {
    const link = /^(https?:|mailto:)/i.test(url)
      ? `<a href="${url}" style="color: ${linkColor}; text-decoration: underline;">${label}</a>`
      : label;
    links.push(link);
    return `\u0000LINK${links.length - 1}\u0000`;
  });

  // Convert markdown-like syntax
  // Bold: **text** or __text__ (underscore forms skip intraword underscores)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^\w])__(?=\S)([^\n]*?\S)__(?!\w)/g, "$1<strong>$2</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>");

  // Underline: <u>text</u> (already HTML)
  html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>");

  // Code: `text`
  html = html.replace(/`(.*?)`/g, `<code style="background: ${EMAIL_COLORS.tileHi}; padding: 2px 6px; border-radius: 6px;">$1</code>`);

  // Headers
  html = html.replace(/^## (.*$)/gm, `<h2 style="font-family: ${FONT_STACK}; font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; color: ${EMAIL_COLORS.ink};">$1</h2>`);
  html = html.replace(/^# (.*$)/gm, `<h1 style="font-family: ${FONT_STACK}; font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; color: ${EMAIL_COLORS.ink};">$1</h1>`);

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gm, `<blockquote style="border-left: 3px solid ${EMAIL_COLORS.ctl}; margin: 1em 0; padding-left: 1em; color: ${EMAIL_COLORS.ink2};">$1</blockquote>`);

  // Horizontal rule
  html = html.replace(/^---$/gm, `<hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.line}; margin: 1.5em 0;">`);

  // Restore links
  html = html.replace(/\u0000LINK(\d+)\u0000/g, (_m, i: string) => links[Number(i)]);

  // Lists
  html = html.replace(/^- (.*$)/gm, `<li style="margin-left: 1.5em; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.55; color: ${EMAIL_COLORS.ink};">$1</li>`);
  html = html.replace(/^(\d+)\. (.*$)/gm, `<li style="margin-left: 1.5em; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.55; color: ${EMAIL_COLORS.ink};">$2</li>`);

  // Wrap consecutive list items
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin: 0.5em 0;">${match}</ul>`);

  // Convert newlines to paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((para) => {
      // Don't wrap if it's already a block element
      if (
        para.startsWith("<h1") ||
        para.startsWith("<h2") ||
        para.startsWith("<ul") ||
        para.startsWith("<ol") ||
        para.startsWith("<blockquote") ||
        para.startsWith("<hr")
      ) {
        return para;
      }
      return p(para.replace(/\n/g, "<br>"));
    })
    .join("");

  return html;
}

export interface BulkEmailVariableInput {
  creatorName: string;
  creatorEmail: string;
  creatorPhone?: string | null;
  agencyName: string;
  portalLink: string;
  senderName?: string | null;
  senderEmail?: string | null;
}

/** Build the {{variable}} substitution map for a single recipient */
export function buildBulkEmailVariables(
  input: BulkEmailVariableInput
): Record<string, string> {
  return {
    "creator.name": input.creatorName,
    "creator.email": input.creatorEmail,
    "creator.phone": input.creatorPhone || "",
    "agency.name": input.agencyName,
    "portal.link": input.portalLink,
    "request.title": "", // Not available in bulk email
    "request.dueDate": "",
    "request.status": "",
    "date.today": new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    "sender.name": input.senderName || "",
    "sender.email": input.senderEmail || "",
  };
}

/**
 * Render a bulk email (subject + body) for one recipient: substitutes
 * variables, converts the body markdown to HTML, and wraps it in the shared
 * branded shell so bulk sends carry the same logo, colour, sender name, and
 * signature as every transactional email. Returns the branded "From" display
 * name and reply-to for the caller to pass to sendEmail.
 */
export async function renderBulkEmail(
  subject: string,
  body: string,
  variables: Record<string, string>,
  agencyId?: string,
  fallbackAgencyName?: string
): Promise<{
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
}> {
  const branding = await loadEmailBranding(agencyId, fallbackAgencyName);
  const processedSubject = processVariables(subject, variables);
  const processedBody = processVariables(body, variables);
  const html = renderEmail({
    subject: processedSubject,
    branding,
    content: convertToHtml(processedBody, EMAIL_COLORS.ink),
  });

  return {
    subject: processedSubject,
    html,
    text: processedBody + textFooter(branding),
    fromName: branding.fromName,
    replyTo: branding.replyTo ?? undefined,
  };
}

// TRANSACTIONAL EMAIL TEMPLATES
// Creator emails are worded on Reminders > Wording (src/lib/message-copy.ts)
// and built by src/lib/creator-emails.ts, which the editor's preview also
// uses. Staff and account emails keep fixed wording. All share the shell in
// src/lib/email-layout.ts.

function send(to: string, email: ComposedEmail, branding: EmailBranding) {
  return sendEmail({ to, subject: email.subject, html: email.html, text: email.text, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}

export async function sendCreatorInviteEmail({
  to,
  creatorName,
  agencyName,
  inviteLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  agencyName: string;
  inviteLink: string;
  agencyId?: string;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId, agencyName), loadMessageCopy(agencyId)]);
  const email = composeInviteEmail(copy.invite, { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, link: inviteLink }, branding);
  return send(to, email, branding);
}

/**
 * A teammate's invite: a link to /join/<token> where they choose their own
 * password. The subject stays generic (no role, no names).
 */
export async function sendStaffInviteEmail({
  to,
  name,
  roleName,
  inviterName,
  joinLink,
  agencyId,
}: {
  to: string;
  name?: string | null;
  roleName: string;
  inviterName?: string | null;
  joinLink: string;
  agencyId?: string;
}) {
  const branding = await loadEmailBranding(agencyId);
  const displayAgency = branding.agencyName;
  const subject = `You're invited to join ${BRAND.name}`;
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const who = inviterName ? `${escapeHtml(inviterName)} invited you` : "You've been invited";

  const content = `
    ${p(greeting)}
    ${p(`${who} to join the ${escapeHtml(BRAND.name)} team on the portal as <strong>${escapeHtml(roleName)}</strong>. Choose your password to set up your account.`)}
    ${ctaButton(joinLink, "Join the team")}
    ${linkFallback(joinLink)}
    ${note(`This link works once and expires in 7 days.`)}
    ${note(`Weren't expecting this? You can ignore this email.`)}
  `;

  const html = renderEmail({ subject, branding, heading: "Join the team", content });

  const text = `
${name ? `Hi ${name},` : "Hi,"}

${inviterName ? `${inviterName} invited you` : "You've been invited"} to join the ${BRAND.name} team on the portal as ${roleName}. Choose your password to set up your account: ${joinLink}

This link works once and expires in 7 days.

Weren't expecting this? You can ignore this email.
  `.trim() + textFooter({ agencyName: displayAgency });

  return sendEmail({ to, subject, html, text, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}

export async function sendContentRequestEmail({
  to,
  creatorName,
  agencyName,
  requestTitle,
  dueDate,
  portalLink,
  agencyId,
  requestCount = 1,
}: {
  to: string;
  creatorName: string;
  agencyName: string;
  /** One title, or a line listing several ("2 requests: Feed photos, Stories") */
  requestTitle: string;
  /** The earliest due date when several requests are listed */
  dueDate: string;
  portalLink: string;
  agencyId?: string;
  /** How many requests this one email announces (a recurring run can send several) */
  requestCount?: number;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId, agencyName), loadMessageCopy(agencyId)]);
  const email = composeNewRequestEmail(
    copy["request.new"],
    { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, requestTitle, dueDate, link: portalLink },
    branding,
    { count: requestCount }
  );
  return send(to, email, branding);
}

/** The reminder wording for a day: before the due day, on it, or overdue */
export function reminderCopyKey(daysUntilDue: number): "reminder.before" | "reminder.dueToday" | "reminder.overdue" {
  return daysUntilDue < 0 ? "reminder.overdue" : daysUntilDue === 0 ? "reminder.dueToday" : "reminder.before";
}

export async function sendReminderEmail({
  to,
  creatorName,
  requestTitle,
  dueDate,
  daysUntilDue,
  portalLink,
  customMessage,
  isTest,
  agencyId,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  dueDate: string;
  daysUntilDue: number;
  portalLink: string;
  customMessage?: string;
  isTest?: boolean;
  agencyId?: string;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId), loadMessageCopy(agencyId)]);
  const email = composeReminderEmail(
    copy[reminderCopyKey(daysUntilDue)],
    { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, due: reminderUrgencyText(daysUntilDue), dueDate, requestTitle, link: portalLink },
    branding,
    { daysUntilDue, customMessage, isTest }
  );
  return send(to, email, branding);
}

export async function sendContentApprovedEmail({
  to,
  creatorName,
  requestTitle,
  portalLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  portalLink?: string;
  agencyId?: string;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId), loadMessageCopy(agencyId)]);
  const link = portalLink ? portalLink.replace(/\/(portal|creator)\/.*$/, "/creator/dashboard") : undefined;
  const email = composeApprovedEmail(copy["request.approved"], { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, requestTitle, link }, branding);
  return send(to, email, branding);
}

export async function sendRevisionRequestEmail({
  to,
  creatorName,
  requestTitle,
  feedback,
  portalLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  feedback: string;
  portalLink: string;
  agencyId?: string;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId), loadMessageCopy(agencyId)]);
  const email = composeChangesEmail(
    copy["request.changes"],
    { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, requestTitle, feedback, link: portalLink },
    branding
  );
  return send(to, email, branding);
}

/** A new request announced from a bulk create: the same wording as any new request */
export async function sendNewRequestEmail({
  to,
  creatorName,
  requestTitle,
  portalLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  portalLink: string;
  agencyId?: string;
}) {
  const [branding, copy] = await Promise.all([loadEmailBranding(agencyId), loadMessageCopy(agencyId)]);
  const email = composeNewRequestEmail(
    copy["request.new"],
    { firstName: smsFirstName(creatorName), agencyName: branding.agencyName, requestTitle, dueDate: "", link: portalLink },
    branding
  );
  return send(to, email, branding);
}

export async function sendPasswordResetEmail({
  to,
  creatorName,
  resetLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  resetLink: string;
  agencyId?: string;
}) {
  const branding = await loadEmailBranding(agencyId);
  const subject = `Reset your ${BRAND.name} portal password`;

  const content = `
    ${p(`Hi ${escapeHtml(smsFirstName(creatorName))}, we got a request to reset the password for your portal account. Choose a new one here:`)}
    ${ctaButton(resetLink, "Reset password")}
    ${linkFallback(resetLink)}
    ${note(`This link expires in 24 hours.`)}
    ${note(`Didn't ask for this? You can ignore this email; your password stays the same.`)}
  `;

  const html = renderEmail({ subject, branding, heading: "Reset your password", content });

  const text = `
Hi ${smsFirstName(creatorName)}, we got a request to reset the password for your portal account.

Reset your password here: ${resetLink}

This link expires in 24 hours.

Didn't ask for this? You can ignore this email; your password stays the same.
  `.trim() + textFooter(branding);

  return sendEmail({ to, subject, html, text, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}

export async function sendBatchedReminderEmail({
  to,
  creatorName,
  requests,
  portalLink,
  agencyId,
}: {
  to: string;
  creatorName: string;
  requests: Array<{
    title: string;
    dueDate: string;
    daysUntilDue: number;
    urgency: string;
  }>;
  portalLink: string;
  agencyId?: string;
}) {
  const branding = await loadEmailBranding(agencyId);
  const overdueCount = requests.filter((r) => r.daysUntilDue < 0).length;
  const dueTodayCount = requests.filter((r) => r.daysUntilDue === 0).length;
  const upcomingCount = requests.filter((r) => r.daysUntilDue > 0).length;

  const summary = [
    overdueCount ? `${overdueCount} overdue` : "",
    dueTodayCount ? `${dueTodayCount} due today` : "",
    upcomingCount ? `${upcomingCount} coming up` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const subject = `Reminder: ${requests.length} content requests waiting (${summary})`;
  const statusText = (d: number) =>
    d < 0 ? `${Math.abs(d)} day${Math.abs(d) !== 1 ? "s" : ""} overdue` : d === 0 ? "Due today" : `Due in ${d} day${d !== 1 ? "s" : ""}`;

  const list = requests
    .map((req) =>
      requestTile({
        title: req.title,
        meta: `${statusText(req.daysUntilDue)} · ${req.dueDate}`,
        chip: req.daysUntilDue < 0 ? chip("overdue") : undefined,
      })
    )
    .join("");

  const content = `
    ${p(`Hi ${escapeHtml(smsFirstName(creatorName))}, here's what's waiting for you:`)}
    ${list}
    ${ctaButton(portalLink, "See all requests")}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: `${requests.length} to wrap up`,
    coverFoot: escapeHtml(summary.charAt(0).toUpperCase() + summary.slice(1)),
    content,
  });

  const text = `
Hi ${smsFirstName(creatorName)}, here's what's waiting for you:

${requests.map((req) => `- ${req.title}: ${statusText(req.daysUntilDue)} (${req.dueDate})`).join("\n")}

See all requests: ${portalLink}
  `.trim() + textFooter(branding);

  return sendEmail({ to, subject, html, text, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}


/**
 * Finalise bulk emails stuck in SENDING: for each one with no queue items left
 * in PENDING/SENDING, set SENT (or FAILED when nothing was sent) and record the
 * sent/failed counts. Safe to call on every cron run. Returns how many were
 * finalised.
 */
export async function finalizeBulkEmails(limit = 50): Promise<number> {
  const sending = await db.bulkEmail.findMany({
    where: {
      status: "SENDING",
      // Skip just-created rows: the immediate send path creates the BulkEmail
      // before its queue items, so it can briefly have none
      updatedAt: { lt: new Date(Date.now() - 60 * 1000) },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let finalized = 0;
  for (const { id } of sending) {
    const remaining = await db.emailQueueItem.count({
      where: { bulkEmailId: id, status: { in: ["PENDING", "SENDING"] } },
    });
    if (remaining > 0) continue;

    const counts = await db.emailQueueItem.groupBy({
      by: ["status"],
      where: { bulkEmailId: id },
      _count: true,
    });

    const sentCount = counts.find((c) => c.status === "SENT")?._count || 0;
    const failedCount = counts.find((c) => c.status === "FAILED")?._count || 0;

    const updated = await db.bulkEmail.updateMany({
      where: { id, status: "SENDING" },
      data: {
        status: failedCount > 0 && sentCount === 0 ? "FAILED" : "SENT",
        sentAt: new Date(),
        sentCount,
        failedCount,
      },
    });
    finalized += updated.count;
  }

  return finalized;
}
