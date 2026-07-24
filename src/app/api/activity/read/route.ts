import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/activity/read
 * Mark one or more of the current user's notifications as read.
 * Body: { activityIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const activityIds: unknown = body?.activityIds;

    const ids = Array.isArray(activityIds)
      ? activityIds.filter((id): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // Read state lives on the Notification model; scope to the current user.
    const result = await db.notification.updateMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error("Error marking activity as read:", error);
    return NextResponse.json(
      { error: "Failed to mark activity as read" },
      { status: 500 }
    );
  }
}
