import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, redactCreatorsIn, requireAccess } from "@/lib/access/server";
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
    const gate = await requireAccess("messages.creators");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;
    const agencyId = access.agencyId;

    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      select: {
        id: true,
        name: true,
        // Contact preference, time zone and last sign-in are read only when
        // the role may see them (creatorInfo.preferences / location / activity)
        preferredContact: access.has("creatorInfo.preferences"),
        timezone: access.has("creatorInfo.location"),
        lastLoginAt: access.has("creatorInfo.activity"),
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

    // Quiet hours are the creator's local hours: part of time zone and location
    const canLocation = access.has("creatorInfo.location");
    const override = canLocation
      ? await db.creatorReminderOverride.findUnique({
          where: { agencyId_creatorId: { agencyId, creatorId: id } },
          select: { quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
        })
      : null;

    const now = new Date();
    const active = creator.requests
      .filter((r) => r.status !== "APPROVED")
      .map((r) => ({ id: r.id, title: r.title, due: r.dueDate, fields: requestFields(r, now) }))
      // The most pressing first: overdue or soonest due, then undated
      .sort((a, b) => (a.due ? dueMoment(a.due).getTime() : Infinity) - (b.due ? dueMoment(b.due).getTime() : Infinity));

    // Contact preference, time zone and last sign-in only when the role can see them
    return NextResponse.json(redactCreatorsIn(access, {
      creator: {
        id: creator.id,
        name: creator.name,
        preferredContact: creator.preferredContact,
        timezone: creator.timezone,
        lastLoginAt: creator.lastLoginAt,
      },
      quiet: canLocation ? quietOf(override) : null,
      active: access.has("requests.view") ? active.map((r) => ({ ...r, due: r.due ? r.due.toISOString() : null })) : [],
      delivery: deliverySummary(finishedPoints(creator.requests)),
    }));
  } catch (error) {
    console.error("Error fetching thread details:", error);
    return NextResponse.json({ error: "Failed to load details" }, { status: 500 });
  }
}
