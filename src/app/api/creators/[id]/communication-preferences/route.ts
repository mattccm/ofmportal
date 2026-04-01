import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// ============================================
// COMMUNICATION PREFERENCES API
// ============================================

// Validation schemas
const contactDetailsSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  telegram: z.string().optional(),
  discord: z.string().optional(),
});

const quietPeriodSchema = z.object({
  id: z.string(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  reason: z.string().optional(),
  autoReply: z.string().optional(),
});

const communicationPreferencesSchema = z.object({
  primaryMethod: z.enum(["email", "sms", "whatsapp", "telegram", "discord", "in_app", "phone"]),
  secondaryMethod: z.enum(["email", "sms", "whatsapp", "telegram", "discord", "in_app", "phone"]).optional(),
  contactDetails: contactDetailsSchema,
  timezone: z.string(),
  preferredHours: z.object({
    start: z.string(),
    end: z.string(),
  }),
  availableDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])),
  expectedResponseTime: z.enum(["immediate", "same_day", "next_day", "within_week", "flexible"]),
  primaryLanguage: z.string(),
  secondaryLanguages: z.array(z.string()).optional(),
  notifyOnNewRequest: z.boolean(),
  notifyOnDeadlineReminder: z.boolean(),
  notifyOnFeedback: z.boolean(),
  notifyOnApproval: z.boolean(),
  quietPeriods: z.array(quietPeriodSchema),
  communicationNotes: z.string().optional(),
});

// GET - Fetch communication preferences for a creator
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        contentPreferences: true,
        email: true,
        phone: true,
        timezone: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Extract communication preferences from contentPreferences JSON
    const prefs = creator.contentPreferences as Record<string, unknown>;
    const communicationPreferences = prefs?.communicationPreferences || null;

    // If no preferences exist, return defaults with creator's existing contact info
    if (!communicationPreferences) {
      return NextResponse.json({
        primaryMethod: "email",
        secondaryMethod: null,
        contactDetails: {
          email: creator.email,
          phone: creator.phone || undefined,
        },
        timezone: creator.timezone || "UTC",
        preferredHours: {
          start: "09:00",
          end: "18:00",
        },
        availableDays: ["mon", "tue", "wed", "thu", "fri"],
        expectedResponseTime: "same_day",
        primaryLanguage: "English",
        secondaryLanguages: [],
        notifyOnNewRequest: true,
        notifyOnDeadlineReminder: true,
        notifyOnFeedback: true,
        notifyOnApproval: true,
        quietPeriods: [],
        communicationNotes: "",
      });
    }

    return NextResponse.json(communicationPreferences);
  } catch (error) {
    console.error("Error fetching communication preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch communication preferences" },
      { status: 500 }
    );
  }
}

// PUT - Update communication preferences for a creator
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        contentPreferences: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedPrefs = communicationPreferencesSchema.parse(body);

    // Get existing contentPreferences
    const existingPrefs = (creator.contentPreferences as Record<string, unknown>) || {};

    // Update with new communication preferences
    const updatedPrefs = {
      ...existingPrefs,
      communicationPreferences: {
        ...validatedPrefs,
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      },
    };

    // Update creator
    await db.creator.update({
      where: { id },
      data: {
        contentPreferences: updatedPrefs as unknown as Prisma.InputJsonValue,
        // Also update the main timezone field if provided
        timezone: validatedPrefs.timezone,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.communication_preferences_updated",
        entityType: "Creator",
        entityId: id,
        metadata: {
          primaryMethod: validatedPrefs.primaryMethod,
          secondaryMethod: validatedPrefs.secondaryMethod,
          timezone: validatedPrefs.timezone,
        },
      },
    });

    return NextResponse.json({
      message: "Communication preferences updated successfully",
      preferences: validatedPrefs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid preferences data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating communication preferences:", error);
    return NextResponse.json(
      { error: "Failed to update communication preferences" },
      { status: 500 }
    );
  }
}
