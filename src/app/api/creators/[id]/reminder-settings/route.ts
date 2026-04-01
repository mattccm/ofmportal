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

const updateOverrideSchema = z.object({
  useCustomSettings: z.boolean().default(true),
  reminderDays: z.array(z.number().int().min(0).max(30)).min(1).optional(),
  overdueReminderFrequency: overdueFrequencyEnum.optional(),
  maxOverdueReminders: z.number().int().min(0).max(20).optional(),
  smsEscalationDays: z.number().int().min(1).max(30).nullable().optional(),
  escalateToSms: z.boolean().optional(),
  disableReminders: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  rescheduleExisting: z.boolean().default(false),
});

// ============================================
// GET - Get creator's reminder settings
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
        preferredContact: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Get existing override if any
    const override = await db.creatorReminderOverride.findUnique({
      where: {
        agencyId_creatorId: {
          agencyId: session.user.agencyId,
          creatorId,
        },
      },
    });

    // Get agency's reminder rules for context
    const agencyRules = await db.reminderRule.findMany({
      where: {
        agencyId: session.user.agencyId,
        isActive: true,
      },
      select: {
        urgency: true,
        reminderDays: true,
        overdueReminderFrequency: true,
        maxOverdueReminders: true,
        smsEscalationDays: true,
        escalateToSms: true,
      },
    });

    // Get count of pending requests for this creator
    const pendingRequestsCount = await db.contentRequest.count({
      where: {
        agencyId: session.user.agencyId,
        creatorId,
        status: { in: ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"] },
        dueDate: { not: null },
      },
    });

    return NextResponse.json({
      creator: {
        id: creator.id,
        name: creator.name,
        preferredContact: creator.preferredContact,
      },
      override: override || null,
      hasCustomSettings: !!override?.useCustomSettings,
      agencyRules,
      pendingRequestsCount,
      defaults: {
        reminderDays: [3, 1, 0],
        overdueReminderFrequency: "DAILY",
        maxOverdueReminders: 5,
        smsEscalationDays: null,
        escalateToSms: false,
        disableReminders: false,
      },
    });
  } catch (error) {
    console.error("Error fetching creator reminder settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminder settings" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create or update creator's reminder override
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER, ADMIN, or MANAGER)
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validatedData = updateOverrideSchema.parse(body);

    // Sort reminder days if provided
    const reminderDays = validatedData.reminderDays
      ? [...validatedData.reminderDays].sort((a, b) => b - a)
      : [3, 1, 0];

    // Upsert the override
    const override = await db.creatorReminderOverride.upsert({
      where: {
        agencyId_creatorId: {
          agencyId: session.user.agencyId,
          creatorId,
        },
      },
      create: {
        agencyId: session.user.agencyId,
        creatorId,
        useCustomSettings: validatedData.useCustomSettings,
        reminderDays,
        overdueReminderFrequency:
          validatedData.overdueReminderFrequency || "DAILY",
        maxOverdueReminders: validatedData.maxOverdueReminders ?? 5,
        smsEscalationDays: validatedData.smsEscalationDays ?? null,
        escalateToSms: validatedData.escalateToSms ?? false,
        disableReminders: validatedData.disableReminders ?? false,
        notes: validatedData.notes ?? null,
      },
      update: {
        useCustomSettings: validatedData.useCustomSettings,
        ...(validatedData.reminderDays && { reminderDays }),
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
        ...(validatedData.disableReminders !== undefined && {
          disableReminders: validatedData.disableReminders,
        }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      },
    });

    // If requested, reschedule reminders for this creator's pending requests
    let rescheduleResult = null;
    if (validatedData.rescheduleExisting) {
      rescheduleResult = await scheduleRemindersForAgency(
        session.user.agencyId,
        { creatorId }
      );
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator_reminder_override.updated",
        entityType: "CreatorReminderOverride",
        entityId: override.id,
        metadata: {
          creatorId,
          creatorName: creator.name,
          useCustomSettings: validatedData.useCustomSettings,
          disableReminders: validatedData.disableReminders,
          rescheduleResult,
        },
      },
    });

    return NextResponse.json({
      override,
      rescheduleResult,
      message: "Reminder settings updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating creator reminder settings:", error);
    return NextResponse.json(
      { error: "Failed to update reminder settings" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Alias for POST (update)
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}

// ============================================
// DELETE - Remove creator's custom settings (revert to agency defaults)
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER, ADMIN, or MANAGER)
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Check if override exists
    const override = await db.creatorReminderOverride.findUnique({
      where: {
        agencyId_creatorId: {
          agencyId: session.user.agencyId,
          creatorId,
        },
      },
    });

    if (!override) {
      return NextResponse.json(
        { error: "No custom reminder settings found for this creator" },
        { status: 404 }
      );
    }

    // Delete the override
    await db.creatorReminderOverride.delete({
      where: {
        agencyId_creatorId: {
          agencyId: session.user.agencyId,
          creatorId,
        },
      },
    });

    // Optionally reschedule reminders
    const { searchParams } = new URL(req.url);
    const reschedule = searchParams.get("reschedule") === "true";

    let rescheduleResult = null;
    if (reschedule) {
      rescheduleResult = await scheduleRemindersForAgency(
        session.user.agencyId,
        { creatorId }
      );
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator_reminder_override.deleted",
        entityType: "CreatorReminderOverride",
        entityId: override.id,
        metadata: {
          creatorId,
          creatorName: creator.name,
          rescheduleResult,
        },
      },
    });

    return NextResponse.json({
      message: "Custom reminder settings removed. Creator will now use agency defaults.",
      rescheduleResult,
    });
  } catch (error) {
    console.error("Error deleting creator reminder override:", error);
    return NextResponse.json(
      { error: "Failed to delete reminder settings" },
      { status: 500 }
    );
  }
}
