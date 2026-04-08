import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { invalidateCache } from "@/lib/cache";
import { broadcastRequestUpdate, broadcastAgencyNotification } from "@/lib/realtime-broadcast";

const richContentSchema = z.object({
  description: z.string().optional(),
  exampleText: z.string().optional(),
  exampleImages: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
  })).optional(),
  exampleVideoUrl: z.string().optional(),
  referenceLinks: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).optional(),
}).optional();

const updateRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
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
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().nullable().optional(),
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    value: z.string().optional().default(""),
    type: z.string(),
    required: z.boolean().optional().default(false),
    helpText: z.string().optional(),
    richContent: richContentSchema,
    acceptedFileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    maxFiles: z.number().optional(),
    minFiles: z.number().optional(),
    enforceFileTypes: z.boolean().optional(),
    enforceMaxFileSize: z.boolean().optional(),
    enforceFileCount: z.boolean().optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
  })).optional(),
  requirements: z.record(z.string(), z.unknown()).optional(),
  richContent: richContentSchema,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination params for uploads/comments
    const url = new URL(req.url);
    const uploadsLimit = Math.min(parseInt(url.searchParams.get("uploadsLimit") || "50"), 100);
    const commentsLimit = Math.min(parseInt(url.searchParams.get("commentsLimit") || "50"), 100);

    // Use separate queries for counts to enable proper pagination
    const [contentRequest, uploadsCount, commentsCount] = await Promise.all([
      db.contentRequest.findFirst({
        where: {
          id,
          agencyId: session.user.agencyId,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
            },
          },
          uploads: {
            orderBy: { createdAt: "desc" },
            take: uploadsLimit,
          },
          comments: {
            orderBy: { createdAt: "desc" },
            take: commentsLimit,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      db.upload.count({ where: { requestId: id } }),
      db.comment.count({ where: { requestId: id } }),
    ]);

    if (!contentRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Serialize BigInt values and include pagination info
    const serializedRequest = {
      ...contentRequest,
      uploads: contentRequest.uploads.map((upload) => ({
        ...upload,
        fileSize: upload.fileSize.toString(),
      })),
      pagination: {
        uploadsTotal: uploadsCount,
        uploadsLimit,
        commentsTotal: commentsCount,
        commentsLimit,
        hasMoreUploads: uploadsCount > uploadsLimit,
        hasMoreComments: commentsCount > commentsLimit,
      },
    };

    return NextResponse.json(serializedRequest);
  } catch (error) {
    console.error("Error fetching request:", error);
    return NextResponse.json(
      { error: "Failed to fetch request" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify request belongs to this agency
    const existingRequest = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateRequestSchema.parse(body);

    // Build update data object
    const updateData: Record<string, unknown> = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;

      // Set submittedAt when status changes to SUBMITTED
      if (validatedData.status === "SUBMITTED" && existingRequest.status !== "SUBMITTED") {
        updateData.submittedAt = new Date();
      }

      // Set reviewedAt when status changes to APPROVED or NEEDS_REVISION
      if (
        (validatedData.status === "APPROVED" || validatedData.status === "NEEDS_REVISION") &&
        existingRequest.status !== "APPROVED" &&
        existingRequest.status !== "NEEDS_REVISION"
      ) {
        updateData.reviewedAt = new Date();
      }
    }

    if (validatedData.urgency !== undefined) {
      updateData.urgency = validatedData.urgency;
    }

    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }

    if (validatedData.fields !== undefined) {
      updateData.fields = validatedData.fields;
    }

    if (validatedData.requirements !== undefined) {
      updateData.requirements = validatedData.requirements;
    }

    // Handle richContent - store in requirements._richContent
    if (validatedData.richContent !== undefined) {
      const currentRequirements = (existingRequest.requirements as Record<string, unknown>) || {};
      updateData.requirements = {
        ...currentRequirements,
        _richContent: validatedData.richContent,
      };
    }

    // Update the request
    const updatedRequest = await db.contentRequest.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.updated",
        entityType: "ContentRequest",
        entityId: id,
        metadata: {
          title: updatedRequest.title,
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    // Invalidate cache
    invalidateCache.request(id, session.user.agencyId);

    // Broadcast real-time update (fire and forget)
    if (validatedData.status) {
      broadcastRequestUpdate(id, {
        type: "status_change",
        data: { requestId: id, newStatus: validatedData.status, title: updatedRequest.title },
      }).catch(() => {});
      broadcastAgencyNotification(session.user.agencyId, {
        type: "request_updated",
        title: "Request Updated",
        message: `"${updatedRequest.title}" status changed to ${validatedData.status}`,
        entityType: "ContentRequest",
        entityId: id,
        link: `/dashboard/requests/${id}`,
      }).catch(() => {});
    }

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating request:", error);
    return NextResponse.json(
      { error: "Failed to update request" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify request belongs to this agency
    const existingRequest = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Delete the request
    await db.contentRequest.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.deleted",
        entityType: "ContentRequest",
        entityId: id,
        metadata: {
          title: existingRequest.title,
        },
      },
    });

    // Invalidate cache
    invalidateCache.request(id, session.user.agencyId);

    // Broadcast deletion (fire and forget)
    broadcastAgencyNotification(session.user.agencyId, {
      type: "request_deleted",
      title: "Request Deleted",
      message: `"${existingRequest.title}" has been deleted`,
      entityType: "ContentRequest",
      entityId: id,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting request:", error);
    return NextResponse.json(
      { error: "Failed to delete request" },
      { status: 500 }
    );
  }
}
