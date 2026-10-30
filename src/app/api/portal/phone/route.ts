import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { pushPublicKey, sendPushToCreator } from "@/lib/push";

/**
 * The creator's "Set up your phone" tasks.
 * GET: { appInstalled, notifications (devices with notifications on), publicKey }
 * POST { action: "home-screen" }: the portal was opened from the home screen
 * POST { action: "subscribe", subscription }: this device allowed notifications
 * DELETE { endpoint }: this device turned them off
 */

export async function GET(req: NextRequest) {
  const auth = await validateCreatorSession(req);
  if (!auth.success) return auth.error;
  const [creator, devices] = await Promise.all([
    db.creator.findUnique({ where: { id: auth.creator.id }, select: { appInstalledAt: true } }),
    db.pushSubscription.count({ where: { creatorId: auth.creator.id } }),
  ]);
  return NextResponse.json({ appInstalled: !!creator?.appInstalledAt, notifications: devices, publicKey: pushPublicKey() });
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});
const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("home-screen") }),
  z.object({ action: z.literal("subscribe"), subscription: subscriptionSchema }),
]);

export async function POST(req: NextRequest) {
  const auth = await validateCreatorSession(req);
  if (!auth.success) return auth.error;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  const creatorId = auth.creator.id;

  if (parsed.data.action === "home-screen") {
    await db.creator.updateMany({ where: { id: creatorId, appInstalledAt: null }, data: { appInstalledAt: new Date() } });
    return NextResponse.json({ appInstalled: true });
  }

  if (!pushPublicKey()) return NextResponse.json({ error: "Notifications aren't set up on the portal yet. Ask your team." }, { status: 424 });
  const { endpoint, keys } = parsed.data.subscription;
  // One row per device; a device that moves to another account follows it
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { creatorId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null },
    update: { creatorId, p256dh: keys.p256dh, auth: keys.auth },
  });
  const { sent } = await sendPushToCreator(creatorId, { body: "Notifications are on. We'll let you know when there's something new.", tag: "welcome" });
  return NextResponse.json({ subscribed: true, testSent: sent > 0 });
}

const deleteSchema = z.object({ endpoint: z.string().url().max(2000) });

export async function DELETE(req: NextRequest) {
  const auth = await validateCreatorSession(req);
  if (!auth.success) return auth.error;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing." }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { creatorId: auth.creator.id, endpoint: parsed.data.endpoint } });
  return NextResponse.json({ removed: true });
}
