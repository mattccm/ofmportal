const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface SendSmsOptions {
  to: string;
  message: string;
}

export async function sendSms({ to, message }: SendSmsOptions) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("📱 [MOCK SMS] Would be sent:", { to, message });
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

export async function sendContentRequestSms({
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
  const message = `Hi ${creatorName}! You have a new content request: "${requestTitle}". Upload here: ${portalLink}`;
  return sendSms({ to, message });
}

export async function sendReminderSms({
  to,
  creatorName,
  requestTitle,
  daysUntilDue,
  portalLink,
  isTest,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  daysUntilDue: number;
  portalLink: string;
  isTest?: boolean;
}) {
  const urgencyText =
    daysUntilDue < 0
      ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue`
      : daysUntilDue === 0
        ? "due TODAY"
        : `due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;

  const emoji = daysUntilDue < 0 ? "⚠️" : "📅";
  const testPrefix = isTest ? "[TEST] " : "";

  const message = `${testPrefix}${emoji} Hi ${creatorName}! Your content for "${requestTitle}" is ${urgencyText}. Upload: ${portalLink}`;
  return sendSms({ to, message });
}

export async function sendContentApprovedSms({
  to,
  creatorName,
  requestTitle,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
}) {
  const message = `✅ Hi ${creatorName}! Great news - your content for "${requestTitle}" has been approved!`;
  return sendSms({ to, message });
}

export async function sendRevisionRequestSms({
  to,
  creatorName,
  requestTitle,
  portalLink,
}: {
  to: string;
  creatorName: string;
  requestTitle: string;
  portalLink?: string;
}) {
  const linkPart = portalLink ? ` Check feedback & resubmit: ${portalLink}` : "";
  const message = `📝 Hi ${creatorName}, revision needed for "${requestTitle}".${linkPart}`;
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
  const message = `📋 Hi ${creatorName}! You have ${requestCount} content requests pending. View all: ${portalLink}`;
  return sendSms({ to, message });
}

// Alias for camelCase consistency
export const sendSMS = sendSms;
