import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ACTIVE_STATUSES,
  deliverySummary,
  dueMoment,
  finishedPoints,
  quietOf,
  requestFields,
} from "@/components/creators/insights";

/**
 * GET /api/creators/[id]/thread-details
 * What the Messages details column shows beside a creator's thread: how to
 * reach them, their quiet hours, their most pressing active request (with
 * field states for a compact title card) and their on-time record.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const agencyId = session.user.agencyId;

    const creator = await db.creator.findFirst({
      where: { id, agencyId },
      select: {
        id: true,
        name: true,
        preferredContact: true,
        timezone: true,
        lastLoginAt: true,
        requests: {
          where: { status: { in: [...ACTIVE_STATUSES, "APPROVED"] } },
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            submittedAt: true,
            reviewedAt: true,
            fields: true,
            fieldSubmissions: true,
            uploads: { where: { uploadStatus: "COMPLETED" }, select: { fieldId: true, status: true } },
          },
        },
      },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const override = await db.creatorReminderOverride.findUnique({
      where: { agencyId_creatorId: { agencyId, creatorId: id } },
      select: { quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
    });

    const now = new Date();
    const active = creator.requests
      .filter((r) => r.status !== "APPROVED")
      .map((r) => ({ id: r.id, title: r.title, due: r.dueDate, fields: requestFields(r, now) }))
      // The most pressing first: overdue or soonest due, then undated
      .sort((a, b) => (a.due ? dueMoment(a.due).getTime() : Infinity) - (b.due ? dueMoment(b.due).getTime() : Infinity));

    return NextResponse.json({
      creator: {
        id: creator.id,
        name: creator.name,
        preferredContact: creator.preferredContact,
        timezone: creator.timezone,
        lastLoginAt: creator.lastLoginAt,
      },
      quiet: quietOf(override),
      active: active.map((r) => ({ ...r, due: r.due ? r.due.toISOString() : null })),
      delivery: deliverySummary(finishedPoints(creator.requests)),
    });
  } catch (error) {
    console.error("Error fetching thread details:", error);
    return NextResponse.json({ error: "Failed to load details" }, { status: 500 });
  }
}
