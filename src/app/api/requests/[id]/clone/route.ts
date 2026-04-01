import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { format, addDays } from "date-fns";

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
    })).optional(),
  }).optional(),
  sendNotification: z.boolean().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = cloneRequestSchema.parse(body);

    // Get the original request
    const originalRequest = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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
      where: {
        id: { in: validatedData.targetCreatorIds },
        agencyId: session.user.agencyId,
      },
    });

    if (targetCreators.length !== validatedData.targetCreatorIds.length) {
      return NextResponse.json(
        { error: "Some creators not found or unauthorized" },
        { status: 404 }
      );
    }

    const modifications = validatedData.modifications || {};
    const clonedRequests: string[] = [];
    const cloneErrors: string[] = [];

    // Clone request for each target creator
    for (let i = 0; i < targetCreators.length; i++) {
      const creator = targetCreators[i];

      try {
        // Calculate due date with optional offset
        let dueDate: Date | null = null;
        if (modifications.dueDate) {
          dueDate = new Date(modifications.dueDate);
        } else if (modifications.dueDateOffset !== null && modifications.dueDateOffset !== undefined) {
          // Use original due date with offset
          const baseDueDate = originalRequest.dueDate || new Date();
          dueDate = addDays(baseDueDate, modifications.dueDateOffset * i);
        } else if (originalRequest.dueDate) {
          dueDate = new Date(originalRequest.dueDate);
        }

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
            dueDate,
            urgency: modifications.urgency || originalRequest.urgency,
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

        // Send notification if requested
        if (validatedData.sendNotification) {
          const portalLink = `${process.env.APP_URL}/portal/${creator.id}/requests/${clonedRequest.id}`;
          const formattedDueDate = dueDate
            ? format(dueDate, "MMMM d, yyyy")
            : "No specific due date";

          try {
            await sendContentRequestEmail({
              to: creator.email,
              creatorName: creator.name,
              agencyName: session.user.agencyName,
              requestTitle: clonedRequest.title,
              dueDate: formattedDueDate,
              portalLink,
            });
          } catch (error) {
            console.error(`Failed to send email to ${creator.email}:`, error);
          }

          // Send SMS if preferred
          if (
            creator.phone &&
            (creator.preferredContact === "SMS" || creator.preferredContact === "BOTH")
          ) {
            try {
              await sendContentRequestSms({
                to: creator.phone,
                creatorName: creator.name,
                requestTitle: clonedRequest.title,
                portalLink,
              });
            } catch (error) {
              console.error(`Failed to send SMS to ${creator.phone}:`, error);
            }
          }
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
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the request
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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
        where: {
          id: cloneInfo.clonedFromId,
          agencyId: session.user.agencyId,
        },
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
        agencyId: session.user.agencyId,
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error fetching clone history:", error);
    return NextResponse.json(
      { error: "Failed to fetch clone history" },
      { status: 500 }
    );
  }
}
