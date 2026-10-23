import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import {
  executeRecurringRequest,
  computeNextRunAt,
} from "@/app/api/recurring-requests/execute";

/**
 * Cron: Run recurring requests whose nextRunAt has passed
 *
 * Configured in vercel.json to run every 15 minutes. Each due row is claimed
 * by advancing nextRunAt with a conditional update, so overlapping runs can't
 * execute the same occurrence twice.
 */

export const maxDuration = 60;

const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = { due: 0, executed: 0, skipped: 0, failed: 0, errors: [] as string[] };

    const dueRows = await db.recurringRequest.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: "asc" },
      take: BATCH_SIZE,
    });

    results.due = dueRows.length;

    for (const row of dueRows) {
      try {
        // Claim this occurrence: only one run can move nextRunAt off its old value
        const claim = await db.recurringRequest.updateMany({
          where: { id: row.id, nextRunAt: row.nextRunAt, isActive: true },
          data: { nextRunAt: computeNextRunAt(row, now, row.runCount + 1) },
        });

        if (claim.count !== 1) {
          results.skipped++;
          continue;
        }

        const result = await executeRecurringRequest(row.id, row.agencyId, {
          actorUserId: null, // System run; createdById may no longer exist
        });

        if (result.status === 200) {
          results.executed++;
        } else {
          // e.g. template deleted or no creators left: record why and move on
          results.failed++;
          const message = String(result.body.error ?? "Execution failed");
          results.errors.push(`${row.id}: ${message}`);
          await db.recurringRequest.update({
            where: { id: row.id },
            data: { lastError: message },
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${row.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        console.error(`Failed to run recurring request ${row.id}:`, error);
      }
    }

    return NextResponse.json({
      message: "Recurring requests processed",
      ...results,
    });
  } catch (error) {
    console.error("Recurring requests cron error:", error);
    return NextResponse.json(
      { error: "Failed to process recurring requests" },
      { status: 500 }
    );
  }
}
