import { getAppUrl } from "./app-url";
import { randomUUID } from "crypto";
import { reminderUrgencyText, smsFirstName, withBrandPrefix } from "./reminder-copy";
import { composeSms, type CopyKey, type CopyValues } from "./message-copy";
import { loadMessageCopy, lookedUpFillIns } from "./message-copy-server";
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

/**
 * A refusal from Bird, in Bird's own words: its error code (e.g.
 * SMSSenderNotConfigured), what went wrong, and its suggested fix.
 */
export class BirdError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    public remediation: string | undefined,
    message: string
  ) {
    super(message);
    this.name = "BirdError";
  }
}

function birdError(status: number, data: unknown, fallback: string): BirdError {
  const d = (data ?? {}) as { message?: string; error?: { message?: string; name?: string; code?: string; remediation?: string } };
  const e = d.error ?? {};
  return new BirdError(status, e.name ?? e.code, e.remediation, e.message || d.message || fallback);
}

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
    throw birdError(response.status, data, `Failed to send SMS (${response.status})`);
  }
  const segments = data?.segments?.count;
  if (segments > 1) console.warn(`[SMS] Sent as ${segments} segments (${data?.segments?.encoding}); keep texts under 160 characters`);
  return { success: true, provider: "bird", id: data?.id, segments };
}

// ---------- Bird account: status, destination countries, message lookup ----------

export interface SmsProviderStatus {
  provider: "bird" | "twilio" | "none";
  region?: string;
  sender?: string;
  senderNumber?: string | null;
}

export function smsProviderStatus(): SmsProviderStatus {
  if (BIRD_API_KEY) {
    return {
      provider: "bird",
      region: BIRD_API_KEY.match(/^b[km]_([a-z0-9]+)_/)?.[1] ?? "us1",
      sender: BIRD_SENDER,
      senderNumber: BIRD_SENDER_NUMBER ?? null,
    };
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) return { provider: "twilio" };
  return { provider: "none" };
}

export interface BirdDestination {
  country_code: string;
  enabled: boolean;
  [field: string]: unknown;
}

async function birdRequest(path: string, init: { method?: string; body?: unknown } = {}) {
  if (!BIRD_API_KEY) throw new BirdError(400, "NotConnected", "Add BIRD_API_KEY in Vercel, then redeploy.", "Bird isn't connected");
  const response = await fetch(`${birdHost()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${BIRD_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.method && init.method !== "GET" ? { "Idempotency-Key": randomUUID() } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw birdError(response.status, data, `Bird answered ${response.status}`);
  return data;
}

/** Every country Bird texts, with whether this workspace has switched it on */
export async function birdListDestinations(): Promise<BirdDestination[]> {
  const data = await birdRequest("/v1/sms/destinations");
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}

/** Switch countries on or off; countries not listed keep their setting */
export async function birdUpdateDestinations(changes: { country_code: string; enabled: boolean }[]) {
  return birdRequest("/v1/sms/destinations", { method: "PATCH", body: { destinations: changes } });
}

/** A sent text's delivery status, segments and cost */
export async function birdGetMessage(id: string) {
  return birdRequest(`/v1/sms/messages/${encodeURIComponent(id)}`);
}

// ---------- Bird senders and organisation verification ----------
// Sending as a name like "CCM" needs the organisation verified, the name
// claimed (free), and in some countries a registration (which can carry a
// setup fee and monthly charge, so the portal leaves registering to Bird).

const listOf = (data: { data?: unknown } | unknown[]): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : Array.isArray((data as { data?: unknown }).data) ? ((data as { data: Record<string, unknown>[] }).data) : [];

/** The senders (names and numbers) this workspace holds */
export async function birdListSenders() {
  return listOf(await birdRequest("/v1/sms/senders"));
}

/** Claim an alphanumeric sender name such as "CCM" (free) */
export async function birdClaimSender(name: string) {
  return birdRequest("/v1/sms/senders", { method: "POST", body: { sender: name, type: "alpha" } });
}

/** Per country: whether this sender needs a registration there, and where it stands */
export async function birdSenderRequirements(senderId: string) {
  return listOf(await birdRequest(`/v1/sms/senders/${encodeURIComponent(senderId)}/requirements`));
}

/** The organisation's verification requirements and their status */
export async function birdTrustGates() {
  return listOf(await birdRequest("/v1/trust/gates"));
}

/** Start a verification: Bird answers with a link to complete, or says where it sent a code */
export async function birdStartVerification(slug: string) {
  return birdRequest(`/v1/trust/gates/${encodeURIComponent(slug)}/verification`, { method: "POST" });
}

/** Finish a code verification with the code the person received */
export async function birdCheckVerification(slug: string, code: string) {
  return birdRequest(`/v1/trust/gates/${encodeURIComponent(slug)}/verification/check`, { method: "POST", body: { code } });
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
// request-specific wording (Reminders > Wording refuses {{requestTitle}} in a
// text). `requestTitle` is still accepted for caller
// compatibility but intentionally unused. sendSms adds the "CCM: " prefix.

/** The agency's wording for a text, filled in (sendSms adds the "CCM: " prefix and shortens links) */
async function worded(key: CopyKey, values: CopyValues): Promise<string> {
  const copy = await loadMessageCopy();
  // Template, priority, items and who looks after them: looked up only when the text uses them
  const extra = await lookedUpFillIns(copy[key], { link: values.link });
  return composeSms(copy[key], { ...values, ...extra });
}

export async function sendCreatorInviteSms({
  to,
  creatorName,
  inviteLink,
}: {
  to: string;
  creatorName: string;
  inviteLink: string;
}) {
  const message = await worded("invite", { firstName: smsFirstName(creatorName), fullName: creatorName, link: inviteLink });
  return sendSms({ to, message });
}

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
  const message = await worded("request.new", { firstName: smsFirstName(creatorName), fullName: creatorName, requestCount: "1", link: portalLink });
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
  const key = daysUntilDue < 0 ? "reminder.overdue" : daysUntilDue === 0 ? "reminder.dueToday" : "reminder.before";
  const message = await worded(key, {
    firstName: smsFirstName(creatorName),
    fullName: creatorName,
    due: reminderUrgencyText(daysUntilDue),
    daysLeft: String(Math.max(0, daysUntilDue)),
    daysOverdue: String(Math.max(0, -daysUntilDue)),
    link: portalLink,
  });
  return sendSms({ to, message: isTest ? `[TEST] ${message}` : message });
}

export async function sendContentApprovedSms({
  to,
  creatorName,
}: {
  to: string;
  creatorName: string;
  requestTitle?: string;
}) {
  const message = await worded("request.approved", { firstName: smsFirstName(creatorName), fullName: creatorName });
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
  const message = await worded("request.changes", { firstName: smsFirstName(creatorName), fullName: creatorName, link: portalLink ?? `${getAppUrl()}/creator/requests` });
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
