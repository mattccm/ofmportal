import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { pushPublicKey } from "@/lib/push";
import { pushToTeam } from "@/lib/staff-push";
import { NotificationType } from "@/lib/notifications";

/**
 * Notifications on this device, for staff (Settings > Notifications).
 * GET ?endpoint=: { publicKey, devices (how many of mine have them on), thisDevice }
 * POST { subscription }: this device turned them on (sends one to check)
 * DELETE { endpoint }: this device turned them off
 */

export async function GET(req: NextRequest) {
  const gate = await requireAccess(null);
  if (gate.error) return gate.error;
  const userId = gate.session.user.id;
  // ?endpoint= asks about this device in particular
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  const [devices, thisDevice] = await Promise.all([
    db.staffPushSubscription.count({ where: { userId } }),
    endpoint ? db.staffPushSubscription.count({ where: { userId, endpoint } }) : Promise.resolve(0),
  ]);
  return NextResponse.json({ publicKey: pushPublicKey(), devices, thisDevice: thisDevice > 0 });
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});

export async function POST(req: NextRequest) {
  const gate = await requireAccess(null);
  if (gate.error) return gate.error;
  const parsed = z.object({ subscription: subscriptionSchema }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  if (!pushPublicKey()) return NextResponse.json({ error: "Notifications aren't set up on the portal yet." }, { status: 424 });
  const userId = gate.session.user.id;
  const { endpoint, keys } = parsed.data.subscription;
  // One row per device; a device that moves to another person follows them
  await db.staffPushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });
  const { sent } = await pushToTeam([userId], NotificationType.MESSAGE_RECEIVED, {
    body: "Notifications are on. You'll hear about new messages and comments here.",
    tag: "staff-welcome",
    test: true,
  });
  return NextResponse.json({ subscribed: true, testSent: sent > 0 });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAccess(null);
  if (gate.error) return gate.error;
  const parsed = z.object({ endpoint: z.string().url().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing." }, { status: 400 });
  await db.staffPushSubscription.deleteMany({ where: { userId: gate.session.user.id, endpoint: parsed.data.endpoint } });
  return NextResponse.json({ removed: true });
}
