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

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const client = getResendClient();

  if (!client) {
    console.log("📧 [MOCK EMAIL] Would be sent:", {
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
          <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${APP_NAME}!</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hi ${creatorName},</p>

          <p><strong>${agencyName}</strong> has invited you to join their content portal. This is where you'll upload your content for review and approval.</p>

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

          <p>Hi ${creatorName},</p>

          <p><strong>${agencyName}</strong> has a new content request for you:</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${requestTitle}</h3>
            <p style="margin: 0; color: #666;">Due: <strong>${dueDate}</strong></p>
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
            ${isOverdue ? "⚠️ Content Overdue" : "📅 Content Reminder"}
          </h2>

          <p>Hi ${creatorName},</p>

          ${customMessage ? `<p>${customMessage}</p>` : ""}

          <p>This is a friendly reminder that your content for <strong>"${requestTitle}"</strong> is <strong>${urgencyText}</strong>.</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">Due date: <strong>${dueDate}</strong></p>
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
  const subject = `Your content for "${requestTitle}" has been approved!`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border-left: 4px solid #22c55e;">
          <h2 style="margin: 0 0 20px 0; color: #16a34a;">✅ Content Approved!</h2>

          <p>Hi ${creatorName},</p>

          <p>Great news! Your content for <strong>"${requestTitle}"</strong> has been approved.</p>

          <p>Thank you for your submission!</p>
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
          <h2 style="margin: 0 0 20px 0; color: #b45309;">📝 Revision Requested</h2>

          <p>Hi ${creatorName},</p>

          <p>We've reviewed your content for <strong>"${requestTitle}"</strong> and have some feedback:</p>

          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${feedback}</p>
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
          <p>Hi ${creatorName},</p>

          <p>You have a new content request waiting for you:</p>

          <div style="background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${requestTitle}</h3>
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
          <h4 style="margin: 0 0 8px 0; color: #333;">${req.title}</h4>
          <p style="margin: 0; font-size: 14px;">
            <span style="color: ${urgencyColor}; font-weight: 600;">${statusText}</span>
            <span style="color: #666;"> - Due: ${req.dueDate}</span>
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
            ${overdueCount > 0 ? "⚠️" : "📋"} ${requests.length} Content Requests Pending
          </h2>

          <p>Hi ${creatorName},</p>

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
