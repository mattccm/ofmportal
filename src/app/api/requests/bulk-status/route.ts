import { NextRequest, NextResponse } from "next/server";
import { recipientsWhoCanSee, requireAccess, requestWhere, staffWhere, forbidden } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { deliver } from "@/lib/messaging-server";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { dueLong, calendarDaysUntilDue } from "@/lib/due";

// Schema for bulk status update requests
const bulkStatusSchema = z.object({
  action: z.enum([
    "changeStatus",
    "changePriority",
    "assignTeamMember",
    "sendReminders",
    "archive",
  ]),
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
  // Optional fields for specific actions
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
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  teamMemberId: z.string().optional(),
  note: z.string().optional(),
});

interface BulkResult {
  requestId: string;
  requestTitle: string;
  success: boolean;
  error?: string;
}

/** The permission a bulk action needs on top of requests.bulk */
function bulkActionKey(action: z.infer<typeof bulkStatusSchema>["action"], status?: string): string {
  if (action === "archive") return "requests.archive";
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
    const gate = await requireAccess("requests.bulk");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await req.json();
    const validatedData = bulkStatusSchema.parse(body);

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

    if (requests.length === 0) {
      return NextResponse.json(
        { error: "No valid requests found" },
        { status: 404 }
      );
    }

    const results: BulkResult[] = [];
    const errors: string[] = [];
    let affected = 0;

    switch (validatedData.action) {
      case "changeStatus": {
        if (!validatedData.status) {
          return NextResponse.json(
            { error: "Status is required for changeStatus action" },
            { status: 400 }
          );
        }

        // Process each request individually for detailed results
        for (const request of requests) {
          try {
            await db.contentRequest.update({
              where: { id: request.id },
              data: { status: validatedData.status },
            });

            // Log activity
            await db.activityLog.create({
              data: {
                userId: session.user.id,
                action: "request.statusChanged",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: {
                  title: request.title,
                  previousStatus: request.status,
                  newStatus: validatedData.status,
                  note: validatedData.note,
                  bulkAction: true,
                },
              },
            });

            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: true,
            });
            affected++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: errorMessage,
            });
            errors.push(`Failed to update "${request.title}": ${errorMessage}`);
            continue;
          }

          // Drafts moved to an active status need their auto-reminders scheduled
          if (
            request.status === "DRAFT" &&
            request.dueDate &&
            ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(validatedData.status)
          ) {
            try {
              await scheduleRemindersForRequest(request.id);
            } catch (error) {
              console.error(`Failed to schedule auto-reminders for ${request.id}:`, error);
            }
          }
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

        for (const request of requests) {
          try {
            await db.contentRequest.update({
              where: { id: request.id },
              data: { urgency: validatedData.priority },
            });

            await db.activityLog.create({
              data: {
                userId: session.user.id,
                action: "request.priorityChanged",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: {
                  title: request.title,
                  previousPriority: request.urgency,
                  newPriority: validatedData.priority,
                  note: validatedData.note,
                  bulkAction: true,
                },
              },
            });

            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: true,
            });
            affected++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: errorMessage,
            });
            errors.push(`Failed to update priority for "${request.title}": ${errorMessage}`);
          }
        }
        break;
      }

      case "assignTeamMember": {
        if (!validatedData.teamMemberId) {
          return NextResponse.json(
            { error: "Team member ID is required for assignTeamMember action" },
            { status: 400 }
          );
        }

        // Verify team member exists and belongs to agency
        const teamMember = await db.user.findFirst({
          where: { AND: [staffWhere(access), { id: validatedData.teamMemberId }] },
        });

        if (!teamMember) {
          return NextResponse.json(
            { error: "Team member not found" },
            { status: 404 }
          );
        }

        // Whether the assignee's role can see each creator (once per creator)
        const creatorIds = [...new Set(requests.map((r) => r.creatorId))];
        const seen = await Promise.all(
          creatorIds.map((creatorId) =>
            recipientsWhoCanSee(access.agencyId, [teamMember.id], { creatorId, keys: ["requests.view"] })
          )
        );
        const assigneeSees = new Set(creatorIds.filter((_, i) => seen[i].length > 0));

        for (const request of requests) {
          try {
            // Note: The schema may not have an assignedTo field
            // If it doesn't exist, we log the assignment as activity
            await db.activityLog.create({
              data: {
                userId: session.user.id,
                action: "request.teamMemberAssigned",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: {
                  title: request.title,
                  assignedToId: teamMember.id,
                  assignedToName: teamMember.name,
                  note: validatedData.note,
                  bulkAction: true,
                },
              },
            });

            // Tell the assigned team member, if their role can see this request
            if (assigneeSees.has(request.creatorId)) {
              await db.notification.create({
                data: {
                  userId: teamMember.id,
                  type: "request_assigned",
                  title: "New Request Assigned",
                  message: `You have been assigned to "${request.title}"`,
                  link: `/dashboard/requests/${request.id}`,
                },
              });
            }

            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: true,
            });
            affected++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: errorMessage,
            });
            errors.push(`Failed to assign team member to "${request.title}": ${errorMessage}`);
          }
        }
        break;
      }

      case "sendReminders": {
        for (const request of requests) {
          // Only send reminders for pending/in-progress/needs revision requests
          if (!["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(request.status)) {
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: `Request is ${request.status}, not in a remindable status`,
            });
            errors.push(`"${request.title}" is not in a remindable status`);
            continue;
          }

          try {
            const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${request.id}`;
            const dueDate = dueLong(request, "No specific due date");

            // Email and/or text, as the "reminder sent by hand" plan says
            const delivered = await deliver(
              "reminder.manual",
              { agencyId: request.agencyId, creator: request.creator, request },
              {
                email: () =>
                  sendReminderEmail({
                    to: request.creator.email,
                    creatorName: request.creator.name,
                    requestTitle: request.title,
                    dueDate,
                    daysUntilDue: calendarDaysUntilDue(request, request.creator.timezone) ?? 0,
                    portalLink,
                  }),
                sms: (to) =>
                  sendReminderSms({
                    to,
                    creatorName: request.creator.name,
                    requestTitle: request.title,
                    daysUntilDue: calendarDaysUntilDue(request, request.creator.timezone) ?? 0,
                    portalLink,
                  }),
              }
            );
            if (!delivered.email && !delivered.sms) throw new Error(delivered.errors.join("; ") || "Nothing was sent");

            // Create reminder record
            await db.reminder.create({
              data: {
                requestId: request.id,
                type: "UPCOMING",
                channel: delivered.email ? "EMAIL" : "SMS",
                scheduledAt: new Date(),
                sentAt: new Date(),
                status: "SENT",
              },
            });

            // Log activity
            await db.activityLog.create({
              data: {
                userId: session.user.id,
                action: "request.reminderSent",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: {
                  title: request.title,
                  creatorName: request.creator.name,
                  note: validatedData.note,
                  bulkAction: true,
                },
              },
            });

            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: true,
            });
            affected++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: errorMessage,
            });
            errors.push(`Failed to send reminder for "${request.title}": ${errorMessage}`);
          }
        }
        break;
      }

      case "archive": {
        for (const request of requests) {
          // Skip already archived requests
          if (request.status === "ARCHIVED") {
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: "Request is already archived",
            });
            errors.push(`"${request.title}" is already archived`);
            continue;
          }

          try {
            await db.contentRequest.update({
              where: { id: request.id },
              data: { status: "ARCHIVED" },
            });

            await db.activityLog.create({
              data: {
                userId: session.user.id,
                action: "request.archived",
                entityType: "ContentRequest",
                entityId: request.id,
                metadata: {
                  title: request.title,
                  previousStatus: request.status,
                  note: validatedData.note,
                  bulkAction: true,
                },
              },
            });

            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: true,
            });
            affected++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            results.push({
              requestId: request.id,
              requestTitle: request.title,
              success: false,
              error: errorMessage,
            });
            errors.push(`Failed to archive "${request.title}": ${errorMessage}`);
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

    return NextResponse.json({
      success: errors.length === 0,
      affected,
      total: requests.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error performing bulk status update:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk status update" },
      { status: 500 }
    );
  }
}
