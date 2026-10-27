import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { optionalPhone } from "@/lib/phone";
import {
  birdGetMessage,
  birdListDestinations,
  birdUpdateDestinations,
  sendSms,
  smsProviderStatus,
} from "@/lib/sms";

// Text message settings: which countries Bird may text, and test texts.
// The Bird key stays on the server; the page only sees results.

/** GET: provider status and destination countries, or one sent message (?message=id) */
export async function GET(req: NextRequest) {
  const gate = await requireAccess("settings.sms");
  if (gate.error) return gate.error;

  const status = smsProviderStatus();
  const messageId = req.nextUrl.searchParams.get("message");
  try {
    if (messageId) {
      if (status.provider !== "bird") return NextResponse.json({ error: "Bird isn't connected" }, { status: 400 });
      return NextResponse.json({ message: await birdGetMessage(messageId) });
    }
    if (status.provider !== "bird") return NextResponse.json({ status, destinations: [] });
    return NextResponse.json({ status, destinations: await birdListDestinations() });
  } catch (error) {
    // Bird's own words (e.g. a key without SMS access) help more than a generic failure
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bird didn't save that" }, { status: 502 });
  }
}

const testSchema = z.object({ to: optionalPhone });

/** POST: send a test text to a number */
export async function POST(req: NextRequest) {
  const gate = await requireAccess("settings.sms");
  if (gate.error) return gate.error;

  const parsed = testSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the number" }, { status: 400 });
  if (!parsed.data.to) return NextResponse.json({ error: "Enter the number to text" }, { status: 400 });

  try {
    const sent = await sendSms({ to: parsed.data.to, message: "Test text from your portal. Texts to creators are working." });
    if (!sent.success) return NextResponse.json({ error: sent.reason }, { status: 400 });
    if ("mock" in sent) return NextResponse.json({ error: "No SMS provider is connected, so nothing was sent" }, { status: 400 });
    return NextResponse.json({ sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The text didn't send" }, { status: 502 });
  }
}
