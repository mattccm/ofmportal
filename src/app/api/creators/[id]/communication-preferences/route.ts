import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, forbidden, requireAccess } from "@/lib/access/server";
import { cleanBrowserTimeZone } from "@/lib/due";
import { reanchorCreatorDueDates } from "@/lib/due-server";
import { scrubCommunication } from "../../creator-access";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// COMMUNICATION PREFERENCES API

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
    const gate = await requireAccess("creators.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;
    if (!access.has("creatorInfo.preferences")) return forbidden("creatorInfo.preferences");

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
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
    // (only the fields this person may see)
    const prefs = creator.contentPreferences as Record<string, unknown>;
    const communicationPreferences = prefs?.communicationPreferences || null;

    // If no preferences exist, return defaults with creator's existing contact info
    if (!communicationPreferences) {
      return NextResponse.json(scrubCommunication(access, {
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
      }));
    }

    return NextResponse.json(scrubCommunication(access, communicationPreferences as Record<string, unknown>));
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
    const gate = await requireAccess("creators.edit");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;
    if (!access.has("creatorInfo.preferences")) return forbidden("creatorInfo.preferences");

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      select: {
        id: true,
        contentPreferences: true,
        timezone: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedPrefs = communicationPreferencesSchema.parse(body);

    // Get existing contentPreferences
    const existingPrefs = (creator.contentPreferences as Record<string, unknown>) || {};

    // Details this person can't see are kept as they were, never overwritten
    const prevComm = (existingPrefs.communicationPreferences as Record<string, unknown> | undefined) ?? {};
    const prevDetails = (prevComm.contactDetails as Record<string, string | undefined> | undefined) ?? {};
    if (!access.has("creatorInfo.email")) validatedPrefs.contactDetails.email = prevDetails.email;
    if (!access.has("creatorInfo.phone")) {
      validatedPrefs.contactDetails.phone = prevDetails.phone;
      validatedPrefs.contactDetails.whatsapp = prevDetails.whatsapp;
    }
    const canSetTimezone = access.has("creatorInfo.location") && !!cleanBrowserTimeZone(validatedPrefs.timezone);
    if (!canSetTimezone) validatedPrefs.timezone = (prevComm.timezone as string | undefined) ?? creator.timezone ?? "UTC";

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
        // Also update the main timezone field if provided (and theirs to change)
        ...(canSetTimezone ? { timezone: validatedPrefs.timezone } : {}),
      },
    });

    // A new time zone keeps each open request's due day, ending at the new zone's 23:59
    if (canSetTimezone && validatedPrefs.timezone !== creator.timezone) {
      await reanchorCreatorDueDates(id, validatedPrefs.timezone, creator.timezone);
    }

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
      preferences: scrubCommunication(access, validatedPrefs),
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
