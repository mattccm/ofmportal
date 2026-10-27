import { NextRequest, NextResponse } from "next/server";
import { canSeeCreator, requireAccess } from "@/lib/access/server";
import { z } from "zod";
import { previewScheduleForNewRequest } from "@/lib/auto-reminder-scheduler";
import { dayFromInput } from "@/lib/due";
import { staffTimeZone } from "@/lib/due-server";
import { messagingPlanSchema } from "@/lib/messaging";

// VALIDATION SCHEMA

const previewSchema = z.object({
  creatorId: z.string().min(1),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  dueDate: z.string().min(1),
  // The plan the request would get: its template's, or one set in the composer
  templateId: z.string().optional(),
  messaging: messagingPlanSchema.nullable().optional(),
});

// POST - Preview reminder schedule for a new request

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(["requests.create", "reminders.view"]);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const body = await req.json();
    const { creatorId, urgency, dueDate, templateId, messaging } = previewSchema.parse(body);

    if (!(await canSeeCreator(access, creatorId))) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // The picked calendar day; the schedule runs in the creator's calendar
    const dueOn = dayFromInput(dueDate, await staffTimeZone(session.user.id));
    const parsedDueDate = new Date(dueDate);
    if (!dueOn) {
      return NextResponse.json(
        { error: "Invalid due date" },
        { status: 400 }
      );
    }

    // Get preview
    const preview = await previewScheduleForNewRequest(
      session.user.agencyId,
      creatorId,
      urgency,
      parsedDueDate,
      dueOn,
      { templateId, messaging }
    );
    const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: preview.timezone, month: "short", day: "numeric", year: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: preview.timezone, hour: "numeric", minute: "2-digit" });

    // Format for display
    const formattedReminders = preview.reminders.map((r) => ({
      ...r,
      formattedDate: dateFmt.format(r.scheduledAt),
      formattedTime: timeFmt.format(r.scheduledAt),
      label:
        r.daysFromDue === 0
          ? "Due date"
          : r.daysFromDue < 0
          ? `${Math.abs(r.daysFromDue)} day${Math.abs(r.daysFromDue) > 1 ? "s" : ""} before`
          : `${r.daysFromDue} day${r.daysFromDue > 1 ? "s" : ""} overdue`,
    }));

    // One row per channel: a step sent by email and text is one reminder
    const sends = new Set(preview.reminders.map((r) => r.scheduledAt.getTime())).size;
    const texts = preview.reminders.filter((r) => r.channel === "SMS").length;
    return NextResponse.json({
      reminders: formattedReminders,
      count: preview.reminders.length,
      config: preview.config,
      summary: sends > 0
        ? `${sends} reminder${sends > 1 ? "s" : ""} will be scheduled${texts ? `, ${texts} by text` : ""}`
        : "No reminders will be scheduled",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error previewing reminder schedule:", error);
    return NextResponse.json(
      { error: "Failed to preview reminder schedule" },
      { status: 500 }
    );
  }
}
