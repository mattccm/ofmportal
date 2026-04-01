import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { format } from "date-fns";
import { invalidateCache } from "@/lib/cache";

const bulkActionSchema = z.object({
  action: z.enum([
    "archive",
    "delete",
    "sendReminders",
    "changePriority",
    "assignCreator",
    "changeStatus",
  ]),
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
  // Optional fields for specific actions
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  creatorId: z.string().optional(),
  status: z.enum([
    "DRAFT",
    "PENDING",
    "IN_PROGRESS",
    "SUBMITTED",
    "UNDER_REVIEW",
    "NEEDS_REVISION",
    "APPROVED",
    "CANCELLED",
    "ARCHIVED",
  ]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkActionSchema.parse(body);

    // Verify all requests belong to this agency
    const requests = await db.contentRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        agencyId: session.user.agencyId,
      },
      include: {
        creator: true,
      },
    });

    if (requests.length !== validatedData.requestIds.length) {
      return NextResponse.json(
        { error: "Some requests not found or unauthorized" },
        { status: 404 }
      );
    }

    let result: { success: boolean; affected: number; errors?: string[] } = {
      success: true,
      affected: 0,
    };

    switch (validatedData.action) {
      case "archive": {
        // Use transaction for atomicity and batch activity logs
        const updated = await db.$transaction(async (tx) => {
          const updateResult = await tx.contentRequest.updateMany({
            where: {
              id: { in: validatedData.requestIds },
              agencyId: session.user.agencyId,
            },
            data: {
              status: "ARCHIVED",
            },
          });

          // Batch create activity logs (more efficient than individual creates)
          await tx.activityLog.createMany({
            data: requests.map((request) => ({
              userId: session.user.id,
              action: "request.archived",
              entityType: "ContentRequest",
              entityId: request.id,
              metadata: { title: request.title },
            })),
          });

          return updateResult;
        });
        result.affected = updated.count;
        break;
      }

      case "delete": {
        // Use transaction for atomicity
        const deleted = await db.$transaction(async (tx) => {
          // Batch create activity logs first (before deletion)
          await tx.activityLog.createMany({
            data: requests.map((request) => ({
              userId: session.user.id,
              action: "request.deleted",
              entityType: "ContentRequest",
              entityId: request.id,
              metadata: { title: request.title },
            })),
          });

          const deleteResult = await tx.contentRequest.deleteMany({
            where: {
              id: { in: validatedData.requestIds },
              agencyId: session.user.agencyId,
            },
          });

          return deleteResult;
        });
        result.affected = deleted.count;
        break;
      }

      case "sendReminders": {
        const errors: string[] = [];
        let sent = 0;

        for (const request of requests) {
          // Only send reminders for pending/in-progress requests
          if (!["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(request.status)) {
            errors.push(`Request "${request.title}" is not in a remindable status`);
            continue;
          }

          const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
          const dueDate = request.dueDate
            ? format(request.dueDate, "MMMM d, yyyy")
            : "No specific due date";

          try {
            // Send email
            await sendReminderEmail({
              to: request.creator.email,
              creatorName: request.creator.name,
              requestTitle: request.title,
              dueDate,
              daysUntilDue: request.dueDate
                ? Math.ceil((request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0,
              portalLink,
            });

            // Send SMS if applicable
            if (
              request.creator.phone &&
              (request.creator.preferredContact === "SMS" ||
                request.creator.preferredContact === "BOTH")
            ) {
              await sendReminderSms({
                to: request.creator.phone,
                creatorName: request.creator.name,
                requestTitle: request.title,
                daysUntilDue: request.dueDate
                  ? Math.ceil((request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : 0,
                portalLink,
              });
            }

            // Create reminder record
            await db.reminder.create({
              data: {
                requestId: request.id,
                type: "UPCOMING",
                channel: "EMAIL",
                scheduledAt: new Date(),
                sentAt: new Date(),
                status: "SENT",
              },
            });

            sent++;
          } catch (error) {
            console.error(`Failed to send reminder for request ${request.id}:`, error);
            errors.push(`Failed to send reminder for "${request.title}"`);
          }
        }

        result.affected = sent;
        if (errors.length > 0) {
          result.errors = errors;
        }
        break;
      }

      case "changePriority": {
        if (!validatedData.priority) {
          return NextResponse.json(
            { error: "Priority is required for changePriority action" },
            { status: 400 }
          );
        }

        // Use transaction for atomicity and batch activity logs
        const updated = await db.$transaction(async (tx) => {
          const updateResult = await tx.contentRequest.updateMany({
            where: {
              id: { in: validatedData.requestIds },
              agencyId: session.user.agencyId,
            },
            data: {
              urgency: validatedData.priority,
            },
          });

          // Batch create activity logs
          await tx.activityLog.createMany({
            data: requests.map((request) => ({
              userId: session.user.id,
              action: "request.priorityChanged",
              entityType: "ContentRequest",
              entityId: request.id,
              metadata: {
                title: request.title,
                newPriority: validatedData.priority,
              },
            })),
          });

          return updateResult;
        });
        result.affected = updated.count;
        break;
      }

      case "assignCreator": {
        if (!validatedData.creatorId) {
          return NextResponse.json(
            { error: "Creator ID is required for assignCreator action" },
            { status: 400 }
          );
        }

        // Verify creator belongs to this agency
        const creator = await db.creator.findFirst({
          where: {
            id: validatedData.creatorId,
            agencyId: session.user.agencyId,
          },
        });

        if (!creator) {
          return NextResponse.json(
            { error: "Creator not found" },
            { status: 404 }
          );
        }

        // Use transaction for atomicity and batch activity logs
        const updated = await db.$transaction(async (tx) => {
          const updateResult = await tx.contentRequest.updateMany({
            where: {
              id: { in: validatedData.requestIds },
              agencyId: session.user.agencyId,
            },
            data: {
              creatorId: validatedData.creatorId,
            },
          });

          // Batch create activity logs
          await tx.activityLog.createMany({
            data: requests.map((request) => ({
              userId: session.user.id,
              action: "request.creatorAssigned",
              entityType: "ContentRequest",
              entityId: request.id,
              metadata: {
                title: request.title,
                newCreatorId: validatedData.creatorId,
                newCreatorName: creator.name,
              },
            })),
          });

          return updateResult;
        });
        result.affected = updated.count;
        break;
      }

      case "changeStatus": {
        if (!validatedData.status) {
          return NextResponse.json(
            { error: "Status is required for changeStatus action" },
            { status: 400 }
          );
        }

        // Use transaction for atomicity and batch activity logs
        const updated = await db.$transaction(async (tx) => {
          const updateResult = await tx.contentRequest.updateMany({
            where: {
              id: { in: validatedData.requestIds },
              agencyId: session.user.agencyId,
            },
            data: {
              status: validatedData.status,
            },
          });

          // Batch create activity logs
          await tx.activityLog.createMany({
            data: requests.map((request) => ({
              userId: session.user.id,
              action: "request.statusChanged",
              entityType: "ContentRequest",
              entityId: request.id,
              metadata: {
                title: request.title,
                newStatus: validatedData.status,
              },
            })),
          });

          return updateResult;
        });
        result.affected = updated.count;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Invalidate cache after bulk operations
    invalidateCache.agency(session.user.agencyId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error performing bulk action:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
