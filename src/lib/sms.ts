import { randomUUID } from "crypto";
import { reminderSmsBody, smsFirstName, withBrandPrefix } from "./reminder-copy";
import { toE164 } from "./phone";

// Bird (bird.com) is the SMS provider. Twilio stays as a fallback when only
// its keys are set; with neither, messages are logged instead of sent.
const BIRD_API_KEY = process.env.BIRD_API_KEY;
// Alphanumeric sender shown where networks allow it (3-11 chars, one letter)
const BIRD_SENDER = process.env.BIRD_SENDER || "CCM";
// A number the Bird workspace owns: used where alphanumeric senders aren't
// allowed (US/Canada) and as the fallback when a destination refuses them
const BIRD_SENDER_NUMBER = process.env.BIRD_SENDER_NUMBER;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface SendSmsOptions {
  to: string;
  message: string;
}

export type SendSmsResult =
  | { success: true; provider: "bird" | "twilio"; id?: string; segments?: number; data?: unknown }
  | { success: true; mock: true }
  | { success: false; skipped: true; reason: string };

/**
 * Prefix the body with the brand ("CCM: ...") so creators recognise the
 * sender, unless the message already starts with the brand name.
 */
export function withSmsBrandPrefix(message: string): string {
  return withBrandPrefix(message);
}

/**
 * Texts are billed per 160-character segment, so links use the short creator
 * path. The old /portal/<creator>/requests/<id> path redirects to the same page.
 */
export function shortenSmsLinks(message: string): string {
  return message
    .replace(/\/portal\/[^/\s]+\/requests\/([^/\s?#]+)/g, "/creator/requests/$1")
    .replace(/\/portal\/[^/\s]+\/requests(?=[\s?#]|$)/g, "/creator/requests")
    .replace(/\/portal\/(?!login\b|setup\b|onboarding\b)[^/\s]+(?=[\s?#]|$)/g, "/creator/dashboard");
}

export async function sendSms({ to, message: rawMessage }: SendSmsOptions): Promise<SendSmsResult> {
  const message = shortenSmsLinks(withSmsBrandPrefix(rawMessage));
  const recipient = toE164(to);
  if (!recipient) {
    // Never guess a country: a wrong prefix texts a stranger
    console.warn("[SMS] Skipped: phone number has no country code");
    return { success: false, skipped: true, reason: "Phone number needs its country code (e.g. +44...)" };
  }

  if (BIRD_API_KEY) return sendWithBird(recipient, message);
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) return sendWithTwilio(recipient, message);

  console.log("[MOCK SMS] Would be sent:", { to: recipient, message });
  return { success: true, mock: true };
}

// ---------- Bird ----------

function birdHost(): string {
  if (process.env.BIRD_API_HOST) return process.env.BIRD_API_HOST;
  // Keys carry their region (bk_us1_..., bk_eu1_...) and must use that host
  const region = BIRD_API_KEY?.match(/^b[km]_([a-z0-9]+)_/)?.[1] ?? "us1";
  return `https://${region}.platform.bird.com`;
}

// North America doesn't deliver alphanumeric senders
const needsNumberSender = (e164: string) => e164.startsWith("+1");

async function birdSend(to: string, text: string, from: string) {
  const response = await fetch(`${birdHost()}/v1/sms/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BIRD_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    // smart_encoding swaps accented letters for GSM-7 ones so a name like
    // "María" doesn't push the text into the 70-character UCS-2 encoding
    body: JSON.stringify({ to, from, text, category: "transactional", options: { smart_encoding: true } }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendWithBird(to: string, message: string): Promise<SendSmsResult> {
  const first = needsNumberSender(to) && BIRD_SENDER_NUMBER ? BIRD_SENDER_NUMBER : BIRD_SENDER;
  let { response, data } = await birdSend(to, message, first);

  // A destination that refuses the alphanumeric sender gets the number instead
  const senderRefused = response.status === 422 && /Sender/i.test(JSON.stringify(data));
  if (senderRefused && BIRD_SENDER_NUMBER && first !== BIRD_SENDER_NUMBER) {
    ({ response, data } = await birdSend(to, message, BIRD_SENDER_NUMBER));
  }

  if (!response.ok) {
    console.error("Bird SMS error:", response.status, data);
    throw new Error(data?.message || data?.error?.message || `Failed to send SMS (${response.status})`);
  }
  const segments = data?.segments?.count;
  if (segments > 1) console.warn(`[SMS] Sent as ${segments} segments (${data?.segments?.encoding}); keep texts under 160 characters`);
  return { success: true, provider: "bird", id: data?.id, segments };
}

// ---------- Twilio (fallback) ----------

async function sendWithTwilio(to: string, message: string): Promise<SendSmsResult> {
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
          To: to,
          From: TWILIO_PHONE_NUMBER!,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);
      throw new Error(data.message || "Failed to send SMS");
    }

    return { success: true, provider: "twilio", data };
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
  const message = `Hi ${smsFirstName(creatorName)}, you have a new content request. View it here: ${portalLink}`;
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
  // Shared with the reminder-rules preview (src/lib/reminder-copy.ts)
  const message = reminderSmsBody({ creatorName, daysUntilDue, portalLink, isTest });
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
  const message = `Hi ${smsFirstName(creatorName)}, your content has been approved.`;
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
  const message = `Hi ${smsFirstName(creatorName)}, changes have been requested on your content.${linkPart}`;
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
  const message = `Hi ${smsFirstName(creatorName)}, you have ${requestCount} content requests pending. View all: ${portalLink}`;
  return sendSms({ to, message });
}

// Alias for camelCase consistency
export const sendSMS = sendSms;
