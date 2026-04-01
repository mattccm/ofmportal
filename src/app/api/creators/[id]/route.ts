import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// GET - Fetch full creator profile
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

    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: {
            requests: true,
            uploads: true,
          },
        },
        uploads: {
          where: {
            uploadStatus: "COMPLETED",
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            uploadedAt: true,
          },
        },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            createdAt: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Calculate stats
    const totalUploads = creator._count.uploads;
    const approvedUploads = creator.uploads.filter((u) => u.status === "APPROVED").length;
    const approvalRate = totalUploads > 0 ? Math.round((approvedUploads / totalUploads) * 100) : 0;

    // Calculate average response time (from request creation to first upload)
    const requestsWithUploads = await db.contentRequest.findMany({
      where: {
        creatorId: id,
        agencyId: session.user.agencyId,
        uploads: { some: {} },
      },
      include: {
        uploads: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    let avgResponseTime = 0;
    if (requestsWithUploads.length > 0) {
      const totalResponseTime = requestsWithUploads.reduce((acc, req) => {
        if (req.uploads[0]) {
          const diff = req.uploads[0].createdAt.getTime() - req.createdAt.getTime();
          return acc + diff;
        }
        return acc;
      }, 0);
      avgResponseTime = totalResponseTime / requestsWithUploads.length / (1000 * 60 * 60); // Convert to hours
    }

    const stats = {
      totalUploads,
      approvalRate,
      avgResponseTimeHours: Math.round(avgResponseTime * 10) / 10,
      totalRequests: creator._count.requests,
      memberSince: creator.createdAt,
    };

    return NextResponse.json({
      ...creator,
      stats,
    });
  } catch (error) {
    console.error("Error fetching creator:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator" },
      { status: 500 }
    );
  }
}

// PATCH - Update creator profile
const updateCreatorSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  preferredContact: z.enum(["EMAIL", "SMS", "BOTH"]).optional(),
  timezone: z.string().optional(),
  notes: z.string().optional().nullable(),
  contentPreferences: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check creator exists and belongs to agency
    const existingCreator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingCreator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateCreatorSchema.parse(body);

    // If email is changing, check for duplicates
    if (validatedData.email && validatedData.email !== existingCreator.email) {
      const duplicateEmail = await db.creator.findFirst({
        where: {
          agencyId: session.user.agencyId,
          email: validatedData.email.toLowerCase(),
          id: { not: id },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          { error: "A creator with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Build update data with proper typing for JSON fields
    const { contentPreferences, ...otherData } = validatedData;
    const updateData: Prisma.CreatorUpdateInput = {
      ...otherData,
      email: validatedData.email?.toLowerCase(),
    };

    if (contentPreferences !== undefined) {
      updateData.contentPreferences = contentPreferences as unknown as Prisma.InputJsonValue;
    }

    const updatedCreator = await db.creator.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.updated",
        entityType: "Creator",
        entityId: id,
        metadata: {
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    return NextResponse.json({ creator: updatedCreator });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating creator:", error);
    return NextResponse.json(
      { error: "Failed to update creator" },
      { status: 500 }
    );
  }
}

// DELETE - Archive/soft-delete creator (or full delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER or ADMIN only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // For now, we'll do a soft-delete by setting inviteStatus to EXPIRED
    // In a real app, you might have a separate "archived" flag
    const url = new URL(req.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    if (hardDelete) {
      await db.creator.delete({
        where: { id },
      });
    } else {
      await db.creator.update({
        where: { id },
        data: {
          inviteStatus: "EXPIRED",
          inviteToken: null,
        },
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: hardDelete ? "creator.deleted" : "creator.archived",
        entityType: "Creator",
        entityId: id,
        metadata: {
          creatorName: creator.name,
          creatorEmail: creator.email,
        },
      },
    });

    return NextResponse.json({
      message: hardDelete ? "Creator deleted successfully" : "Creator archived successfully",
    });
  } catch (error) {
    console.error("Error archiving/deleting creator:", error);
    return NextResponse.json(
      { error: "Failed to archive/delete creator" },
      { status: 500 }
    );
  }
}
