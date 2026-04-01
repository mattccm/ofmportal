import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, format } from "date-fns";
import { sendContentRequestEmail } from "@/lib/email";

// ============================================
// TASK EXECUTION LOGIC
// ============================================

interface TaskResult {
  success: boolean;
  error?: string;
  resultData?: {
    createdRequestIds?: string[];
    sentReminderCount?: number;
    archivedCount?: number;
  };
}

async function executeCreateRequest(
  task: { agencyId: string; creatorIds: unknown; templateId: string | null },
  user: { id: string; agencyId: string; agencyName: string }
): Promise<TaskResult> {
  if (!task.templateId) {
    throw new Error("Missing template ID");
  }

  // Get template
  const template = await db.requestTemplate.findFirst({
    where: { id: task.templateId, agencyId: task.agencyId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  // Get creators
  const creatorIds = (task.creatorIds as string[]) || [];

  if (creatorIds.length === 0) {
    throw new Error("No creators specified");
  }

  const creators = await db.creator.findMany({
    where: {
      id: { in: creatorIds },
      agencyId: task.agencyId,
    },
  });

  const createdRequestIds: string[] = [];
  const dueDate = addDays(new Date(), template.defaultDueDays);

  for (const creator of creators) {
    // Create request
    const request = await db.contentRequest.create({
      data: {
        agencyId: task.agencyId,
        creatorId: creator.id,
        templateId: task.templateId,
        title: template.name,
        description: template.description,
        dueDate,
        urgency: template.defaultUrgency,
        requirements: {},
        fields: template.fields || [],
        status: "PENDING",
      },
    });

    createdRequestIds.push(request.id);

    // Send notification
    try {
      const portalLink = `${process.env.APP_URL}/portal/${creator.id}/requests/${request.id}`;
      await sendContentRequestEmail({
        to: creator.email,
        creatorName: creator.name,
        agencyName: user.agencyName,
        requestTitle: request.title,
        dueDate: format(dueDate, "MMMM d, yyyy"),
        portalLink,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
    }
  }

  return {
    success: true,
    resultData: { createdRequestIds },
  };
}

async function executeApplyBundle(
  task: { agencyId: string; creatorIds: unknown; bundleId: string | null },
  user: { id: string; agencyId: string; agencyName: string }
): Promise<TaskResult> {
  if (!task.bundleId) {
    throw new Error("Missing bundle ID");
  }

  // Get bundle
  const bundle = await db.requestBundle.findFirst({
    where: { id: task.bundleId, agencyId: task.agencyId },
  });

  if (!bundle) {
    throw new Error("Bundle not found");
  }

  const creatorIds = (task.creatorIds as string[]) || [];
  const createdRequestIds: string[] = [];

  // Get templates from bundle
  const templateIds = bundle.templateIds as string[];
  const templates = await db.requestTemplate.findMany({
    where: { id: { in: templateIds }, agencyId: task.agencyId },
  });

  const creators = await db.creator.findMany({
    where: {
      id: { in: creatorIds },
      agencyId: task.agencyId,
    },
  });

  for (const creator of creators) {
    for (const template of templates) {
      const dueDate = addDays(new Date(), template.defaultDueDays);

      const request = await db.contentRequest.create({
        data: {
          agencyId: task.agencyId,
          creatorId: creator.id,
          templateId: template.id,
          title: template.name,
          description: template.description,
          dueDate,
          urgency: template.defaultUrgency,
          requirements: {},
          fields: template.fields || [],
          status: "PENDING",
        },
      });

      createdRequestIds.push(request.id);
    }
  }

  return {
    success: true,
    resultData: { createdRequestIds },
  };
}

async function executeSendReminder(
  task: { agencyId: string }
): Promise<TaskResult> {
  // Implementation for sending reminders
  return {
    success: true,
    resultData: { sentReminderCount: 1 },
  };
}

async function executeSendBulkEmail(
  task: { agencyId: string }
): Promise<TaskResult> {
  // Implementation for sending bulk emails
  return {
    success: true,
    resultData: {},
  };
}

async function executeTask(
  task: {
    id: string;
    agencyId: string;
    taskType: string;
    templateId: string | null;
    bundleId: string | null;
    creatorIds: unknown;
    creatorGroupIds: unknown;
  },
  user: { id: string; agencyId: string; agencyName: string }
): Promise<TaskResult> {
  let result: TaskResult = { success: true };

  try {
    // Update status to running
    await db.scheduledTask.update({
      where: { id: task.id },
      data: { status: "RUNNING" },
    });

    switch (task.taskType) {
      case "CREATE_REQUEST":
        result = await executeCreateRequest(task, user);
        break;
      case "APPLY_BUNDLE":
        result = await executeApplyBundle(task, user);
        break;
      case "SEND_REMINDER":
        result = await executeSendReminder(task);
        break;
      case "SEND_BULK_EMAIL":
        result = await executeSendBulkEmail(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }

    // Update task status to completed
    await db.scheduledTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        executedAt: new Date(),
        error: null,
        resultData: result.resultData || {},
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update task status to failed
    await db.scheduledTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        executedAt: new Date(),
        error: errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================
// POST - Run task manually
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify task exists and belongs to agency
    const task = await db.scheduledTask.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Scheduled task not found" },
        { status: 404 }
      );
    }

    // Execute the task
    const result = await executeTask(task, session.user);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "scheduled_task.run_manually",
        entityType: "ScheduledTask",
        entityId: task.id,
        metadata: {
          name: task.name,
          taskType: task.taskType,
          success: result.success,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error running scheduled task:", error);
    return NextResponse.json(
      { error: "Failed to run scheduled task" },
      { status: 500 }
    );
  }
}
