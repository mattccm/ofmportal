import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/activity/read-all
 * Mark all of the current user's notifications as read.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read state lives on the Notification model; scope to the current user.
    const result = await db.notification.updateMany({
      where: {
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error("Error marking all activity as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all activity as read" },
      { status: 500 }
    );
  }
}
