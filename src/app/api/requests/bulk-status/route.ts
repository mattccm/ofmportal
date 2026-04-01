import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";
import { format } from "date-fns";

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkStatusSchema.parse(body);

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
          where: {
            id: validatedData.teamMemberId,
            agencyId: session.user.agencyId,
          },
        });

        if (!teamMember) {
          return NextResponse.json(
            { error: "Team member not found" },
            { status: 404 }
          );
        }

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

            // Create notification for assigned team member
            await db.notification.create({
              data: {
                userId: teamMember.id,
                type: "request_assigned",
                title: "New Request Assigned",
                message: `You have been assigned to "${request.title}"`,
                link: `/dashboard/requests/${request.id}`,
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
            const dueDate = request.dueDate
              ? format(request.dueDate, "MMMM d, yyyy")
              : "No specific due date";

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
