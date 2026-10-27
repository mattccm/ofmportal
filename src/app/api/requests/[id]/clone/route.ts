import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, creatorWhere, redactCreatorsIn } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { Prisma } from "@prisma/client";
import { deliver } from "@/lib/messaging-server";
import { dueDayOf, dueFromDay, parseDueInput, shiftDue, todayIn, safeTimeZone, formatDueLong, dayKeyOf, type Due } from "@/lib/due";
import { staffTimeZone } from "@/lib/due-server";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";

const cloneRequestSchema = z.object({
  targetCreatorIds: z.array(z.string()).min(1, "At least one creator is required"),
  modifications: z.object({
    title: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    dueDateOffset: z.number().nullable().optional(),
    urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    fields: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      type: z.string(),
      required: z.boolean(),
    }).passthrough()).optional(),
  }).optional(),
  sendNotification: z.boolean().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("requests.create");
    if (gate.error) return gate.error;
    const { access, session } = gate;
    const { id } = await params;

    const body = await req.json();
    const validatedData = cloneRequestSchema.parse(body);

    // Get the original request
    const originalRequest = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
      include: {
        creator: true,
        template: true,
      },
    });

    if (!originalRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Verify all target creators belong to this agency
    const targetCreators = await db.creator.findMany({
      where: { AND: [creatorWhere(access), { id: { in: validatedData.targetCreatorIds } }] },
    });

    if (targetCreators.length !== validatedData.targetCreatorIds.length) {
      return NextResponse.json(
        { error: "Some creators not found or unauthorized" },
        { status: 404 }
      );
    }

    const modifications = validatedData.modifications || {};
    const pickerTz = await staffTimeZone(session.user.id);
    // The original's due DAY (what everyone saw), re-anchored per target creator
    const originalDay = dueDayOf(originalRequest, originalRequest.creator.timezone);
    const clonedRequests: string[] = [];
    const cloneErrors: string[] = [];

    // Clone request for each target creator
    for (let i = 0; i < targetCreators.length; i++) {
      const creator = targetCreators[i];

      try {
        // Calculate due date with optional offset
        // Same calendar day for each creator, due at the end of their own day
        let due: Due | null = null;
        if (modifications.dueDate) {
          due = parseDueInput(modifications.dueDate, creator.timezone, pickerTz);
        } else if (modifications.dueDateOffset !== null && modifications.dueDateOffset !== undefined) {
          // Original due day (or the creator's today) plus the offset, in calendar days
          const base = originalDay ?? todayIn(safeTimeZone(creator.timezone));
          due = shiftDue(base, modifications.dueDateOffset * i, creator.timezone);
        } else if (originalDay) {
          due = dueFromDay(originalDay, creator.timezone);
        }
        const dueDate = due?.dueDate ?? null;

        // Get the clone metadata from original request if it exists
        const originalRequirements = originalRequest.requirements as Record<string, unknown> || {};
        const cloneInfo = {
          clonedFromId: originalRequest.id,
          clonedAt: new Date().toISOString(),
          clonedBy: session.user.id,
        };

        // Create the cloned request
        const clonedRequest = await db.contentRequest.create({
          data: {
            agencyId: session.user.agencyId,
            creatorId: creator.id,
            templateId: originalRequest.templateId,
            title: modifications.title || originalRequest.title,
            description: originalRequest.description,
            dueOn: due?.dueOn ?? null,
            dueDate,
            urgency: modifications.urgency || originalRequest.urgency,
            // A copy keeps the original's messaging plan
            messaging: (originalRequest.messaging as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
            requirements: JSON.parse(JSON.stringify({
              ...originalRequirements,
              _cloneInfo: cloneInfo,
            })),
            fields: JSON.parse(JSON.stringify(modifications.fields || originalRequest.fields)),
            status: "PENDING",
          },
          include: {
            creator: true,
          },
        });

        clonedRequests.push(clonedRequest.id);

        // Schedule auto-reminders like a normal new request
        if (dueDate) {
          try {
            await scheduleRemindersForRequest(clonedRequest.id);
          } catch (error) {
            console.error("Failed to schedule auto-reminders:", error);
          }
        }

        // Send notification if requested
        if (validatedData.sendNotification) {
          const portalLink = `${process.env.APP_URL}/portal/${creator.id}/requests/${clonedRequest.id}`;
          const formattedDueDate = formatDueLong(dayKeyOf(due?.dueOn), "No specific due date");

          // Email and/or text, as the request's messaging plan says
          await deliver(
            "request.new",
            { agencyId: clonedRequest.agencyId, creator, request: clonedRequest },
            {
              email: () =>
                sendContentRequestEmail({
                  to: creator.email,
                  creatorName: creator.name,
                  agencyName: session.user.agencyName,
                  requestTitle: clonedRequest.title,
                  dueDate: formattedDueDate,
                  portalLink,
                }),
              sms: (to) =>
                sendContentRequestSms({
                  to,
                  creatorName: creator.name,
                  requestTitle: clonedRequest.title,
                  portalLink,
                }),
            }
          );
        }

        // Log activity for cloned request
        await db.activityLog.create({
          data: {
            userId: session.user.id,
            action: "request.cloned",
            entityType: "ContentRequest",
            entityId: clonedRequest.id,
            metadata: {
              title: clonedRequest.title,
              creatorName: creator.name,
              clonedFromId: originalRequest.id,
              clonedFromTitle: originalRequest.title,
            },
          },
        });
      } catch (error) {
        console.error(`Failed to clone request for creator ${creator.id}:`, error);
        cloneErrors.push(`Failed to clone for ${creator.name}`);
      }
    }

    // Log activity for original request
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.wasCloned",
        entityType: "ContentRequest",
        entityId: originalRequest.id,
        metadata: {
          title: originalRequest.title,
          clonedToIds: clonedRequests,
          targetCreatorCount: targetCreators.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      clonedRequests,
      clonedCount: clonedRequests.length,
      errors: cloneErrors.length > 0 ? cloneErrors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error cloning request:", error);
    return NextResponse.json(
      { error: "Failed to clone request" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve clone history for a request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("requests.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    // Get the request
    const request = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Check if this request was cloned from another
    const requirements = request.requirements as Record<string, unknown> | null;
    const cloneInfo = requirements?._cloneInfo as {
      clonedFromId?: string;
      clonedAt?: string;
      clonedBy?: string;
    } | null;

    let originalRequest = null;
    if (cloneInfo?.clonedFromId) {
      originalRequest = await db.contentRequest.findFirst({
        where: { AND: [requestWhere(access), { id: cloneInfo.clonedFromId }] },
        select: {
          id: true,
          title: true,
          status: true,
          creator: {
            select: { id: true, name: true },
          },
        },
      });
    }

    // Find requests that were cloned from this one
    const clonedFromThisRequest = await db.contentRequest.findMany({
      where: {
        ...requestWhere(access),
        requirements: {
          path: ["_cloneInfo", "clonedFromId"],
          equals: id,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        creator: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get activity logs related to cloning
    const cloneActivities = await db.activityLog.findMany({
      where: {
        entityId: id,
        action: { in: ["request.cloned", "request.wasCloned"] },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(redactCreatorsIn(access, {
      isClone: !!cloneInfo?.clonedFromId,
      clonedFrom: originalRequest
        ? {
            ...originalRequest,
            clonedAt: cloneInfo?.clonedAt,
          }
        : null,
      clones: clonedFromThisRequest,
      cloneCount: clonedFromThisRequest.length,
      activities: cloneActivities,
    }));
  } catch (error) {
    console.error("Error fetching clone history:", error);
    return NextResponse.json(
      { error: "Failed to fetch clone history" },
      { status: 500 }
    );
  }
}
