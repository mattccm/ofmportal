import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { verifyCronAuth } from "@/lib/cron-auth";

/**
 * Cron: Automated cleanup of orphaned data
 *
 * Runs daily to:
 * 1. Clean up orphaned uploads (PENDING > 24 hours)
 * 2. Remove expired sessions
 * 3. Clean up expired remember tokens
 * 4. Purge old activity logs (> 90 days)
 * 5. Clean up failed/stale email queue items
 *
 * Add to vercel.json:
 * { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
 */

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    orphanedUploads: 0,
    expiredSessions: 0,
    expiredTokens: 0,
    oldActivityLogs: 0,
    staleEmailQueue: 0,
    storageCleanupErrors: [] as string[],
  };

  try {
    // 1. Clean up orphaned uploads (PENDING status older than 24 hours)
    const orphanCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphanedUploads = await db.upload.findMany({
      where: {
        uploadStatus: "PENDING",
        createdAt: { lt: orphanCutoff },
      },
      select: { id: true, storageKey: true },
      take: 200, // Bounded per run; the rest is picked up next run
    });

    // Only delete DB rows whose storage object was deleted (or never existed)
    const deletableIds: string[] = [];
    for (const upload of orphanedUploads) {
      try {
        if (upload.storageKey) {
          await deleteFile(upload.storageKey);
        }
        deletableIds.push(upload.id);
      } catch (error) {
        results.storageCleanupErrors.push(
          `Failed to delete storage: ${upload.storageKey}: ${error}`
        );
      }
    }

    if (deletableIds.length > 0) {
      await db.upload.deleteMany({
        where: {
          id: { in: deletableIds },
        },
      });
      results.orphanedUploads = deletableIds.length;
    }

    // 2. Remove expired sessions
    const expiredSessions = await db.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    results.expiredSessions = expiredSessions.count;

    // 3. Clean up expired remember tokens
    const expiredTokens = await db.rememberToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    results.expiredTokens = expiredTokens.count;

    // 4. Purge old activity logs (older than 90 days)
    const logCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oldLogs = await db.activityLog.deleteMany({
      where: {
        createdAt: { lt: logCutoff },
      },
    });
    results.oldActivityLogs = oldLogs.count;

    // 5. Clean up stale email queue items (PENDING/SENDING > 7 days;
    // SENDING covers claims orphaned by a crashed email-queue run)
    const emailCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleEmails = await db.emailQueueItem.updateMany({
      where: {
        status: { in: ["PENDING", "SENDING"] },
        createdAt: { lt: emailCutoff },
      },
      data: {
        status: "FAILED",
        error: "Expired - not sent within 7 days",
      },
    });
    results.staleEmailQueue = staleEmails.count;

    console.log("[Cleanup Cron] Results:", results);

    return NextResponse.json({
      message: "Cleanup completed successfully",
      ...results,
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Failed to run cleanup" },
      { status: 500 }
    );
  }
}
