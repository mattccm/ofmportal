import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { calculateNextRunDate } from "@/types/recurring-requests";

// ============================================
// VALIDATION SCHEMA
// ============================================

const requestSettingsSchema = z.object({
  titleTemplate: z.string().min(1, "Title template is required"),
  description: z.string().optional(),
  dueInDays: z.number().min(1).max(365),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  autoSendNotification: z.boolean(),
  customFields: z.record(z.string(), z.string()).optional(),
});

const createRecurringRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  templateId: z.string().min(1, "Template is required"),
  creatorIds: z.array(z.string()).optional().default([]),
  creatorGroupIds: z.array(z.string()).optional().default([]),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format").default("09:00"),
  timezone: z.string().default("America/New_York"),
  startDate: z.string().datetime({ message: "Invalid start date" }),
  endDate: z.string().datetime().optional(),
  maxOccurrences: z.number().min(1).optional(),
  requestSettings: requestSettingsSchema,
});

// ============================================
// GET - List recurring requests
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get("active");
    const frequency = searchParams.get("frequency");
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;

    // Build query
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (frequency) {
      where.frequency = frequency;
    }

    const recurringRequests = await db.recurringRequest.findMany({
      where,
      orderBy: [
        { isActive: "desc" },
        { nextRunAt: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    // Fetch related data
    const templateIds = [...new Set(recurringRequests.map(r => r.templateId))];
    const allCreatorIds = [...new Set(recurringRequests.flatMap(r => r.creatorIds as string[]))];
    const allGroupIds = [...new Set(recurringRequests.flatMap(r => r.creatorGroupIds as string[]))];

    const [templates, creators, groups] = await Promise.all([
      db.requestTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true, description: true },
      }),
      allCreatorIds.length > 0
        ? db.creator.findMany({
            where: { id: { in: allCreatorIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
      allGroupIds.length > 0
        ? db.creatorGroup.findMany({
            where: { id: { in: allGroupIds } },
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
            },
          })
        : [],
    ]);

    // Map related data
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const creatorMap = new Map(creators.map(c => [c.id, c]));
    const groupMap = new Map(groups.map(g => [g.id, { ...g, memberCount: g._count.members }]));

    // Serialize response
    const serialized = recurringRequests.map(rr => ({
      id: rr.id,
      agencyId: rr.agencyId,
      name: rr.name,
      description: rr.description,
      templateId: rr.templateId,
      template: templateMap.get(rr.templateId),
      creatorIds: rr.creatorIds,
      creatorGroupIds: rr.creatorGroupIds,
      creators: (rr.creatorIds as string[]).map(id => creatorMap.get(id)).filter(Boolean),
      creatorGroups: (rr.creatorGroupIds as string[]).map(id => groupMap.get(id)).filter(Boolean),
      frequency: rr.frequency,
      dayOfWeek: rr.dayOfWeek,
      dayOfMonth: rr.dayOfMonth,
      timeOfDay: rr.timeOfDay,
      timezone: rr.timezone,
      startDate: rr.startDate,
      endDate: rr.endDate,
      maxOccurrences: rr.maxOccurrences,
      requestSettings: rr.requestSettings,
      isActive: rr.isActive,
      lastRunAt: rr.lastRunAt,
      nextRunAt: rr.nextRunAt,
      runCount: rr.runCount,
      lastError: rr.lastError,
      createdById: rr.createdById,
      createdAt: rr.createdAt,
      updatedAt: rr.updatedAt,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching recurring requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring requests" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create recurring request
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createRecurringRequestSchema.parse(body);

    // Validate template exists
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

    // Validate creators
    if (validatedData.creatorIds.length > 0) {
      const creators = await db.creator.findMany({
        where: {
          id: { in: validatedData.creatorIds },
          agencyId: session.user.agencyId,
        },
      });

      if (creators.length !== validatedData.creatorIds.length) {
        return NextResponse.json(
          { error: "One or more creators not found" },
          { status: 404 }
        );
      }
    }

    // Validate creator groups
    if (validatedData.creatorGroupIds.length > 0) {
      const groups = await db.creatorGroup.findMany({
        where: {
          id: { in: validatedData.creatorGroupIds },
          agencyId: session.user.agencyId,
        },
      });

      if (groups.length !== validatedData.creatorGroupIds.length) {
        return NextResponse.json(
          { error: "One or more creator groups not found" },
          { status: 404 }
        );
      }
    }

    // Must have at least one creator or group
    if (validatedData.creatorIds.length === 0 && validatedData.creatorGroupIds.length === 0) {
      return NextResponse.json(
        { error: "At least one creator or creator group is required" },
        { status: 400 }
      );
    }

    const startDate = new Date(validatedData.startDate);
    const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;

    // Calculate initial next run date
    const [hours, minutes] = validatedData.timeOfDay.split(":").map(Number);
    const initialNextRun = new Date(startDate);
    initialNextRun.setHours(hours, minutes, 0, 0);

    // If start date is in the past, calculate next valid run date
    let nextRunAt = initialNextRun;
    if (initialNextRun < new Date()) {
      const calculated = calculateNextRunDate(
        validatedData.frequency,
        new Date(),
        validatedData.dayOfWeek,
        validatedData.dayOfMonth,
        endDate || undefined
      );
      nextRunAt = calculated || initialNextRun;
      if (nextRunAt) {
        nextRunAt.setHours(hours, minutes, 0, 0);
      }
    }

    // Create the recurring request
    const recurringRequest = await db.recurringRequest.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        templateId: validatedData.templateId,
        creatorIds: validatedData.creatorIds,
        creatorGroupIds: validatedData.creatorGroupIds,
        frequency: validatedData.frequency,
        dayOfWeek: validatedData.dayOfWeek ?? null,
        dayOfMonth: validatedData.dayOfMonth ?? null,
        timeOfDay: validatedData.timeOfDay,
        timezone: validatedData.timezone,
        startDate,
        endDate,
        maxOccurrences: validatedData.maxOccurrences ?? null,
        requestSettings: validatedData.requestSettings as object,
        isActive: true,
        nextRunAt,
        createdById: session.user.id,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "recurring_request.created",
        entityType: "RecurringRequest",
        entityId: recurringRequest.id,
        metadata: {
          name: recurringRequest.name,
          frequency: recurringRequest.frequency,
          templateId: recurringRequest.templateId,
        },
      },
    });

    return NextResponse.json(recurringRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating recurring request:", error);
    return NextResponse.json(
      { error: "Failed to create recurring request" },
      { status: 500 }
    );
  }
}
