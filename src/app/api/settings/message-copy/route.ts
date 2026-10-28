import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { loadEmailBranding, sendEmail } from "@/lib/email";
import { composeSample } from "@/lib/creator-emails";
import { COPY_KEYS, COPY_MESSAGES, agencyCopySchema, copyProblems, type AgencyCopy, type CopyKey, type MessageCopy } from "@/lib/message-copy";
import { loadMessageCopy, saveMessageCopy } from "@/lib/message-copy-server";

// Reminders > Wording: what every creator email and text says.
// Either wording permission opens it (reminder wording, or email templates).
const KEYS = ["reminders.templates", "settings.emailTemplates"];

/** The first problem in plain words, naming the message */
function firstProblem(copy: AgencyCopy): string | null {
  for (const k of COPY_KEYS) {
    const p = copyProblems(k, copy[k])[0];
    if (p) return `${COPY_MESSAGES[k].label}, ${p.field === "sms" ? "text" : p.field}: ${p.message}`;
  }
  return null;
}

/** PUT: save the wording for every message (only changes from the standard wording are stored) */
export async function PUT(req: NextRequest) {
  const gate = await requireAccess(KEYS);
  if (gate.error) return gate.error;
  const { access, session } = gate;

  const parsed = agencyCopySchema.safeParse((await req.json().catch(() => null))?.copy);
  if (!parsed.success) return NextResponse.json({ error: "Some wording is too long or missing" }, { status: 400 });
  const problem = firstProblem(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const before = await loadMessageCopy(access.agencyId, { fresh: true });
  const copy = await saveMessageCopy(access.agencyId, parsed.data);
  const changed = COPY_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(copy[k]));
  await db.activityLog
    .create({
      data: {
        userId: session.user.id,
        action: "settings.wording_updated",
        entityType: "Agency",
        entityId: access.agencyId,
        metadata: { messages: changed },
      },
    })
    .catch(() => {});
  return NextResponse.json({ copy });
}

const testSchema = z.object({
  key: z.enum(COPY_KEYS),
  copy: z.object({ subject: z.string(), heading: z.string(), body: z.string(), button: z.string(), sms: z.string() }),
});

/** POST: email a test of one message, as worded in the editor, to the person asking */
export async function POST(req: NextRequest) {
  const gate = await requireAccess(KEYS);
  if (gate.error) return gate.error;
  const { access, session } = gate;

  const parsed = testSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a message to test" }, { status: 400 });
  const key = parsed.data.key as CopyKey;
  const copy = parsed.data.copy as MessageCopy;
  const problem = copyProblems(key, copy).find((p) => p.field !== "sms");
  if (problem) return NextResponse.json({ error: `${problem.field}: ${problem.message}` }, { status: 400 });
  if (!session.user.email) return NextResponse.json({ error: "Your account has no email address" }, { status: 400 });

  const branding = await loadEmailBranding(access.agencyId);
  const email = composeSample(key, copy, branding, { isTest: true, appUrl: getAppUrl() });
  try {
    await sendEmail({ to: session.user.email, subject: email.subject, html: email.html, text: email.text, fromName: branding.fromName });
    return NextResponse.json({ sentTo: session.user.email });
  } catch (error) {
    // Never a 5xx: Vercel replaces those with its own HTML page
    return NextResponse.json({ error: error instanceof Error ? error.message : "The test email didn't send" }, { status: 424 });
  }
}
