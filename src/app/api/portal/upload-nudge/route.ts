import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";

/**
 * A phone stops uploading as soon as the portal goes to the background (another
 * app, screen locked). The creator's page calls this when that happens mid-upload:
 *   { action: "arm", requestId }  notify them in 10 minutes ("Your upload paused")
 *   { action: "disarm" }          they're back, or it finished after all: don't
 * A frozen page never disarms, so the notification goes out (api/cron/upload-nudges).
 */

const UPLOAD_NUDGE_DELAY_MS = 10 * 60 * 1000;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("arm"), requestId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("disarm") }),
]);

export async function POST(req: NextRequest) {
  const auth = await validateCreatorSession(req, { extendSession: false });
  if (!auth.success) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing." }, { status: 400 });
  const creatorId = auth.creator.id;

  if (parsed.data.action === "disarm") {
    await db.creator.update({ where: { id: creatorId }, data: { uploadNudgeAt: null, uploadNudgeRequestId: null } });
    return NextResponse.json({ armed: false });
  }

  const request = await db.contentRequest.findFirst({ where: { id: parsed.data.requestId, creatorId }, select: { id: true } });
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  await db.creator.update({
    where: { id: creatorId },
    data: { uploadNudgeAt: new Date(Date.now() + UPLOAD_NUDGE_DELAY_MS), uploadNudgeRequestId: request.id },
  });
  return NextResponse.json({ armed: true });
}
