import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  pauseRemindersForCreator,
  resumeRemindersForCreator,
  isRemindersPausedForCreator,
} from "@/lib/auto-reminder-scheduler";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const pauseSchema = z.object({
  reason: z.string().optional(),
  resumeAt: z.string().datetime().optional(),
});

// ============================================
// GET - Get pause status for a creator
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    const pauseStatus = await isRemindersPausedForCreator(
      session.user.agencyId,
      creatorId
    );

    return NextResponse.json({
      creatorId,
      creatorName: creator.name,
      ...pauseStatus,
    });
  } catch (error) {
    console.error("Error fetching pause status:", error);
    return NextResponse.json(
      { error: "Failed to fetch pause status" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Pause reminders for a creator
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER, ADMIN, or MANAGER)
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { reason, resumeAt } = pauseSchema.parse(body);

    await pauseRemindersForCreator(session.user.agencyId, creatorId, {
      reason,
      resumeAt: resumeAt ? new Date(resumeAt) : undefined,
    });

    const pauseStatus = await isRemindersPausedForCreator(
      session.user.agencyId,
      creatorId
    );

    return NextResponse.json({
      success: true,
      message: `Reminders paused for ${creator.name}`,
      pauseStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error pausing reminders:", error);
    return NextResponse.json(
      { error: "Failed to pause reminders" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Resume reminders for a creator
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: creatorId } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER, ADMIN, or MANAGER)
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    await resumeRemindersForCreator(session.user.agencyId, creatorId);

    return NextResponse.json({
      success: true,
      message: `Reminders resumed for ${creator.name}`,
    });
  } catch (error) {
    console.error("Error resuming reminders:", error);
    return NextResponse.json(
      { error: "Failed to resume reminders" },
      { status: 500 }
    );
  }
}
