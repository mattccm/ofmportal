import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { optionalPhone } from "@/lib/phone";
import type { Prisma } from "@prisma/client";
import { validateCreatorSession } from "@/lib/portal-auth";
import { cleanBrowserTimeZone } from "@/lib/due";
import { reanchorCreatorDueDates } from "@/lib/due-server";

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: optionalPhone,
  timezone: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  // Set true when the creator finishes (or skips) first-time onboarding.
  onboardingCompleted: z.boolean().optional(),
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
        onboardingCompletedAt: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Surface notification prefs (stored in contentPreferences JSON) as booleans
    const prefs =
      (creator.contentPreferences as Record<string, unknown>) || {};
    const notifications =
      (prefs.notifications as Record<string, unknown>) || {};

    return NextResponse.json({
      ...creator,
      emailNotifications: notifications.email !== false,
      smsNotifications: notifications.sms === true,
      onboardingCompleted: !!creator.onboardingCompletedAt,
    });
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

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;
    const updates = updateProfileSchema.parse(body);
    if (updates.timezone !== undefined && !cleanBrowserTimeZone(updates.timezone)) {
      return NextResponse.json({ error: "Choose a time zone from the list" }, { status: 400 });
    }
    const before = updates.timezone
      ? await db.creator.findUnique({ where: { id: authResult.creator.id }, select: { timezone: true } })
      : null;

    // Notification preferences are stored in the contentPreferences JSON field
    // (consistent with the communication-preferences API). Merge with existing.
    let contentPreferencesUpdate: Prisma.InputJsonValue | undefined;
    if (
      updates.emailNotifications !== undefined ||
      updates.smsNotifications !== undefined
    ) {
      const existing = await db.creator.findUnique({
        where: { id: authResult.creator.id },
        select: { contentPreferences: true },
      });
      const prefs =
        (existing?.contentPreferences as Record<string, unknown>) || {};
      const currentNotifications =
        (prefs.notifications as Record<string, unknown>) || {};

      contentPreferencesUpdate = {
        ...prefs,
        notifications: {
          ...currentNotifications,
          ...(updates.emailNotifications !== undefined && {
            email: updates.emailNotifications,
          }),
          ...(updates.smsNotifications !== undefined && {
            sms: updates.smsNotifications,
          }),
        },
      } as Prisma.InputJsonValue;
    }

    // Update creator profile
    const updatedCreator = await db.creator.update({
      where: { id: authResult.creator.id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.timezone && { timezone: updates.timezone }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
        ...(contentPreferencesUpdate !== undefined && {
          contentPreferences: contentPreferencesUpdate,
        }),
        // Mark onboarding complete the first time the creator finishes/skips it.
        ...(updates.onboardingCompleted === true && {
          onboardingCompletedAt: new Date(),
        }),
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

    // A new time zone keeps each open request's due day, ending at 23:59 there
    if (before && updates.timezone && updates.timezone !== before.timezone) {
      await reanchorCreatorDueDates(authResult.creator.id, updates.timezone, before.timezone);
    }

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
