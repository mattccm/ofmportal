import { BRAND } from "./brand";

/**
 * Small wording helpers shared by the senders and the previews. The editable
 * wording itself lives in src/lib/message-copy.ts. Pure: safe in client
 * components.
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

/** The SMS exactly as delivered: "CCM: Hi ..." */
export function withBrandPrefix(message: string): string {
  const trimmed = message.trimStart();
  if (trimmed.toLowerCase().startsWith(BRAND.name.toLowerCase())) return trimmed;
  return `${BRAND.name}: ${trimmed}`;
}
