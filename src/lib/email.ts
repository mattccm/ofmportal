import { Resend } from "resend";

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
const APP_NAME = process.env.APP_NAME || "CCM Creator Portal";
const COMPANY_NAME = "Content Creation Management Pty Ltd";

/** Escape HTML entities to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const client = getResendClient();

  if (!client) {
    console.log("[MOCK EMAIL] Would be sent:", {
      to,
      subject,
      preview: html.substring(0, 100) + "...",
    });
    return { success: true, mock: true };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
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
    .map((p) => {
      // Don't wrap if it's already a block element
      if (
        p.startsWith("<h1") ||
        p.startsWith("<h2") ||
        p.startsWith("<ul") ||
        p.startsWith("<ol") ||
        p.startsWith("<blockquote") ||
        p.startsWith("<hr")
      ) {
        return p;
      }
      return `<p style="margin: 0 0 1em 0;">${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html;
}

/** Wrap rendered content in the branded email template */
function generateEmailHtml(content: string, agencyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${escapeHtml(agencyName)}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          ${content}
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Sent via CCM
          </p>
        </div>
      </body>
    </html>
  `;
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
 * variables, converts the body markdown to HTML, and wraps it in the template.
 */
export function renderBulkEmail(
  subject: string,
  body: string,
  variables: Record<string, string>,
  agencyName: string
): { subject: string; html: string; text: string } {
  const processedSubject = processVariables(subject, variables);
  const processedBody = processVariables(body, variables);
  const html = generateEmailHtml(convertToHtml(processedBody), agencyName);

  return { subject: processedSubject, html, text: processedBody };
}

// Email templates

export async function sendCreatorInviteEmail({
  to,
  creatorName,
  agencyName,
  inviteLink,
}: {
  to: string;
  creatorName: string;
  agencyName: string;
  inviteLink: string;
}) {
  const subject = `${agencyName} has invited you to ${APP_NAME}`;
  const safeCreatorName = escapeHtml(creatorName);
  const safeAgencyName = escapeHtml(agencyName);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${APP_NAME}!</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hi ${safeCreatorName},</p>

          <p><strong>${safeAgencyName}</strong> has invited you to join their content portal. This is where you'll upload your content for review and approval.</p>

          <p>Click the button below to set up your account:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Set Up Your Account</a>
          </div>

          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #666;">${inviteLink}</p>

          <p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; margin: 0;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${creatorName},

${agencyName} has invited you to join their content portal on ${APP_NAME}.

Set up your account here: ${inviteLink}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendContentRequestEmail({
  to,
  creatorName,
  agencyName,
  requestTitle,
  dueDate,
  portalLink,
}: {
  to: string;
  creatorName: string;
  agencyName: string;
  requestTitle: string;
  dueDate: string;
  portalLink: string;
}) {
  const subject = `New content request: ${requestTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="margin: 0 0 20px 0; color: #333;">New Content Request</h2>

          <p>Hi ${escapeHtml(creatorName)},</p>

          <p><strong>${escapeHtml(agencyName)}</strong> has a new content request for you:</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(requestTitle)}</h3>
            <p style="margin: 0; color: #666;">Due: <strong>${escapeHtml(dueDate)}</strong></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Request & Upload</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
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
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  dueDate: string;
  daysUntilDue: number;
  portalLink: string;
  customMessage?: string;
  isTest?: boolean;
}) {
  const urgencyText =
    daysUntilDue < 0
      ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue`
      : daysUntilDue === 0
        ? "due today"
        : `due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;

  const testPrefix = isTest ? "[TEST] " : "";
  const subject = `${testPrefix}Reminder: "${requestTitle}" is ${urgencyText}`;
  const isOverdue = daysUntilDue < 0;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${isOverdue ? "#fef2f2" : "#f8f9fa"}; padding: 20px; border-radius: 10px; border-left: 4px solid ${isOverdue ? "#ef4444" : "#667eea"};">
          <h2 style="margin: 0 0 20px 0; color: ${isOverdue ? "#dc2626" : "#333"};">
            ${isOverdue ? "Content Overdue" : "Content Reminder"}
          </h2>

          <p>Hi ${escapeHtml(creatorName)},</p>

          ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ""}

          <p>This is a friendly reminder that your content for <strong>"${escapeHtml(requestTitle)}"</strong> is <strong>${urgencyText}</strong>.</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">Due date: <strong>${escapeHtml(dueDate)}</strong></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="background: ${isOverdue ? "#dc2626" : "#667eea"}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload Content Now</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendContentApprovedEmail({
  to,
  creatorName,
  requestTitle,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
}) {
  const subject = `Your content for "${requestTitle}" has been approved`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border-left: 4px solid #22c55e;">
          <h2 style="margin: 0 0 20px 0; color: #16a34a;">Content Approved</h2>

          <p>Hi ${escapeHtml(creatorName)},</p>

          <p>Your content for <strong>"${escapeHtml(requestTitle)}"</strong> has been approved.</p>

          <p>Thank you for your submission.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendRevisionRequestEmail({
  to,
  creatorName,
  requestTitle,
  feedback,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  feedback: string;
  portalLink: string;
}) {
  const subject = `Revision needed for "${requestTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef3c7; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b;">
          <h2 style="margin: 0 0 20px 0; color: #b45309;">Revision Requested</h2>

          <p>Hi ${escapeHtml(creatorName)},</p>

          <p>We've reviewed your content for <strong>"${escapeHtml(requestTitle)}"</strong> and have some feedback:</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(feedback)}</p>
          </div>

          <p>Please make the necessary changes and resubmit.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Feedback & Resubmit</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendNewRequestEmail({
  to,
  creatorName,
  requestTitle,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  portalLink: string;
}) {
  const subject = `New content request: ${requestTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Content Request</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hi ${escapeHtml(creatorName)},</p>

          <p>You have a new content request waiting for you:</p>

          <div style="background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(requestTitle)}</h3>
            <p style="margin: 0; color: #666;">Click below to view details and upload your content.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Request</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; margin: 0;">
            You're receiving this email because you're a creator on ${APP_NAME}.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${creatorName},

You have a new content request: ${requestTitle}

View the request and upload your content: ${portalLink}
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail({
  to,
  creatorName,
  resetLink,
}: {
  to: string;
  creatorName: string;
  resetLink: string;
}) {
  const subject = `Reset your ${APP_NAME} password`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hi ${escapeHtml(creatorName)},</p>

          <p>We received a request to reset your password for ${APP_NAME}. Click the button below to set a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
          </div>

          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #666;">${resetLink}</p>

          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; margin: 0;">
            If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${creatorName},

We received a request to reset your password for ${APP_NAME}.

Reset your password here: ${resetLink}

This link will expire in 24 hours.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendBatchedReminderEmail({
  to,
  creatorName,
  requests,
  portalLink,
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
}) {
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
          ? "#ef4444"
          : req.daysUntilDue === 0
            ? "#f59e0b"
            : "#667eea";
      const statusText =
        req.daysUntilDue < 0
          ? `${Math.abs(req.daysUntilDue)} days overdue`
          : req.daysUntilDue === 0
            ? "Due today"
            : `Due in ${req.daysUntilDue} days`;

      return `
        <div style="background: white; border: 1px solid #e5e5e5; border-left: 4px solid ${urgencyColor}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${escapeHtml(req.title)}</h4>
          <p style="margin: 0; font-size: 14px;">
            <span style="color: ${urgencyColor}; font-weight: 600;">${statusText}</span>
            <span style="color: #666;"> - Due: ${escapeHtml(req.dueDate)}</span>
          </p>
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${overdueCount > 0 ? "#fef2f2" : "#f8f9fa"}; padding: 20px; border-radius: 10px; border-left: 4px solid ${overdueCount > 0 ? "#ef4444" : "#667eea"};">
          <h2 style="margin: 0 0 20px 0; color: ${overdueCount > 0 ? "#dc2626" : "#333"};">
            ${requests.length} Content Requests Pending
          </h2>

          <p>Hi ${escapeHtml(creatorName)},</p>

          <p>Here's a summary of your pending content requests:</p>

          <div style="margin: 20px 0;">
            ${requestListHtml}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="background: ${overdueCount > 0 ? "#dc2626" : "#667eea"}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View All Requests</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}
