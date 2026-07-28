import { Resend } from "resend";
import { db } from "./db";
import {
  DEFAULT_BRANDING,
  isValidHexColor,
  getContrastColor,
  type BrandingSettings,
} from "./branding";

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

/** Escape HTML entities to prevent injection in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// EMAIL BRANDING
// Transactional emails are branded as the agency: the header shows the
// agency logo (falling back to the agency name), the agency's primary brand
// colour drives the accent bar and call-to-action buttons, and the "From"
// display name is the agency's configurable sender name. Branding is stored
// on the agency (name + logo + settings.branding); this loader resolves the
// values used by every email builder below.

interface EmailBranding {
  agencyName: string;
  /** Display name used for the email "From" header */
  fromName: string;
  /** Absolute logo URL (http/https/data:) or null to fall back to the name */
  logoUrl: string | null;
  primaryColor: string;
  /** Readable text colour to sit on top of primaryColor buttons */
  buttonTextColor: string;
  signature: string | null;
  supportEmail: string | null;
  replyTo: string | null;
}

const FALLBACK_BRANDING: EmailBranding = {
  agencyName: DEFAULT_BRANDING.emailFromName,
  fromName: DEFAULT_BRANDING.emailFromName,
  logoUrl: null,
  primaryColor: DEFAULT_BRANDING.primaryColor,
  buttonTextColor: getContrastColor(DEFAULT_BRANDING.primaryColor),
  signature: DEFAULT_BRANDING.emailSignature,
  supportEmail: null,
  replyTo: null,
};

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

    const primaryColor =
      branding.primaryColor && isValidHexColor(branding.primaryColor)
        ? branding.primaryColor
        : DEFAULT_BRANDING.primaryColor;

    const senderName =
      (branding.emailFromName && branding.emailFromName.trim()) || agency.name;

    const logoUrl =
      branding.emailLogoEnabled === false
        ? null
        : usableLogoUrl(branding.logoLight || agency.logo);

    return {
      agencyName: agency.name,
      fromName: senderName,
      logoUrl,
      primaryColor,
      buttonTextColor: getContrastColor(primaryColor),
      signature:
        (branding.emailSignature && branding.emailSignature.trim()) || null,
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

// SHARED EMAIL TEMPLATE
// Table-based, fully inline-styled layout that renders reliably across email
// clients on a light background: a brand-coloured accent bar, a header with
// the agency logo (or name), a readable content area, and a branded footer.

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const TEXT = {
  heading: "#18181b",
  body: "#3f3f46",
  muted: "#71717a",
  faint: "#a1a1aa",
};

/** Standard body paragraph */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${TEXT.body};">${html}</p>`;
}

/** Small, muted note paragraph */
export function note(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${TEXT.muted};">${html}</p>`;
}

/** Rounded pill used to signal status (approved / changes / overdue) */
function statusPill(label: string, color: string, background: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="padding:6px 14px;background-color:${background};border-radius:999px;font-family:${FONT_STACK};font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:${color};">${escapeHtml(label)}</td></tr></table>`;
}

/** Light-grey information card */
export function infoCard(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background-color:#f9fafb;border:1px solid #eef0f2;border-radius:10px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>`;
}

/** Bulletproof, brand-coloured call-to-action button */
export function ctaButton(url: string, label: string, branding: EmailBranding): string {
  const safeUrl = escapeHtml(url);
  return `<div style="text-align:center;margin:28px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" bgcolor="${branding.primaryColor}" style="border-radius:8px;"><a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${branding.buttonTextColor};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table></div>`;
}

/** Copy-and-paste fallback for the CTA link */
function linkFallback(url: string): string {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:13px;color:${TEXT.muted};">Or paste this link into your browser:</p><p style="margin:0 0 16px;padding:12px 14px;background-color:#f4f4f7;border-radius:8px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#52525b;word-break:break-all;">${safeUrl}</p>`;
}

