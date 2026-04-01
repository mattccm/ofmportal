import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// SCHEMA VALIDATION
// ============================================

const addWatcherSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  notifyOnUpload: z.boolean().default(true),
  notifyOnComment: z.boolean().default(true),
  notifyOnStatus: z.boolean().default(true),
  notifyOnDueDate: z.boolean().default(true),
});

const removeWatcherSchema = z.object({
  watcherId: z.string().optional(),
  userId: z.string().optional(),
}).refine((data) => data.watcherId || data.userId, {
  message: "Either watcherId or userId is required",
});

const updatePreferencesSchema = z.object({
  watcherId: z.string().min(1, "Watcher ID is required"),
  notifyOnUpload: z.boolean().optional(),
  notifyOnComment: z.boolean().optional(),
  notifyOnStatus: z.boolean().optional(),
  notifyOnDueDate: z.boolean().optional(),
});

// ============================================
// GET - List all watchers for a request
// ============================================

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

    // Verify request belongs to the agency
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Get all watchers with user details
    const watchers = await db.requestWatcher.findMany({
      where: { requestId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      watchers,
      isWatching: watchers.some((w) => w.userId === session.user.id),
    });
  } catch (error) {
    console.error("Error fetching watchers:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchers" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add a watcher to a request
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = addWatcherSchema.parse(body);

    // Verify request belongs to the agency
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Verify user belongs to the same agency
    const user = await db.user.findFirst({
      where: {
        id: validatedData.userId,
        agencyId: session.user.agencyId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already watching
    const existingWatcher = await db.requestWatcher.findUnique({
      where: {
        requestId_userId: {
          requestId: id,
          userId: validatedData.userId,
        },
      },
    });

    if (existingWatcher) {
      return NextResponse.json(
        { error: "User is already watching this request" },
        { status: 400 }
      );
    }

    // Create watcher
    const watcher = await db.requestWatcher.create({
      data: {
        requestId: id,
        userId: validatedData.userId,
        notifyOnUpload: validatedData.notifyOnUpload,
        notifyOnComment: validatedData.notifyOnComment,
        notifyOnStatus: validatedData.notifyOnStatus,
        notifyOnDueDate: validatedData.notifyOnDueDate,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.watcher.added",
        entityType: "ContentRequest",
        entityId: id,
        metadata: {
          watcherUserId: validatedData.userId,
          watcherName: user.name,
        },
      },
    });

    return NextResponse.json({ watcher }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error adding watcher:", error);
    return NextResponse.json(
      { error: "Failed to add watcher" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove a watcher from a request
// ============================================

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

    const body = await req.json();
    const validatedData = removeWatcherSchema.parse(body);

    // Verify request belongs to the agency
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    let watcherToDelete;

    if (validatedData.watcherId) {
      // Delete by watcher ID
      watcherToDelete = await db.requestWatcher.findFirst({
        where: {
          id: validatedData.watcherId,
          requestId: id,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
    } else if (validatedData.userId) {
      // Delete by user ID (for self-unwatch)
      watcherToDelete = await db.requestWatcher.findFirst({
        where: {
          requestId: id,
          userId: validatedData.userId,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
    }

    if (!watcherToDelete) {
      return NextResponse.json(
        { error: "Watcher not found" },
        { status: 404 }
      );
    }

    // Only allow removing self or if user is manager/admin
    const canRemoveOthers = ["OWNER", "ADMIN", "MANAGER"].includes(session.user.role);
    if (watcherToDelete.userId !== session.user.id && !canRemoveOthers) {
      return NextResponse.json(
        { error: "You can only remove yourself from watching" },
        { status: 403 }
      );
    }

    // Delete the watcher
    await db.requestWatcher.delete({
      where: { id: watcherToDelete.id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "request.watcher.removed",
        entityType: "ContentRequest",
        entityId: id,
        metadata: {
          watcherUserId: watcherToDelete.userId,
          watcherName: watcherToDelete.user.name,
          removedBySelf: watcherToDelete.userId === session.user.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error removing watcher:", error);
    return NextResponse.json(
      { error: "Failed to remove watcher" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update watcher notification preferences
// ============================================

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

    const body = await req.json();
    const validatedData = updatePreferencesSchema.parse(body);

    // Verify request belongs to the agency
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Find the watcher
    const watcher = await db.requestWatcher.findFirst({
      where: {
        id: validatedData.watcherId,
        requestId: id,
      },
    });

    if (!watcher) {
      return NextResponse.json(
        { error: "Watcher not found" },
        { status: 404 }
      );
    }

    // Only allow updating own preferences
    if (watcher.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only update your own notification preferences" },
        { status: 403 }
      );
    }

    // Update preferences
    const updatedWatcher = await db.requestWatcher.update({
      where: { id: validatedData.watcherId },
      data: {
        notifyOnUpload: validatedData.notifyOnUpload ?? watcher.notifyOnUpload,
        notifyOnComment: validatedData.notifyOnComment ?? watcher.notifyOnComment,
        notifyOnStatus: validatedData.notifyOnStatus ?? watcher.notifyOnStatus,
        notifyOnDueDate: validatedData.notifyOnDueDate ?? watcher.notifyOnDueDate,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({ watcher: updatedWatcher });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating watcher preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
