import { BRAND } from "./brand";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface SendSmsOptions {
  to: string;
  message: string;
}

const SMS_PREFIX = `${BRAND.name}: `;

/**
 * Prefix the body with the brand ("CCM: ...") so creators recognise the
 * sender, unless the message already starts with the brand name.
 */
export function withSmsBrandPrefix(message: string): string {
  const trimmed = message.trimStart();
  if (trimmed.toLowerCase().startsWith(BRAND.name.toLowerCase())) return trimmed;
  return `${SMS_PREFIX}${trimmed}`;
}

export async function sendSms({ to, message: rawMessage }: SendSmsOptions) {
  const message = withSmsBrandPrefix(rawMessage);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("[MOCK SMS] Would be sent:", { to, message });
    return { success: true, mock: true };
  }

  // Format phone number (ensure it starts with +)
  const formattedTo = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);
      throw new Error(data.message || "Failed to send SMS");
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    throw error;
  }
}

// SMS Templates
//
// Lock-screen safe: SMS previews show on locked phones, and request titles can
// be explicit, so bodies never include the request title or other
// request-specific wording. `requestTitle` is still accepted for caller
// compatibility but intentionally unused. sendSms adds the "CCM: " prefix.

export async function sendContentRequestSms({
  to,
  creatorName,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestTitle?: string;
  portalLink: string;
}) {
  const message = `Hi ${creatorName}, you have a new content request. View it here: ${portalLink}`;
  return sendSms({ to, message });
}

export async function sendReminderSms({
  to,
  creatorName,
  daysUntilDue,
  portalLink,
  isTest,
}: {
  to: string;
  creatorName: string;
  requestTitle?: string;
  daysUntilDue: number;
  portalLink: string;
  isTest?: boolean;
}) {
  const urgencyText =
    daysUntilDue < 0
      ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue`
      : daysUntilDue === 0
        ? "due today"
        : `due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;

  const testPrefix = isTest ? "[TEST] " : "";

  const message = `${testPrefix}Hi ${creatorName}, you have content ${urgencyText}. View it here: ${portalLink}`;
  return sendSms({ to, message });
}

export async function sendContentApprovedSms({
  to,
  creatorName,
}: {
  to: string;
  creatorName: string;
  requestTitle?: string;
}) {
  const message = `Hi ${creatorName}, your content has been approved.`;
  return sendSms({ to, message });
}

export async function sendRevisionRequestSms({
  to,
  creatorName,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestTitle?: string;
  portalLink?: string;
}) {
  const linkPart = portalLink ? ` View feedback here: ${portalLink}` : "";
  const message = `Hi ${creatorName}, changes have been requested on your content.${linkPart}`;
  return sendSms({ to, message });
}

export async function sendBatchedReminderSms({
  to,
  creatorName,
  requestCount,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestCount: number;
  portalLink: string;
}) {
  const message = `Hi ${creatorName}, you have ${requestCount} content requests pending. View all: ${portalLink}`;
  return sendSms({ to, message });
}

// Alias for camelCase consistency
export const sendSMS = sendSms;
