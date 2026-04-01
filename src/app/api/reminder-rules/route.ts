import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { scheduleRemindersForAgency } from "@/lib/auto-reminder-scheduler";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const overdueFrequencyEnum = z.enum([
  "NONE",
  "DAILY",
  "EVERY_2_DAYS",
  "EVERY_3_DAYS",
  "WEEKLY",
]);

const urgencyEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const createRuleSchema = z.object({
  urgency: urgencyEnum,
  reminderDays: z.array(z.number().int().min(0).max(30)).min(1),
  overdueReminderFrequency: overdueFrequencyEnum.default("DAILY"),
  maxOverdueReminders: z.number().int().min(0).max(20).default(5),
  smsEscalationDays: z.number().int().min(1).max(30).nullable().optional(),
  escalateToSms: z.boolean().default(false),
  isActive: z.boolean().default(true),
  name: z.string().optional(),
  description: z.string().optional(),
});

const updateRuleSchema = createRuleSchema.partial().extend({
  id: z.string(),
});

const bulkUpdateSchema = z.object({
  rules: z.array(
    z.object({
      urgency: urgencyEnum,
      reminderDays: z.array(z.number().int().min(0).max(30)).min(1),
      overdueReminderFrequency: overdueFrequencyEnum.default("DAILY"),
      maxOverdueReminders: z.number().int().min(0).max(20).default(5),
      smsEscalationDays: z.number().int().min(1).max(30).nullable().optional(),
      escalateToSms: z.boolean().default(false),
      isActive: z.boolean().default(true),
      name: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  rescheduleExisting: z.boolean().default(false),
});

// ============================================
// GET - List all reminder rules for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await db.reminderRule.findMany({
      where: {
        agencyId: session.user.agencyId,
      },
      orderBy: [
        { urgency: "asc" }, // LOW, NORMAL, HIGH, URGENT
      ],
    });

    // Also get default configurations for urgencies without rules
    const existingUrgencies = rules.map((r) => r.urgency);
    const allUrgencies = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
    const missingUrgencies = allUrgencies.filter(
      (u) => !existingUrgencies.includes(u)
    );

    return NextResponse.json({
      rules,
      missingUrgencies,
      defaults: {
        reminderDays: [3, 1, 0],
        overdueReminderFrequency: "DAILY",
        maxOverdueReminders: 5,
        smsEscalationDays: null,
        escalateToSms: false,
      },
    });
  } catch (error) {
    console.error("Error fetching reminder rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminder rules" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new reminder rule
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER or ADMIN only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createRuleSchema.parse(body);

    // Check if rule for this urgency already exists
    const existingRule = await db.reminderRule.findUnique({
      where: {
        agencyId_urgency: {
          agencyId: session.user.agencyId,
          urgency: validatedData.urgency,
        },
      },
    });

    if (existingRule) {
      return NextResponse.json(
        { error: `A rule for ${validatedData.urgency} urgency already exists` },
        { status: 400 }
      );
    }

    // Sort reminder days in descending order for consistency
    const sortedReminderDays = [...validatedData.reminderDays].sort(
      (a, b) => b - a
    );

    const rule = await db.reminderRule.create({
      data: {
        agencyId: session.user.agencyId,
        urgency: validatedData.urgency,
        reminderDays: sortedReminderDays,
        overdueReminderFrequency: validatedData.overdueReminderFrequency,
        maxOverdueReminders: validatedData.maxOverdueReminders,
        smsEscalationDays: validatedData.smsEscalationDays ?? null,
        escalateToSms: validatedData.escalateToSms,
        isActive: validatedData.isActive,
        name: validatedData.name,
        description: validatedData.description,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "reminder_rule.created",
        entityType: "ReminderRule",
        entityId: rule.id,
        metadata: {
          urgency: validatedData.urgency,
          reminderDays: sortedReminderDays,
        },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating reminder rule:", error);
    return NextResponse.json(
      { error: "Failed to create reminder rule" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update an existing rule or bulk update
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER or ADMIN only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Check if this is a bulk update
    if (body.rules && Array.isArray(body.rules)) {
      return handleBulkUpdate(session, body);
    }

    // Single rule update
    const validatedData = updateRuleSchema.parse(body);

    // Verify rule exists and belongs to agency
    const existingRule = await db.reminderRule.findFirst({
      where: {
        id: validatedData.id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: "Reminder rule not found" },
        { status: 404 }
      );
    }

    // Sort reminder days if provided
    const reminderDays = validatedData.reminderDays
      ? [...validatedData.reminderDays].sort((a, b) => b - a)
      : undefined;

    const updatedRule = await db.reminderRule.update({
      where: { id: validatedData.id },
      data: {
        ...(reminderDays && { reminderDays }),
        ...(validatedData.overdueReminderFrequency && {
          overdueReminderFrequency: validatedData.overdueReminderFrequency,
        }),
        ...(validatedData.maxOverdueReminders !== undefined && {
          maxOverdueReminders: validatedData.maxOverdueReminders,
        }),
        ...(validatedData.smsEscalationDays !== undefined && {
          smsEscalationDays: validatedData.smsEscalationDays,
        }),
        ...(validatedData.escalateToSms !== undefined && {
          escalateToSms: validatedData.escalateToSms,
        }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "reminder_rule.updated",
        entityType: "ReminderRule",
        entityId: updatedRule.id,
        metadata: {
          urgency: updatedRule.urgency,
          updatedFields: Object.keys(validatedData).filter(
            (k) => k !== "id"
          ),
        },
      },
    });

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating reminder rule:", error);
    return NextResponse.json(
      { error: "Failed to update reminder rule" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a reminder rule
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER or ADMIN only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Rule ID is required" },
        { status: 400 }
      );
    }

    // Verify rule exists and belongs to agency
    const rule = await db.reminderRule.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Reminder rule not found" },
        { status: 404 }
      );
    }

    await db.reminderRule.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "reminder_rule.deleted",
        entityType: "ReminderRule",
        entityId: id,
        metadata: {
          urgency: rule.urgency,
        },
      },
    });

    return NextResponse.json({
      message: "Reminder rule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reminder rule:", error);
    return NextResponse.json(
      { error: "Failed to delete reminder rule" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: Handle bulk update
// ============================================

async function handleBulkUpdate(
  session: { user: { id: string; agencyId: string; role: string } },
  body: unknown
) {
  const validatedData = bulkUpdateSchema.parse(body);

  const results = {
    created: 0,
    updated: 0,
    errors: [] as Array<{ urgency: string; error: string }>,
  };

  for (const ruleData of validatedData.rules) {
    try {
      const sortedReminderDays = [...ruleData.reminderDays].sort(
        (a, b) => b - a
      );

      await db.reminderRule.upsert({
        where: {
          agencyId_urgency: {
            agencyId: session.user.agencyId,
            urgency: ruleData.urgency,
          },
        },
        create: {
          agencyId: session.user.agencyId,
          urgency: ruleData.urgency,
          reminderDays: sortedReminderDays,
          overdueReminderFrequency: ruleData.overdueReminderFrequency,
          maxOverdueReminders: ruleData.maxOverdueReminders,
          smsEscalationDays: ruleData.smsEscalationDays ?? null,
          escalateToSms: ruleData.escalateToSms,
          isActive: ruleData.isActive,
          name: ruleData.name,
          description: ruleData.description,
        },
        update: {
          reminderDays: sortedReminderDays,
          overdueReminderFrequency: ruleData.overdueReminderFrequency,
          maxOverdueReminders: ruleData.maxOverdueReminders,
          smsEscalationDays: ruleData.smsEscalationDays ?? null,
          escalateToSms: ruleData.escalateToSms,
          isActive: ruleData.isActive,
          name: ruleData.name,
          description: ruleData.description,
        },
      });

      results.updated++;
    } catch (error) {
      results.errors.push({
        urgency: ruleData.urgency,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // If requested, reschedule reminders for existing requests
  let rescheduleResult = null;
  if (validatedData.rescheduleExisting) {
    rescheduleResult = await scheduleRemindersForAgency(session.user.agencyId);
  }

  // Log activity
  await db.activityLog.create({
    data: {
      userId: session.user.id,
      action: "reminder_rules.bulk_updated",
      entityType: "ReminderRule",
      entityId: "bulk",
      metadata: {
        updated: results.updated,
        errors: results.errors.length,
        rescheduleResult,
      },
    },
  });

  return NextResponse.json({
    message: `${results.updated} rules updated successfully`,
    results,
    rescheduleResult,
  });
}
