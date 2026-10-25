import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";

// VALIDATION SCHEMAS

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(["INFO", "WARNING", "SUCCESS", "PROMO"]).default("INFO"),
  actionText: z.string().max(50).nullable().optional(),
  actionUrl: z.string().max(500).nullable().optional(),
  targetAudience: z.enum(["ALL", "ADMINS", "CREATORS"]).default("ALL"),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().nullable().optional().transform((val) => (val ? new Date(val) : null)),
  isActive: z.boolean().default(true),
  isPinned: z.boolean().default(false),
});

const updateAnnouncementSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(1000).optional(),
  type: z.enum(["INFO", "WARNING", "SUCCESS", "PROMO"]).optional(),
  actionText: z.string().max(50).nullable().optional(),
  actionUrl: z.string().max(500).nullable().optional(),
  targetAudience: z.enum(["ALL", "ADMINS", "CREATORS"]).optional(),
  startDate: z.string().transform((val) => new Date(val)).optional(),
  endDate: z.string().nullable().optional().transform((val) => (val ? new Date(val) : null)),
  isActive: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

const dismissAnnouncementSchema = z.object({
  announcementId: z.string(),
});

// GET - Fetch announcements

export async function GET(req: NextRequest) {
  try {
    // Banners (forDisplay) reach every staff member; the full list is for managing them
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access } = gate;

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const forDisplay = searchParams.get("forDisplay") === "true";
    if (!forDisplay && !access.has("settings.announcements")) return forbidden("settings.announcements");

    const user = { agencyId: access.agencyId };
    const now = new Date();
    // "Admins" banners: the owner and people on the Admin role
    const isAdmin = access.isOwner || access.role.id === "admin";

    // Build where clause
    const whereClause: Record<string, unknown> = {};

    // For display, only show active and scheduled announcements
    if (forDisplay) {
      whereClause.isActive = true;
      whereClause.startDate = { lte: now };
      whereClause.OR = [
        { endDate: null },
        { endDate: { gte: now } },
      ];
      // Filter by audience
      whereClause.targetAudience = {
        in: isAdmin ? ["ALL", "ADMINS"] : ["ALL"],
      };
    } else if (!includeInactive) {
      whereClause.isActive = true;
    }

    // Only this agency's announcements, or system-wide ones (kept apart from
    // the end-date OR above, which this used to merge into)
    whereClause.AND = [{ OR: [{ agencyId: user.agencyId }, { agencyId: null }] }];

    // Get user's dismissed announcements
    const dismissedIds = forDisplay
      ? (
          await db.announcementDismissal.findMany({
            where: { userId: access.userId },
            select: { announcementId: true },
          })
        ).map((d) => d.announcementId)
      : [];

    // Fetch announcements
    const announcements = await db.announcement.findMany({
      where: {
        ...whereClause,
        ...(forDisplay && dismissedIds.length > 0
          ? { id: { notIn: dismissedIds } }
          : {}),
      },
      orderBy: [
        { isPinned: "desc" },
        { startDate: "desc" },
      ],
      include: {
        _count: {
          select: { dismissals: true },
        },
      },
    });

    // Format response
    const formattedAnnouncements = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      actionText: a.actionText,
      actionUrl: a.actionUrl,
      targetAudience: a.targetAudience,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate?.toISOString() || null,
      isActive: a.isActive,
      isPinned: a.isPinned,
      dismissalCount: a._count.dismissals,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({
      announcements: formattedAnnouncements,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    );
  }
}

// POST - Create announcement

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.announcements");
    if (gate.error) return gate.error;
    const { access } = gate;
    const user = { agencyId: access.agencyId };

    const body = await req.json();
    const validatedData = createAnnouncementSchema.parse(body);

    const announcement = await db.announcement.create({
      data: {
        ...validatedData,
        agencyId: user.agencyId,
        createdById: access.userId,
      },
      include: {
        _count: {
          select: { dismissals: true },
        },
      },
    });

    return NextResponse.json({
      announcement: {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        actionText: announcement.actionText,
        actionUrl: announcement.actionUrl,
        targetAudience: announcement.targetAudience,
        startDate: announcement.startDate.toISOString(),
        endDate: announcement.endDate?.toISOString() || null,
        isActive: announcement.isActive,
        isPinned: announcement.isPinned,
        dismissalCount: announcement._count.dismissals,
        createdAt: announcement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}

// PUT - Update announcement

export async function PUT(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.announcements");
    if (gate.error) return gate.error;
    const { access } = gate;
    const user = { agencyId: access.agencyId };

    const body = await req.json();
    const validatedData = updateAnnouncementSchema.parse(body);

    const { id, ...updateData } = validatedData;

    // Verify announcement exists and belongs to user's agency
    const existing = await db.announcement.findFirst({
      where: {
        id,
        OR: [
          { agencyId: user.agencyId },
          { agencyId: null }, // System-wide can be edited by any admin
        ],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    const announcement = await db.announcement.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { dismissals: true },
        },
      },
    });

    return NextResponse.json({
      announcement: {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        actionText: announcement.actionText,
        actionUrl: announcement.actionUrl,
        targetAudience: announcement.targetAudience,
        startDate: announcement.startDate.toISOString(),
        endDate: announcement.endDate?.toISOString() || null,
        isActive: announcement.isActive,
        isPinned: announcement.isPinned,
        dismissalCount: announcement._count.dismissals,
        createdAt: announcement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating announcement:", error);
    return NextResponse.json(
      { error: "Failed to update announcement" },
      { status: 500 }
    );
  }
}

// PATCH - Dismiss announcement for user

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access } = gate;

    const body = await req.json();
    const { announcementId } = dismissAnnouncementSchema.parse(body);

    // Check if announcement exists
    const announcement = await db.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Create dismissal record (upsert to handle duplicates)
    await db.announcementDismissal.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: access.userId,
        },
      },
      create: {
        announcementId,
        userId: access.userId,
      },
      update: {}, // No update needed, just ensure it exists
    });

    return NextResponse.json({
      success: true,
      message: "Announcement dismissed",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error dismissing announcement:", error);
    return NextResponse.json(
      { error: "Failed to dismiss announcement" },
      { status: 500 }
    );
  }
}

// DELETE - Delete announcement

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.announcements");
    if (gate.error) return gate.error;
    const { access } = gate;
    const user = { agencyId: access.agencyId };

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    // Verify announcement exists and belongs to user's agency
    const existing = await db.announcement.findFirst({
      where: {
        id,
        OR: [
          { agencyId: user.agencyId },
          { agencyId: null },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    await db.announcement.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Announcement deleted",
    });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json(
      { error: "Failed to delete announcement" },
      { status: 500 }
    );
  }
}
