import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays } from "date-fns";
import {
  calculateNextRunDate,
  formatTitleTemplate,
  type RequestSettings,
} from "@/types/recurring-requests";

// ============================================
// POST - Execute recurring request manually
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

    // Get the recurring request
    const recurringRequest = await db.recurringRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!recurringRequest) {
      return NextResponse.json(
        { error: "Recurring request not found" },
        { status: 404 }
      );
    }

    // Get template
    const template = await db.requestTemplate.findFirst({
      where: {
        id: recurringRequest.templateId,
        agencyId: session.user.agencyId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Resolve all creator IDs (direct + from groups)
    const directCreatorIds = recurringRequest.creatorIds as string[];
    const groupIds = recurringRequest.creatorGroupIds as string[];

    let allCreatorIds: string[] = [...directCreatorIds];

    if (groupIds.length > 0) {
      const groupMembers = await db.creatorGroupMember.findMany({
        where: { groupId: { in: groupIds } },
        select: { creatorId: true },
      });
      const groupCreatorIds = groupMembers.map((m) => m.creatorId);
      allCreatorIds = [...new Set([...allCreatorIds, ...groupCreatorIds])];
    }

    if (allCreatorIds.length === 0) {
      return NextResponse.json(
        { error: "No creators found for this recurring request" },
        { status: 400 }
      );
    }

    // Get creators
    const creators = await db.creator.findMany({
      where: {
        id: { in: allCreatorIds },
        agencyId: session.user.agencyId,
      },
      select: { id: true, name: true, email: true },
    });

    // Create execution record
    const execution = await db.recurringRequestExecution.create({
      data: {
        recurringRequestId: id,
        scheduledFor: new Date(),
        status: "RUNNING",
        creatorCount: creators.length,
      },
    });

    const requestSettings = recurringRequest.requestSettings as unknown as RequestSettings;
    const now = new Date();
    const dueDate = addDays(now, requestSettings.dueInDays || 7);
    const createdRequestIds: string[] = [];
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Create requests for each creator
    for (const creator of creators) {
      try {
        // Format title with variables
        const title = formatTitleTemplate(
          requestSettings.titleTemplate,
          now,
          creator.name
        );

        // Create the request
        const request = await db.contentRequest.create({
          data: {
            agencyId: session.user.agencyId,
            creatorId: creator.id,
            templateId: template.id,
            title,
            description: requestSettings.description || template.description || null,
            dueDate,
            urgency: requestSettings.urgency || "NORMAL",
            status: "PENDING",
            requirements: {},
            fields: template.fields || [],
          },
        });

        createdRequestIds.push(request.id);
        successCount++;

        // Send notification if enabled
        if (requestSettings.autoSendNotification) {
          await db.notification.create({
            data: {
              userId: creator.id, // Note: This would need to be adjusted for portal users
              type: "request.created",
              title: "New Content Request",
              message: `You have a new content request: ${title}`,
              link: `/portal/requests/${request.id}`,
            },
          });
        }
      } catch (error) {
        failedCount++;
        errors.push(`Failed to create request for ${creator.name}: ${error}`);
        console.error(`Failed to create request for creator ${creator.id}:`, error);
      }
    }

    // Update execution status
    const executionStatus =
      failedCount === 0
        ? "COMPLETED"
        : successCount === 0
        ? "FAILED"
        : "PARTIAL";

    await db.recurringRequestExecution.update({
      where: { id: execution.id },
      data: {
        executedAt: new Date(),
        status: executionStatus,
        createdRequestIds,
        successCount,
        failedCount,
        error: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    // Calculate next run date
    const [hours, minutes] = recurringRequest.timeOfDay.split(":").map(Number);
    const nextRunAt = calculateNextRunDate(
      recurringRequest.frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY",
      now,
      recurringRequest.dayOfWeek || undefined,
      recurringRequest.dayOfMonth || undefined,
      recurringRequest.endDate || undefined,
      recurringRequest.maxOccurrences || undefined,
      recurringRequest.runCount + 1
    );

    if (nextRunAt) {
      nextRunAt.setHours(hours, minutes, 0, 0);
    }

    // Update recurring request
    await db.recurringRequest.update({
      where: { id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRunAt,
        runCount: { increment: 1 },
        lastError: errors.length > 0 ? errors[0] : null,
        // Deactivate if no more runs scheduled
        isActive: nextRunAt !== null,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "recurring_request.executed",
        entityType: "RecurringRequest",
        entityId: id,
        metadata: {
          name: recurringRequest.name,
          creatorCount: creators.length,
          successCount,
          failedCount,
          requestIds: createdRequestIds,
        },
      },
    });

    return NextResponse.json({
      success: executionStatus !== "FAILED",
      executionId: execution.id,
      status: executionStatus,
      createdRequestIds,
      creatorCount: creators.length,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      nextRunAt,
    });
  } catch (error) {
    console.error("Error executing recurring request:", error);
    return NextResponse.json(
      { error: "Failed to execute recurring request" },
      { status: 500 }
    );
  }
}
