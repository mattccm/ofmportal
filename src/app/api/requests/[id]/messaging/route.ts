import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import {
  MESSAGE_EVENTS,
  applyConsent,
  describeSteps,
  eventChannels,
  isEmptyPlan,
  messagingPlanSchema,
  readPlan,
  type MessagingPlan,
} from "@/lib/messaging";
import { loadSchedule } from "@/lib/messaging-server";
import { rescheduleReminders } from "@/lib/auto-reminder-scheduler";

const ACTIVE = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];

async function load(id: string, access: Parameters<typeof requestWhere>[0]) {
  return db.contentRequest.findFirst({
    where: { AND: [requestWhere(access), { id }] },
    select: {
      id: true,
      agencyId: true,
      creatorId: true,
      status: true,
      urgency: true,
      dueDate: true,
      messaging: true,
      template: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, phone: true, preferredContact: true } },
    },
  });
}

/** What this request's reminders and messages do, and where that comes from */
async function describe(request: NonNullable<Awaited<ReturnType<typeof load>>>, seePrefs: boolean) {
  const { schedule, agency } = await loadSchedule({
    agencyId: request.agencyId,
    creatorId: request.creatorId,
    creator: request.creator,
    urgency: request.urgency,
    request: { messaging: request.messaging },
  });
  const plan = readPlan(request.messaging);
  const events = MESSAGE_EVENTS.filter((e) => e.kind === "once").map((e) => {
    const { choice, source } = eventChannels(e.id, { agency, request: { messaging: request.messaging } });
    // What this creator gets, only for people who may see contact preferences
    const out = seePrefs ? applyConsent(choice, request.creator, agency) : null;
    return { id: e.id, label: e.label, choice, source, creatorGets: out ? { email: out.email, sms: out.sms, note: out.note } : null };
  });
  const pending = await db.reminder.findMany({
    where: { requestId: request.id, status: "PENDING" },
    orderBy: { scheduledAt: "asc" },
    select: { id: true, scheduledAt: true, type: true, channel: true, isEscalation: true },
    take: 40,
  });
  return {
    plan,
    source: schedule.source,
    sourceLabel: schedule.sourceLabel,
    disabled: schedule.disabled,
    summary: schedule.disabled ? "Reminders are off for this creator" : describeSteps(schedule.steps),
    escalation: schedule.escalation,
    events,
    templateName: request.template?.name ?? null,
    respectPreference: agency.respectPreference,
    // Channels of pending reminders tell someone without creatorInfo.preferences
    // how the creator likes to be contacted; they see times only
    pending: pending.map((r) => (seePrefs ? r : { ...r, channel: null })),
  };
}

/** GET: the resolved plan for this request */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAccess("requests.view");
  if (gate.error) return gate.error;
  const { id } = await params;
  const request = await load(id, gate.access);
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  return NextResponse.json(await describe(request, gate.access.has("creatorInfo.preferences")));
}

const putSchema = z.object({ messaging: messagingPlanSchema.nullable() });

/** PUT: change this request's plan; its pending reminders are rebuilt */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAccess("reminders.edit");
  if (gate.error) return gate.error;
  const { access, session } = gate;
  const { id } = await params;
  const request = await load(id, access);
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  try {
    const { messaging } = putSchema.parse(await req.json());
    const plan = messaging as MessagingPlan | null;
    const value: Prisma.InputJsonValue | typeof Prisma.DbNull = isEmptyPlan(plan)
      ? Prisma.DbNull
      : ({ v: 1, events: plan!.events, schedule: plan!.schedule, origin: { kind: "request" } } as Prisma.InputJsonValue);
    const updated = await db.contentRequest.update({
      where: { id },
      data: { messaging: value },
      select: { messaging: true },
    });

    let rescheduled = 0;
    if (request.dueDate && ACTIVE.includes(request.status)) {
      rescheduled = (await rescheduleReminders(id)).remindersCreated;
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.messaging_updated",
        entityType: "ContentRequest",
        entityId: id,
        metadata: { before: request.messaging ?? null, after: updated.messaging ?? null, rescheduled } as object,
      },
    });

    return NextResponse.json({ ...(await describe({ ...request, messaging: updated.messaging }, access.has("creatorInfo.preferences"))), rescheduled });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error("Failed to update request messaging:", error);
    return NextResponse.json({ error: "Couldn't save this request's reminders" }, { status: 500 });
  }
}
