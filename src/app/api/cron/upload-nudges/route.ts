import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runCron } from "@/lib/cron";
import { pushUploadPaused } from "@/lib/push";

/**
 * Cron: "Your upload paused. Open CCM to finish it."
 *
 * Runs every 5 minutes. Sends one notification to each creator whose upload
 * stopped when their phone put the portal in the background and who hasn't
 * come back (armed by api/portal/upload-nudge). At most one every 30 minutes
 * per creator, and none for a request that's finished or cancelled. Only phones
 * with notifications on get it: texts cost money and email is too slow for this.
 */

const QUIET_MS = 30 * 60 * 1000;
const OPEN = ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"] as const;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCron("upload-nudges", async () => {
    const now = new Date();
    const due = await db.creator.findMany({
      where: { uploadNudgeAt: { lte: now } },
      select: { id: true, uploadNudgeAt: true, uploadNudgeRequestId: true, uploadNudgeSentAt: true, archivedAt: true },
      take: 200,
    });

    let sent = 0;
    let skipped = 0;
    for (const c of due) {
      // Claim it first, so a second run never sends the same one
      const claimed = await db.creator.updateMany({
        where: { id: c.id, uploadNudgeAt: c.uploadNudgeAt },
        data: { uploadNudgeAt: null, uploadNudgeRequestId: null },
      });
      if (!claimed.count || !c.uploadNudgeRequestId || c.archivedAt) {
        skipped++;
        continue;
      }
      if (c.uploadNudgeSentAt && now.getTime() - c.uploadNudgeSentAt.getTime() < QUIET_MS) {
        skipped++;
        continue;
      }
      const request = await db.contentRequest.findFirst({
        where: { id: c.uploadNudgeRequestId, creatorId: c.id, status: { in: [...OPEN] } },
        select: { id: true },
      });
      if (!request) {
        skipped++;
        continue;
      }
      const result = await pushUploadPaused(c.id, request.id);
      if (result.sent > 0) {
        sent++;
        await db.creator.update({ where: { id: c.id }, data: { uploadNudgeSentAt: now } });
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ due: due.length, sent, skipped });
  }, { errorMessage: "Failed to send upload nudges" });
}
