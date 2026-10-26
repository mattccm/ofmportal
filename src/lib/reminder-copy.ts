import { BRAND } from "./brand";

/**
 * The words a reminder actually carries, in one place so the senders
 * (src/lib/sms.ts, src/lib/email.ts) and the reminder-rules preview can never
 * drift apart. Pure: safe in client components.
 *
 * Lock-screen safe: none of these ever include the request title.
 */

/** "due in 3 days" / "due today" / "2 days overdue" */
export function reminderUrgencyText(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `${n} day${n !== 1 ? "s" : ""} overdue`;
  }
  if (daysUntilDue === 0) return "due today";
  return `due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;
}

/** Texts greet by first name: friendlier, and it keeps them in one 160-character segment */
export function smsFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The reminder SMS body before the brand prefix is added */
export function reminderSmsBody(opts: { creatorName: string; daysUntilDue: number; portalLink: string; isTest?: boolean }): string {
  const testPrefix = opts.isTest ? "[TEST] " : "";
  return `${testPrefix}Hi ${smsFirstName(opts.creatorName)}, you have content ${reminderUrgencyText(opts.daysUntilDue)}. View it here: ${opts.portalLink}`;
}

/** The SMS exactly as delivered: "CCM: Hi ..." */
export function withBrandPrefix(message: string): string {
  const trimmed = message.trimStart();
  if (trimmed.toLowerCase().startsWith(BRAND.name.toLowerCase())) return trimmed;
  return `${BRAND.name}: ${trimmed}`;
}

/** The reminder email subject (also its preheader) */
export function reminderEmailSubject(daysUntilDue: number, isTest = false): string {
  const testPrefix = isTest ? "[TEST] " : "";
  const urgency = reminderUrgencyText(daysUntilDue);
  return daysUntilDue < 0 ? `${testPrefix}Reminder: your content is ${urgency}` : `${testPrefix}Reminder: content ${urgency}`;
}
