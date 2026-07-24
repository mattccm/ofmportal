import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/activity/unread-count
 * Return the number of unread notifications for the current user.
 * Response: { count: number }
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read state lives on the Notification model; scope to the current user.
    const count = await db.notification.count({
      where: {
        userId: session.user.id,
        readAt: null,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching unread activity count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
