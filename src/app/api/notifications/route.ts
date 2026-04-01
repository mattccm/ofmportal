import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserNotifications,
  markAsRead,
  markAsUnread,
  markMultipleAsRead,
  markMultipleAsUnread,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  NotificationType,
} from "@/lib/notifications";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  unreadOnly: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  types: z
    .string()
    .optional()
    .transform((val) =>
      val ? (val.split(",") as NotificationType[]) : undefined
    ),
});

const patchNotificationsSchema = z.union([
  z.object({
    notificationIds: z.array(z.string()).min(1),
    markAsUnread: z.literal(true).optional(),
  }),
  z.object({
    markAllAsRead: z.literal(true),
  }),
]);

const deleteNotificationsSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

// ============================================
// GET - Fetch user's notifications
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      unreadOnly: searchParams.get("unreadOnly"),
      types: searchParams.get("types"),
    };

    const validatedQuery = getNotificationsQuerySchema.parse({
      limit: queryParams.limit || undefined,
      offset: queryParams.offset || undefined,
      unreadOnly: queryParams.unreadOnly || undefined,
      types: queryParams.types || undefined,
    });

    const result = await getUserNotifications(session.user.id, {
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      unreadOnly: validatedQuery.unreadOnly,
      types: validatedQuery.types,
    });

    return NextResponse.json({
      notifications: result.notifications,
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Mark notifications as read
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = patchNotificationsSchema.parse(body);

    let markedCount = 0;

    if ("markAllAsRead" in validatedData && validatedData.markAllAsRead) {
      // Mark all notifications as read for the user
      markedCount = await markAllAsRead(session.user.id);
    } else if ("notificationIds" in validatedData) {
      const { notificationIds, markAsUnread: shouldMarkUnread } = validatedData;

      // Mark specific notifications as read or unread
      // Note: In a production app, you'd want to verify ownership of each notification
      if (shouldMarkUnread) {
        // Mark as unread
        if (notificationIds.length === 1) {
          const success = await markAsUnread(notificationIds[0]);
          markedCount = success ? 1 : 0;
        } else {
          markedCount = await markMultipleAsUnread(notificationIds);
        }
      } else {
        // Mark as read
        if (notificationIds.length === 1) {
          const success = await markAsRead(notificationIds[0]);
          markedCount = success ? 1 : 0;
        } else {
          markedCount = await markMultipleAsRead(notificationIds);
        }
      }
    }

    return NextResponse.json({
      success: true,
      markedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete notifications
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for single notification deletion via query param
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get("id");

    if (singleId) {
      // Delete single notification
      const success = await deleteNotification(singleId, session.user.id);

      if (!success) {
        return NextResponse.json(
          { error: "Notification not found or already deleted" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        deletedCount: 1,
      });
    }

    // Bulk delete via request body
    const body = await req.json();
    const validatedData = deleteNotificationsSchema.parse(body);

    const deletedCount = await deleteMultipleNotifications(
      validatedData.notificationIds,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
