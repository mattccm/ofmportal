import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { agencyMessagingSchema, readAgencyMessaging, type AgencyMessaging } from "@/lib/messaging";
import { loadAgencyMessaging, saveAgencyMessaging } from "@/lib/messaging-server";
import { scheduleRemindersForAgency } from "@/lib/auto-reminder-scheduler";

/** GET: the agency's creator-message defaults (src/lib/messaging.ts) */
export async function GET() {
  const gate = await requireAccess(["reminders.rules", "reminders.view"]);
  if (gate.error) return gate.error;
  const messaging = await loadAgencyMessaging(gate.access.agencyId);
  return NextResponse.json({ messaging });
}

/** PUT: save them; pending reminders are rebuilt so their channels follow */
export async function PUT(req: NextRequest) {
  const gate = await requireAccess("reminders.rules");
  if (gate.error) return gate.error;
  const { access, session } = gate;
  try {
    const body = await req.json();
    const parsed = agencyMessagingSchema.parse(body?.messaging);
    const before = await loadAgencyMessaging(access.agencyId);
    // Normalise through the reader so missing events keep their defaults
    const next: AgencyMessaging = readAgencyMessaging({ messaging: parsed });
    await saveAgencyMessaging(access.agencyId, next);

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "settings.messaging_updated",
        entityType: "Agency",
        entityId: access.agencyId,
        metadata: { before, after: next } as object,
      },
    });

    // Reminder channels are decided when reminders are scheduled: reschedule
    // pending ones so the new defaults apply to requests already sent
    const rescheduled = await scheduleRemindersForAgency(access.agencyId);
    return NextResponse.json({ messaging: next, rescheduled: rescheduled.success });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error("Failed to save messaging settings:", error);
    return NextResponse.json({ error: "Couldn't save creator message settings" }, { status: 500 });
  }
}
