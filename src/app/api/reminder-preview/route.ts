import { NextRequest, NextResponse } from "next/server";
import { canSeeCreator, requireAccess } from "@/lib/access/server";
import { z } from "zod";
import { previewScheduleForNewRequest } from "@/lib/auto-reminder-scheduler";
import { format } from "date-fns";

// VALIDATION SCHEMA

const previewSchema = z.object({
  creatorId: z.string().min(1),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  dueDate: z.string().min(1),
});

// POST - Preview reminder schedule for a new request

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(["requests.create", "reminders.view"]);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const body = await req.json();
    const { creatorId, urgency, dueDate } = previewSchema.parse(body);

    if (!(await canSeeCreator(access, creatorId))) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
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
      parsedDueDate
    );

    // Format for display
    const formattedReminders = preview.reminders.map((r) => ({
      ...r,
      formattedDate: format(r.scheduledAt, "MMM d, yyyy"),
      formattedTime: format(r.scheduledAt, "h:mm a"),
      label:
        r.daysFromDue === 0
          ? "Due date"
          : r.daysFromDue < 0
          ? `${Math.abs(r.daysFromDue)} day${Math.abs(r.daysFromDue) > 1 ? "s" : ""} before`
          : `${r.daysFromDue} day${r.daysFromDue > 1 ? "s" : ""} overdue`,
    }));

    return NextResponse.json({
      reminders: formattedReminders,
      count: preview.reminders.length,
      config: preview.config,
      summary: preview.reminders.length > 0
        ? `${preview.reminders.length} reminder${preview.reminders.length > 1 ? "s" : ""} will be scheduled`
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
