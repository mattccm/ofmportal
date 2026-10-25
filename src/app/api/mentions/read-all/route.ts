import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";

// POST /api/mentions/read-all - Mark all mentions as read

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { session } = gate;

    const result = await db.mention.updateMany({
      where: {
        mentionedUserId: session.user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error("Failed to mark all mentions as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all as read" },
      { status: 500 }
    );
  }
}
