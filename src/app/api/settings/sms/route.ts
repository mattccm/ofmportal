import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { optionalPhone } from "@/lib/phone";
import {
  BirdError,
  birdCheckVerification,
  birdClaimSender,
  birdGetMessage,
  birdListDestinations,
  birdListSenders,
  birdSenderRequirements,
  birdStartVerification,
  birdTrustGates,
  birdUpdateDestinations,
  sendSms,
  smsProviderStatus,
} from "@/lib/sms";

// Text message settings: which countries Bird may text, the sender name,
// and test texts. The Bird key stays on the server; the page only sees results.

/**
 * Bird's refusal in its own words, never as a 5xx: Vercel answers a 502/504
 * from the app with its own HTML page, which hid Bird's explanation.
 */
function failure(error: unknown, fallback: string) {
  if (error instanceof BirdError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 424;
    return NextResponse.json({ error: error.message, code: error.code, fix: error.remediation }, { status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 424 });
}

const senderName = (s: Record<string, unknown>) => String(s.sender ?? s.name ?? s.value ?? s.originator ?? "");

/** GET: provider status and countries; ?view=sender for the sender name; ?message=id for one sent text */
export async function GET(req: NextRequest) {
  const gate = await requireAccess("settings.sms");
  if (gate.error) return gate.error;

  const status = smsProviderStatus();
  const messageId = req.nextUrl.searchParams.get("message");
  const view = req.nextUrl.searchParams.get("view");
  try {
    if (messageId) {
      if (status.provider !== "bird") return NextResponse.json({ error: "Bird isn't connected" }, { status: 400 });
      return NextResponse.json({ message: await birdGetMessage(messageId) });
    }
    if (status.provider !== "bird") return NextResponse.json({ status, destinations: [] });
    if (view === "sender") {
      // Each read reports separately, so one refusal doesn't hide the rest
      const settle = async <T,>(p: Promise<T>) =>
        p.then((value) => ({ value })).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e), fix: e instanceof BirdError ? e.remediation : undefined }));
      const [gates, senders] = await Promise.all([settle(birdTrustGates()), settle(birdListSenders())]);
      const ours = "value" in senders ? senders.value.find((s) => senderName(s).toLowerCase() === (status.sender ?? "").toLowerCase()) : undefined;
      const requirements = ours?.id ? await settle(birdSenderRequirements(String(ours.id))) : null;
      return NextResponse.json({ status, gates, senders, sender: ours ?? null, requirements });
    }
    return NextResponse.json({ status, destinations: await birdListDestinations() });
  } catch (error) {
    if (error instanceof BirdError) {
      return NextResponse.json({ status, destinations: [], error: error.message, fix: error.remediation });
    }
    return NextResponse.json({ status, destinations: [], error: error instanceof Error ? error.message : "Bird didn't answer" });
  }
}

const updateSchema = z.object({
  destinations: z
    .array(z.object({ country_code: z.string().regex(/^[A-Z]{2}$/), enabled: z.boolean() }))
    .min(1)
    .max(250),
});

/** PATCH: switch destination countries on or off */
export async function PATCH(req: NextRequest) {
  const gate = await requireAccess("settings.sms");
  if (gate.error) return gate.error;
  const { session } = gate;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick countries by their two-letter code" }, { status: 400 });

  try {
    await birdUpdateDestinations(parsed.data.destinations);
    await db.activityLog
      .create({
        data: {
          userId: session.user.id,
          action: "sms.destinations_updated",
          entityType: "Agency",
          entityId: session.user.agencyId,
          metadata: { destinations: parsed.data.destinations },
        },
      })
      .catch(() => {});
    return NextResponse.json({ destinations: await birdListDestinations() });
  } catch (error) {
    return failure(error, "Bird didn't save that");
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test"), to: optionalPhone }),
  z.object({ action: z.literal("claim") }),
  z.object({ action: z.literal("verify"), slug: z.string().min(1).max(64) }),
  z.object({ action: z.literal("verify-check"), slug: z.string().min(1).max(64), code: z.string().min(3).max(12) }),
]);

/** POST: send a test text, claim the sender name, or verify the organisation with Bird */
export async function POST(req: NextRequest) {
  const gate = await requireAccess("settings.sms");
  if (gate.error) return gate.error;
  const { session } = gate;

  const raw = await req.json().catch(() => null);
  // Older page versions post just { to } for a test text
  const body = raw && typeof raw === "object" && !("action" in raw) && "to" in raw ? { action: "test", ...raw } : raw;
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the details" }, { status: 400 });
  const input = parsed.data;

  try {
    if (input.action === "test") {
      if (!input.to) return NextResponse.json({ error: "Enter the number to text" }, { status: 400 });
      const sent = await sendSms({ to: input.to, message: "Test text from your portal. Texts to creators are working." });
      if (!sent.success) return NextResponse.json({ error: sent.reason }, { status: 400 });
      if ("mock" in sent) return NextResponse.json({ error: "No SMS provider is connected, so nothing was sent" }, { status: 400 });
      return NextResponse.json({ sent });
    }
    if (input.action === "claim") {
      const name = smsProviderStatus().sender ?? "CCM";
      const sender = await birdClaimSender(name);
      await db.activityLog
        .create({
          data: { userId: session.user.id, action: "sms.sender_claimed", entityType: "Agency", entityId: session.user.agencyId, metadata: { sender: name } },
        })
        .catch(() => {});
      return NextResponse.json({ sender });
    }
    if (input.action === "verify") return NextResponse.json({ verification: await birdStartVerification(input.slug) });
    return NextResponse.json({ verification: await birdCheckVerification(input.slug, input.code) });
  } catch (error) {
    return failure(error, "Bird didn't do that");
  }
}
