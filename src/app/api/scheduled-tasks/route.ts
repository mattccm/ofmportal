import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { startOfDay, endOfDay } from "date-fns";

// ============================================
// VALIDATION SCHEMA
// ============================================

const scheduledTaskSchema = z.object({
  taskType: z.enum(["CREATE_REQUEST", "APPLY_BUNDLE", "SEND_REMINDER", "SEND_BULK_EMAIL"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  scheduledFor: z.string().datetime({ message: "Invalid date format" }),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]).optional().nullable(),
  cronExpression: z.string().optional(),
  creatorIds: z.array(z.string()).optional(),
  creatorGroupIds: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  bundleId: z.string().optional(),
});

// ============================================
// GET - List scheduled tasks
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const taskType = searchParams.get("taskType");
    const upcoming = searchParams.get("upcoming") === "true";
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const dateStr = searchParams.get("date"); // YYYY-MM-DD format

    // Build query
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    if (status) {
      where.status = status;
    }

    if (taskType) {
      where.taskType = taskType;
    }

    if (upcoming) {
      where.scheduledFor = {
        gte: new Date(),
      };
    }

    if (dateStr) {
      const date = new Date(dateStr);
      where.scheduledFor = {
        gte: startOfDay(date),
        lte: endOfDay(date),
      };
    }

    const tasks = await db.scheduledTask.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    // Serialize tasks
    const serializedTasks = tasks.map((task) => ({
      id: task.id,
      agencyId: task.agencyId,
      createdById: task.createdById,
      taskType: task.taskType,
      name: task.name,
      description: task.description,
      scheduledFor: task.scheduledFor,
      recurrence: task.recurrence,
      cronExpression: task.cronExpression,
      status: task.status,
      executedAt: task.executedAt,
      error: task.error,
      resultData: task.resultData,
      creatorIds: task.creatorIds,
      creatorGroupIds: task.creatorGroupIds,
      templateId: task.templateId,
      bundleId: task.bundleId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    return NextResponse.json(serializedTasks);
  } catch (error) {
    console.error("Error fetching scheduled tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled tasks" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create scheduled task
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = scheduledTaskSchema.parse(body);

    // Validate creator(s) belong to agency
    if (validatedData.creatorIds && validatedData.creatorIds.length > 0) {
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

    // Validate template exists
    if (validatedData.templateId) {
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

    // Validate bundle exists
    if (validatedData.bundleId) {
      const bundle = await db.requestBundle.findFirst({
        where: {
          id: validatedData.bundleId,
          agencyId: session.user.agencyId,
        },
      });

      if (!bundle) {
        return NextResponse.json(
          { error: "Bundle not found" },
          { status: 404 }
        );
      }
    }

    const scheduledFor = new Date(validatedData.scheduledFor);

    // Create the scheduled task
    const task = await db.scheduledTask.create({
      data: {
        agencyId: session.user.agencyId,
        createdById: session.user.id,
        taskType: validatedData.taskType,
        name: validatedData.name,
        description: validatedData.description || null,
        scheduledFor,
        recurrence: validatedData.recurrence || null,
        cronExpression: validatedData.cronExpression || null,
        creatorIds: validatedData.creatorIds || [],
        creatorGroupIds: validatedData.creatorGroupIds || [],
        templateId: validatedData.templateId || null,
        bundleId: validatedData.bundleId || null,
        status: "PENDING",
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "scheduled_task.created",
        entityType: "ScheduledTask",
        entityId: task.id,
        metadata: {
          name: task.name,
          taskType: task.taskType,
          scheduledFor: task.scheduledFor,
        },
      },
    });

    return NextResponse.json({
      id: task.id,
      agencyId: task.agencyId,
      createdById: task.createdById,
      taskType: task.taskType,
      name: task.name,
      description: task.description,
      scheduledFor: task.scheduledFor,
      recurrence: task.recurrence,
      cronExpression: task.cronExpression,
      status: task.status,
      executedAt: task.executedAt,
      error: task.error,
      resultData: task.resultData,
      creatorIds: task.creatorIds,
      creatorGroupIds: task.creatorGroupIds,
      templateId: task.templateId,
      bundleId: task.bundleId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating scheduled task:", error);
    return NextResponse.json(
      { error: "Failed to create scheduled task" },
      { status: 500 }
    );
  }
}
