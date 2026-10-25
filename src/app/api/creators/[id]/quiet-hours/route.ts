import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess } from "@/lib/access/server";
import { quietOf } from "@/components/creators/insights";

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const schema = z.object({
  enabled: z.boolean(),
  start: HHMM,
  end: HHMM,
});

/**
 * PUT /api/creators/[id]/quiet-hours
 * Sets the hours (in the creator's own time zone) when reminders hold back.
 * The reminder scheduler reads these from CreatorReminderOverride. Creating
 * the override here never switches the creator onto a custom schedule.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAccess("creators.pauseReminders");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id: creatorId } = await params;
    const agencyId = session.user.agencyId;

    const creator = await db.creator.findFirst({ where: { AND: [creatorWhere(access), { id: creatorId }] }, select: { id: true } });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid quiet hours" }, { status: 400 });
    }
    const { enabled, start, end } = parsed.data;

    const override = await db.creatorReminderOverride.upsert({
      where: { agencyId_creatorId: { agencyId, creatorId } },
      create: {
        agencyId,
        creatorId,
        useCustomSettings: false,
        quietHoursEnabled: enabled,
        quietHoursStart: start,
        quietHoursEnd: end,
      },
      update: { quietHoursEnabled: enabled, quietHoursStart: start, quietHoursEnd: end },
      select: { quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
    });

    return NextResponse.json({ quiet: quietOf(override) });
  } catch (error) {
    console.error("Error saving quiet hours:", error);
    return NextResponse.json({ error: "Failed to save quiet hours" }, { status: 500 });
  }
}