/**
 * Wrap pre-built (already-escaped) content HTML in the branded shell.
 * `heading` and any interpolated values must already be safe.
 */
export function renderEmail(options: {
  subject: string;
  branding: EmailBranding;
  /** Optional H1 shown above the content; omit for pre-formatted bodies */
  heading?: string;
  content: string;
}): string {
  const { subject, branding, heading, content } = options;
  const safeAgency = escapeHtml(branding.agencyName);
  const year = new Date().getFullYear();

  const headerInner = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${safeAgency}" height="36" style="display:block;height:36px;max-height:36px;width:auto;border:0;line-height:100%;outline:none;text-decoration:none;">`
    : `<span style="font-family:${FONT_STACK};font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${branding.primaryColor};">${safeAgency}</span>`;

  const signatureLine = branding.signature
    ? escapeHtml(branding.signature)
    : `Sent by ${safeAgency}`;

  const supportLine = branding.supportEmail
    ? `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${TEXT.faint};">Need a hand? Email <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:${branding.primaryColor};text-decoration:none;">${escapeHtml(branding.supportEmail)}</a>.</p>`
    : "";

  const headingHtml = heading
    ? `<h1 style="margin:0 0 20px;font-family:${FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;color:${TEXT.heading};">${escapeHtml(heading)}</h1>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;width:100%;background-color:#f4f4f7;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background-color:${branding.primaryColor};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f1f1f4;">${headerInner}</td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                ${headingHtml}
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 40px 30px;border-top:1px solid #f1f1f4;background-color:#fbfbfc;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${TEXT.muted};">${signatureLine}</p>
                ${supportLine}
              </td>
            </tr>
          </table>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:16px 40px;text-align:center;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${TEXT.faint};">&copy; ${year} ${safeAgency}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    const result = await client.emails.send({
      from: buildFrom(fromName),
      to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });

    return { success: true, data: result };
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
function convertToHtml(text: string): string {
  let html = text;

  // Escape HTML entities
  html = html.replace(/&/g, "&amp;");
  html = html.replace(/</g, "&lt;");
  html = html.replace(/>/g, "&gt;");

  // Convert markdown-like syntax
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Underline: <u>text</u> (already HTML)
  html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>");

  // Code: `text`
  html = html.replace(/`(.*?)`/g, "<code style=\"background: #f0f0f0; padding: 2px 6px; border-radius: 4px;\">$1</code>");

  // Headers
  html = html.replace(/^## (.*$)/gm, "<h2 style=\"font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em;\">$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1 style=\"font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em;\">$1</h1>");

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gm, "<blockquote style=\"border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666;\">$1</blockquote>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr style=\"border: none; border-top: 1px solid #ddd; margin: 1.5em 0;\">");

  // Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href=\"$2\" style=\"color: #667eea; text-decoration: none;\">$1</a>");

  // Lists
  html = html.replace(/^- (.*$)/gm, "<li style=\"margin-left: 1.5em;\">$1</li>");
  html = html.replace(/^(\d+)\. (.*$)/gm, "<li style=\"margin-left: 1.5em;\">$2</li>");

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
      return `<p style="margin: 0 0 1em 0;">${para.replace(/\n/g, "<br>")}</p>`;
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
    content: convertToHtml(processedBody),
  });

  return {
    subject: processedSubject,
    html,
    text: processedBody,
    fromName: branding.fromName,
    replyTo: branding.replyTo ?? undefined,
  };
}

// TRANSACTIONAL EMAIL TEMPLATES
// Each builder loads the agency branding and renders through the shared shell,
// so the emails are consistently branded as the agency.

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
  const branding = await loadEmailBranding(agencyId, agencyName);
  const displayAgency = branding.agencyName;
  const subject = `${displayAgency} invited you to your creator portal`;
  const safeCreatorName = escapeHtml(creatorName);
  const safeAgencyName = escapeHtml(displayAgency);

  const content = `
    ${p(`Hi ${safeCreatorName},`)}
    ${p(`We're thrilled to be working with you. To make collaborating simple, we've set up a private portal just for you &mdash; it's where we'll share what we need, and where you'll upload your content and track approvals, all in one place.`)}
    ${p(`Setting up your account takes less than a minute. Click below to get started:`)}
    ${ctaButton(inviteLink, "Set up my account", branding)}
    ${linkFallback(inviteLink)}
    ${note(`For your security, this invitation link expires in 7 days.`)}
    ${p(`We can't wait to see what you create.<br><span style="color:${TEXT.muted};">&mdash; The ${safeAgencyName} team</span>`)}
    ${note(`If you weren't expecting this invitation, you can safely ignore this email.`)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: `Welcome, ${creatorName}`,
    content,
  });

  const text = `
Hi ${creatorName},

We're thrilled to be working with you. We've set up a private portal where we'll share what we need and where you can upload your content and track approvals, all in one place.

Set up your account here: ${inviteLink}

For your security, this invitation link expires in 7 days.

We can't wait to see what you create.
— The ${displayAgency} team

If you weren't expecting this invitation, you can safely ignore this email.
  `.trim();

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
}: {
  to: string;
  creatorName: string;
  agencyName: string;
  requestTitle: string;
  dueDate: string;
  portalLink: string;
  agencyId?: string;
}) {
  const branding = await loadEmailBranding(agencyId, agencyName);
  const subject = `New content request: ${requestTitle}`;

  const content = `
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`We have a new content request ready for you:`)}
    ${infoCard(`
      <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:${TEXT.heading};">${escapeHtml(requestTitle)}</p>
      <p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${TEXT.muted};">Due <strong style="color:${TEXT.body};">${escapeHtml(dueDate)}</strong></p>
    `)}
    ${p(`Head to your portal to see the details and upload your content.`)}
    ${ctaButton(portalLink, "View request & upload", branding)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: "New content request",
    content,
  });

  return sendEmail({ to, subject, html, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
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
  const branding = await loadEmailBranding(agencyId);
  const isOverdue = daysUntilDue < 0;
  const isDueToday = daysUntilDue === 0;

  const urgencyText = isOverdue
    ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue`
    : isDueToday
      ? "due today"
      : `due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;

  const testPrefix = isTest ? "[TEST] " : "";
  const subject = `${testPrefix}Reminder: "${requestTitle}" is ${urgencyText}`;

  const pill = isOverdue
    ? statusPill("Overdue", "#b91c1c", "#fef2f2")
    : isDueToday
      ? statusPill("Due today", "#b45309", "#fffbeb")
      : statusPill("Reminder", branding.primaryColor, "#f4f4f7");

  const content = `
    ${pill}
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${customMessage ? p(escapeHtml(customMessage)) : ""}
    ${p(`This is a friendly reminder that your content for <strong>"${escapeHtml(requestTitle)}"</strong> is <strong>${escapeHtml(urgencyText)}</strong>.`)}
    ${infoCard(`
      <p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${TEXT.muted};">Due date: <strong style="color:${TEXT.body};">${escapeHtml(dueDate)}</strong></p>
    `)}
    ${ctaButton(portalLink, "Upload content now", branding)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: isOverdue ? "Your content is overdue" : "A quick reminder",
    content,
  });

  return sendEmail({ to, subject, html, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
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
  const branding = await loadEmailBranding(agencyId);
  const subject = `Your content for "${requestTitle}" has been approved`;

  const content = `
    ${statusPill("Approved", "#15803d", "#f0fdf4")}
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`Great news &mdash; your submission for <strong>"${escapeHtml(requestTitle)}"</strong> has been approved.`)}
    ${p(`Thank you for the great work. We really appreciate it!`)}
    ${portalLink ? ctaButton(portalLink, "View in portal", branding) : ""}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: "Your content was approved",
    content,
  });

  return sendEmail({ to, subject, html, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
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
  const branding = await loadEmailBranding(agencyId);
  const subject = `Changes requested for "${requestTitle}"`;

  const content = `
    ${statusPill("Changes requested", "#b45309", "#fffbeb")}
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`Thanks for your submission for <strong>"${escapeHtml(requestTitle)}"</strong>. Before we can approve it, we'd love a few changes:`)}
    ${infoCard(`
      <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${TEXT.body};white-space:pre-wrap;">${escapeHtml(feedback)}</p>
    `)}
    ${p(`Once you've made the updates, just re-upload and we'll take another look.`)}
    ${ctaButton(portalLink, "View feedback & resubmit", branding)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: "A few changes needed",
    content,
  });

  return sendEmail({ to, subject, html, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}

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
  const branding = await loadEmailBranding(agencyId);
  const subject = `New content request: ${requestTitle}`;

  const content = `
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`You have a new content request waiting for you:`)}
    ${infoCard(`
      <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:${TEXT.heading};">${escapeHtml(requestTitle)}</p>
      <p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${TEXT.muted};">Open your portal to view the details and upload your content.</p>
    `)}
    ${ctaButton(portalLink, "View request", branding)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: "New content request",
    content,
  });

  const text = `
Hi ${creatorName},

You have a new content request: ${requestTitle}

View the request and upload your content: ${portalLink}
  `.trim();

  return sendEmail({ to, subject, html, text, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
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
  const subject = `Reset your ${branding.agencyName} portal password`;

  const content = `
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`We received a request to reset the password for your ${escapeHtml(branding.agencyName)} portal account. Click below to choose a new one:`)}
    ${ctaButton(resetLink, "Reset password", branding)}
    ${linkFallback(resetLink)}
    ${note(`This link will expire in 24 hours.`)}
    ${note(`If you didn't request a password reset, you can safely ignore this email &mdash; your password won't be changed.`)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: "Reset your password",
    content,
  });

  const text = `
Hi ${creatorName},

We received a request to reset the password for your ${branding.agencyName} portal account.

Reset your password here: ${resetLink}

This link will expire in 24 hours.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

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

  let statusSummary = "";
  if (overdueCount > 0) statusSummary += `${overdueCount} overdue`;
  if (dueTodayCount > 0) {
    statusSummary += statusSummary ? `, ${dueTodayCount} due today` : `${dueTodayCount} due today`;
  }
  if (upcomingCount > 0) {
    statusSummary += statusSummary ? `, ${upcomingCount} upcoming` : `${upcomingCount} upcoming`;
  }

  const subject = `Reminder: You have ${requests.length} content requests pending (${statusSummary})`;

  const requestListHtml = requests
    .map((req) => {
      const urgencyColor =
        req.daysUntilDue < 0
          ? "#dc2626"
          : req.daysUntilDue === 0
            ? "#d97706"
            : branding.primaryColor;
      const statusText =
        req.daysUntilDue < 0
          ? `${Math.abs(req.daysUntilDue)} days overdue`
          : req.daysUntilDue === 0
            ? "Due today"
            : `Due in ${req.daysUntilDue} days`;

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background-color:#f9fafb;border:1px solid #eef0f2;border-left:4px solid ${urgencyColor};border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${TEXT.heading};">${escapeHtml(req.title)}</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:13px;">
              <span style="color:${urgencyColor};font-weight:600;">${statusText}</span>
              <span style="color:${TEXT.muted};"> &middot; Due ${escapeHtml(req.dueDate)}</span>
            </p>
          </td></tr>
        </table>
      `;
    })
    .join("");

  const content = `
    ${p(`Hi ${escapeHtml(creatorName)},`)}
    ${p(`Here's a summary of your pending content requests:`)}
    <div style="margin:0 0 8px;">${requestListHtml}</div>
    ${ctaButton(portalLink, "View all requests", branding)}
  `;

  const html = renderEmail({
    subject,
    branding,
    heading: `You have ${requests.length} items to wrap up`,
    content,
  });

  return sendEmail({ to, subject, html, fromName: branding.fromName, replyTo: branding.replyTo ?? undefined });
}
