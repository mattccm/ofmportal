import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateCreatorSession } from "@/lib/portal-auth";

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
});

// GET - Get creator profile
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }

    const creator = await db.creator.findUnique({
      where: { id: authResult.creator.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        timezone: true,
        preferredContact: true,
        contentPreferences: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    return NextResponse.json(creator);
  } catch (error) {
    console.error("Error fetching creator profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT - Update creator profile
export async function PUT(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }

    const body = await req.json();
    const updates = updateProfileSchema.parse(body);

    // Update creator profile
    const updatedCreator = await db.creator.update({
      where: { id: authResult.creator.id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.timezone && { timezone: updates.timezone }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        timezone: true,
        preferredContact: true,
      },
    });

    return NextResponse.json(updatedCreator);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating creator profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
