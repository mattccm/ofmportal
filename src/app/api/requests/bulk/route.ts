import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, creatorWhere, forbidden } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { invalidateCache } from "@/lib/cache";
import { broadcastAgencyNotification } from "@/lib/realtime-broadcast";
import { deleteUnreferencedStorageObjects } from "@/lib/media-refs";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { dueLong, calendarDaysUntilDue } from "@/lib/due";

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

/** The permission a bulk action needs on top of requests.bulk */
function bulkActionKey(action: z.infer<typeof bulkActionSchema>["action"], status?: string): string {
  if (action === "archive") return "requests.archive";
  if (action === "delete") return "requests.delete";
  if (action === "sendReminders") return "requests.remind";
  if (action === "changeStatus") {
    if (status === "APPROVED") return "review.approve";
    if (status === "NEEDS_REVISION") return "review.requestChanges";
    if (status === "ARCHIVED") return "requests.archive";
  }
  return "requests.edit";
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const validatedData = bulkActionSchema.parse(body);

    // The list's row menu acts on one request through this route too: one
    // request needs only the action's own key, several need bulk actions.
    if (validatedData.requestIds.length > 1 && !access.has("requests.bulk")) return forbidden("requests.bulk");

    // Each bulk action also needs the permission for the action itself
    const actionKey = bulkActionKey(validatedData.action, validatedData.status);
    if (!access.has(actionKey)) return forbidden(actionKey);

    // Verify all requests belong to this agency and are inside this person's creator scope
    const requests = await db.contentRequest.findMany({
      where: {
        ...requestWhere(access),
        id: { in: validatedData.requestIds },
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

    const result: { success: boolean; affected: number; errors?: string[] } = {
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

          // Batch create activity logs (more efficient than individual creates).
          // previousStatus lets PUT /api/requests/archive restore the real status;
          // skip requests that were already archived so it isn't logged as ARCHIVED.
          await tx.activityLog.createMany({
            data: requests
              .filter((request) => request.status !== "ARCHIVED")
              .map((request) => ({
                userId: session.user.id,
                action: "request.archived",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: { title: request.title, previousStatus: request.status },
              })),
          });

          return updateResult;
        });
        result.affected = updated.count;
        break;
      }

      case "delete": {
        // Collect storage keys before the cascade removes the upload rows
        const uploadsToRemove = await db.upload.findMany({
          where: {
            requestId: { in: validatedData.requestIds },
            request: { agencyId: session.user.agencyId },
          },
          select: { storageKey: true, thumbnailKey: true },
        });

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

        // Best-effort: remove R2 objects no other Upload/MediaItem still references
        await deleteUnreferencedStorageObjects(
          uploadsToRemove.flatMap((u) => [u.storageKey, u.thumbnailKey])
        );
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
          const dueDate = dueLong(request, "No specific due date");

          try {
            // Send email
            await sendReminderEmail({
              to: request.creator.email,
              creatorName: request.creator.name,
              requestTitle: request.title,
              dueDate,
              daysUntilDue: calendarDaysUntilDue(request, request.creator.timezone) ?? 0,
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
                daysUntilDue: calendarDaysUntilDue(request, request.creator.timezone) ?? 0,
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
          where: { AND: [creatorWhere(access), { id: validatedData.creatorId }] },
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

        // Drafts moved to an active status need their auto-reminders scheduled
        if (["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(validatedData.status)) {
          for (const request of requests) {
            if (request.status !== "DRAFT" || !request.dueDate) continue;
            try {
              await scheduleRemindersForRequest(request.id);
            } catch (error) {
              console.error(`Failed to schedule auto-reminders for ${request.id}:`, error);
            }
          }
        }
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

    // Broadcast bulk action to agency (fire and forget)
    broadcastAgencyNotification(session.user.agencyId, {
      type: `bulk_${validatedData.action}`,
      title: "Bulk Action Completed",
      message: `${result.affected} request(s) updated via bulk ${validatedData.action}`,
      entityType: "ContentRequest",
    }).catch(() => {});

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
