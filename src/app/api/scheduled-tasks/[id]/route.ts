import { NextRequest, NextResponse } from "next/server";
import { creatorWhere, forbidden, requireAccess } from "@/lib/access/server";
import { creatorGroupWhere, targetsInScope } from "../../recurring-requests/scope";
import { db } from "@/lib/db";
import { z } from "zod";

// VALIDATION SCHEMA

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  scheduledFor: z.string().datetime().optional(),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]).optional().nullable(),
  cronExpression: z.string().optional().nullable(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  creatorIds: z.array(z.string()).optional(),
  creatorGroupIds: z.array(z.string()).optional(),
  templateId: z.string().optional().nullable(),
  bundleId: z.string().optional().nullable(),
});

// GET - Get single task

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("recurring.view");
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    const task = await db.scheduledTask.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!task || !(await targetsInScope(access, task))) {
      return NextResponse.json(
        { error: "Scheduled task not found" },
        { status: 404 }
      );
    }

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
    });
  } catch (error) {
    console.error("Error fetching scheduled task:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled task" },
      { status: 500 }
    );
  }
}

// PUT - Update task

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(["recurring.edit", "recurring.pause"]);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateTaskSchema.parse(body);

    // Verify task exists and belongs to agency
    const existingTask = await db.scheduledTask.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingTask || !(await targetsInScope(access, existingTask))) {
      return NextResponse.json(
        { error: "Scheduled task not found" },
        { status: 404 }
      );
    }

    // Cancelling or re-opening a task is pausing; every other change needs edit
    const { status: nextStatus, ...rest } = validatedData;
    const pauses = nextStatus !== undefined && nextStatus !== existingTask.status;
    const edits = Object.values(rest).some((v) => v !== undefined);
    if (pauses && !access.has("recurring.pause")) return forbidden("recurring.pause");
    if (edits && !access.has("recurring.edit")) return forbidden("recurring.edit");

    if (validatedData.creatorIds?.length) {
      const n = await db.creator.count({
        where: { AND: [creatorWhere(access), { id: { in: validatedData.creatorIds } }] },
      });
      if (n !== new Set(validatedData.creatorIds).size) {
        return NextResponse.json({ error: "One or more creators not found" }, { status: 404 });
      }
    }
    if (validatedData.creatorGroupIds?.length) {
      const n = await db.creatorGroup.count({
        where: { AND: [creatorGroupWhere(access), { id: { in: validatedData.creatorGroupIds } }] },
      });
      if (n !== new Set(validatedData.creatorGroupIds).size) {
        return NextResponse.json({ error: "One or more creator groups not found" }, { status: 404 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.scheduledFor !== undefined) {
      updateData.scheduledFor = new Date(validatedData.scheduledFor);
    }

    if (validatedData.recurrence !== undefined) {
      updateData.recurrence = validatedData.recurrence;
    }

    if (validatedData.cronExpression !== undefined) {
      updateData.cronExpression = validatedData.cronExpression;
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    if (validatedData.creatorIds !== undefined) {
      updateData.creatorIds = validatedData.creatorIds;
    }

    if (validatedData.creatorGroupIds !== undefined) {
      updateData.creatorGroupIds = validatedData.creatorGroupIds;
    }

    if (validatedData.templateId !== undefined) {
      updateData.templateId = validatedData.templateId;
    }

    if (validatedData.bundleId !== undefined) {
      updateData.bundleId = validatedData.bundleId;
    }

    const task = await db.scheduledTask.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "scheduled_task.updated",
        entityType: "ScheduledTask",
        entityId: task.id,
        metadata: {
          name: task.name,
          changes: Object.keys(updateData),
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating scheduled task:", error);
    return NextResponse.json(
      { error: "Failed to update scheduled task" },
      { status: 500 }
    );
  }
}

// PATCH - Partial update (status changes, etc.)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}

// DELETE - Delete task

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("recurring.delete");
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    // Verify task exists and belongs to agency
    const task = await db.scheduledTask.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!task || !(await targetsInScope(access, task))) {
      return NextResponse.json(
        { error: "Scheduled task not found" },
        { status: 404 }
      );
    }

    // Delete the task
    await db.scheduledTask.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "scheduled_task.deleted",
        entityType: "ScheduledTask",
        entityId: id,
        metadata: {
          name: task.name,
          taskType: task.taskType,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduled task:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled task" },
      { status: 500 }
    );
  }
}
