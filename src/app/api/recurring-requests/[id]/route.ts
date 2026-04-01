import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateNextRunDate } from "@/types/recurring-requests";

// ============================================
// VALIDATION SCHEMA
// ============================================

const updateRecurringRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  templateId: z.string().optional(),
  creatorIds: z.array(z.string()).optional(),
  creatorGroupIds: z.array(z.string()).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
  dayOfWeek: z.number().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().min(1).max(31).optional().nullable(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  maxOccurrences: z.number().min(1).optional().nullable(),
  requestSettings: z.object({
    titleTemplate: z.string().optional(),
    description: z.string().optional(),
    dueInDays: z.number().optional(),
    urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    autoSendNotification: z.boolean().optional(),
    customFields: z.record(z.string(), z.string()).optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// GET - Get single recurring request
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const recurringRequest = await db.recurringRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        executions: {
          orderBy: { scheduledFor: "desc" },
          take: 10,
        },
      },
    });

    if (!recurringRequest) {
      return NextResponse.json(
        { error: "Recurring request not found" },
        { status: 404 }
      );
    }

    // Fetch related data
    const [template, creators, groups, createdBy] = await Promise.all([
      db.requestTemplate.findUnique({
        where: { id: recurringRequest.templateId },
        select: { id: true, name: true, description: true },
      }),
      (recurringRequest.creatorIds as string[]).length > 0
        ? db.creator.findMany({
            where: { id: { in: recurringRequest.creatorIds as string[] } },
            select: { id: true, name: true, email: true },
          })
        : [],
      (recurringRequest.creatorGroupIds as string[]).length > 0
        ? db.creatorGroup.findMany({
            where: { id: { in: recurringRequest.creatorGroupIds as string[] } },
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
            },
          })
        : [],
      db.user.findUnique({
        where: { id: recurringRequest.createdById },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      ...recurringRequest,
      template,
      creators,
      creatorGroups: groups.map(g => ({ ...g, memberCount: g._count.members })),
      createdBy,
    });
  } catch (error) {
    console.error("Error fetching recurring request:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring request" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT/PATCH - Update recurring request
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateRecurringRequestSchema.parse(body);

    // Verify recurring request exists
    const existing = await db.recurringRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recurring request not found" },
        { status: 404 }
      );
    }

    // Validate template if changing
    if (validatedData.templateId && validatedData.templateId !== existing.templateId) {
      const template = await db.requestTemplate.findFirst({
        where: {
          id: validatedData.templateId,
          agencyId: session.user.agencyId,
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.templateId !== undefined) updateData.templateId = validatedData.templateId;
    if (validatedData.creatorIds !== undefined) updateData.creatorIds = validatedData.creatorIds;
    if (validatedData.creatorGroupIds !== undefined) updateData.creatorGroupIds = validatedData.creatorGroupIds;
    if (validatedData.frequency !== undefined) updateData.frequency = validatedData.frequency;
    if (validatedData.dayOfWeek !== undefined) updateData.dayOfWeek = validatedData.dayOfWeek;
    if (validatedData.dayOfMonth !== undefined) updateData.dayOfMonth = validatedData.dayOfMonth;
    if (validatedData.timeOfDay !== undefined) updateData.timeOfDay = validatedData.timeOfDay;
    if (validatedData.timezone !== undefined) updateData.timezone = validatedData.timezone;
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate !== undefined) updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    if (validatedData.maxOccurrences !== undefined) updateData.maxOccurrences = validatedData.maxOccurrences;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    // Merge request settings
    if (validatedData.requestSettings) {
      const existingSettings = existing.requestSettings as Record<string, unknown> || {};
      updateData.requestSettings = {
        ...existingSettings,
        ...validatedData.requestSettings,
      };
    }

    // Recalculate next run date if schedule changed
    if (
      validatedData.frequency !== undefined ||
      validatedData.dayOfWeek !== undefined ||
      validatedData.dayOfMonth !== undefined ||
      validatedData.timeOfDay !== undefined ||
      validatedData.isActive !== undefined
    ) {
      const frequency = validatedData.frequency || existing.frequency;
      const timeOfDay = validatedData.timeOfDay || existing.timeOfDay;
      const dayOfWeek = validatedData.dayOfWeek !== undefined ? validatedData.dayOfWeek : existing.dayOfWeek;
      const dayOfMonth = validatedData.dayOfMonth !== undefined ? validatedData.dayOfMonth : existing.dayOfMonth;
      const endDate = validatedData.endDate !== undefined
        ? (validatedData.endDate ? new Date(validatedData.endDate) : null)
        : existing.endDate;

      if (validatedData.isActive === false) {
        updateData.nextRunAt = null;
      } else {
        const [hours, minutes] = timeOfDay.split(":").map(Number);
        const nextRun = calculateNextRunDate(
          frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY",
          existing.lastRunAt || new Date(),
          dayOfWeek || undefined,
          dayOfMonth || undefined,
          endDate || undefined,
          existing.maxOccurrences || undefined,
          existing.runCount
        );

        if (nextRun) {
          nextRun.setHours(hours, minutes, 0, 0);
          updateData.nextRunAt = nextRun;
        } else {
          updateData.nextRunAt = null;
        }
      }
    }

    const updated = await db.recurringRequest.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "recurring_request.updated",
        entityType: "RecurringRequest",
        entityId: id,
        metadata: {
          name: updated.name,
          changes: Object.keys(updateData),
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating recurring request:", error);
    return NextResponse.json(
      { error: "Failed to update recurring request" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}

// ============================================
// DELETE - Delete recurring request
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify recurring request exists
    const existing = await db.recurringRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recurring request not found" },
        { status: 404 }
      );
    }

    // Delete the recurring request (executions cascade)
    await db.recurringRequest.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "recurring_request.deleted",
        entityType: "RecurringRequest",
        entityId: id,
        metadata: {
          name: existing.name,
          frequency: existing.frequency,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recurring request:", error);
    return NextResponse.json(
      { error: "Failed to delete recurring request" },
      { status: 500 }
    );
  }
}
