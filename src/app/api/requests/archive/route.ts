import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Schema for archive operations
const archiveSchema = z.object({
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
  note: z.string().optional(),
});

const restoreSchema = z.object({
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
});

const permanentDeleteSchema = z.object({
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
  confirmDelete: z.boolean().refine((val) => val === true, {
    message: "Must confirm permanent deletion",
  }),
});

// GET - List archived requests
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const creatorId = searchParams.get("creatorId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
      status: "ARCHIVED",
    };

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { creator: { name: { contains: search, mode: "insensitive" } } },
        { creator: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get archived requests with pagination
    const [requests, total] = await Promise.all([
      db.contentRequest.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          template: {
            select: { id: true, name: true },
          },
          _count: {
            select: { uploads: true, comments: true },
          },
        },
      }),
      db.contentRequest.count({ where }),
    ]);

    // Get archive count for sidebar
    const archiveCount = await db.contentRequest.count({
      where: {
        agencyId: session.user.agencyId,
        status: "ARCHIVED",
      },
    });

    // Serialize dates for JSON response
    const serializedRequests = requests.map((request) => ({
      ...request,
      dueDate: request.dueDate?.toISOString() || null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      submittedAt: request.submittedAt?.toISOString() || null,
      reviewedAt: request.reviewedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      requests: serializedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      archiveCount,
    });
  } catch (error) {
    console.error("Error fetching archived requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch archived requests" },
      { status: 500 }
    );
  }
}

// POST - Archive requests
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = archiveSchema.parse(body);

    // Verify all requests belong to this agency and are not already archived
    const requests = await db.contentRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        agencyId: session.user.agencyId,
        status: { not: "ARCHIVED" },
      },
    });

    if (requests.length === 0) {
      return NextResponse.json(
        { error: "No valid requests to archive" },
        { status: 400 }
      );
    }

    // Archive the requests
    const updated = await db.contentRequest.updateMany({
      where: {
        id: { in: requests.map((r) => r.id) },
        agencyId: session.user.agencyId,
      },
      data: {
        status: "ARCHIVED",
      },
    });

    // Log activity for each archived request
    for (const request of requests) {
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "request.archived",
          entityType: "ContentRequest",
          entityId: request.id,
          metadata: {
            title: request.title,
            note: validatedData.note || null,
            previousStatus: request.status,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      affected: updated.count,
      skipped: validatedData.requestIds.length - requests.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error archiving requests:", error);
    return NextResponse.json(
      { error: "Failed to archive requests" },
      { status: 500 }
    );
  }
}

// PUT - Restore requests from archive
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = restoreSchema.parse(body);

    // Verify all requests belong to this agency and are archived
    const requests = await db.contentRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        agencyId: session.user.agencyId,
        status: "ARCHIVED",
      },
    });

    if (requests.length === 0) {
      return NextResponse.json(
        { error: "No archived requests to restore" },
        { status: 400 }
      );
    }

    // Get the previous status from activity logs (or default to APPROVED)
    const restoredRequests = [];

    for (const request of requests) {
      // Try to find the previous status from activity log
      const archiveLog = await db.activityLog.findFirst({
        where: {
          entityType: "ContentRequest",
          entityId: request.id,
          action: "request.archived",
        },
        orderBy: { createdAt: "desc" },
      });

      const previousStatusStr =
        (archiveLog?.metadata as { previousStatus?: string })?.previousStatus || "APPROVED";
      const previousStatus = previousStatusStr as "DRAFT" | "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION" | "APPROVED" | "CANCELLED" | "ARCHIVED";

      // Restore the request
      await db.contentRequest.update({
        where: { id: request.id },
        data: { status: previousStatus },
      });

      restoredRequests.push({
        id: request.id,
        title: request.title,
        restoredTo: previousStatus,
      });

      // Log the restore activity
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "request.restored",
          entityType: "ContentRequest",
          entityId: request.id,
          metadata: {
            title: request.title,
            restoredToStatus: previousStatus,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      affected: restoredRequests.length,
      restored: restoredRequests,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error restoring requests:", error);
    return NextResponse.json(
      { error: "Failed to restore requests" },
      { status: 500 }
    );
  }
}

// DELETE - Permanently delete archived requests
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = permanentDeleteSchema.parse(body);

    // Verify all requests belong to this agency and are archived
    const requests = await db.contentRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        agencyId: session.user.agencyId,
        status: "ARCHIVED",
      },
    });

    if (requests.length === 0) {
      return NextResponse.json(
        { error: "No archived requests to delete" },
        { status: 400 }
      );
    }

    // Log deletion before actually deleting
    for (const request of requests) {
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "request.permanentlyDeleted",
          entityType: "ContentRequest",
          entityId: request.id,
          metadata: {
            title: request.title,
            creatorId: request.creatorId,
          },
        },
      });
    }

    // Permanently delete the requests (cascade will handle related records)
    const deleted = await db.contentRequest.deleteMany({
      where: {
        id: { in: requests.map((r) => r.id) },
        agencyId: session.user.agencyId,
        status: "ARCHIVED",
      },
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error permanently deleting requests:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete requests" },
      { status: 500 }
    );
  }
}
