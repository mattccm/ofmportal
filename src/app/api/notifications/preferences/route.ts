import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/types/notification-preferences";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const categoryChannelSettingsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
});

const categorySettingsSchema = z.object({
  enabled: z.boolean(),
  channels: categoryChannelSettingsSchema,
  frequency: z.enum(["instant", "daily", "weekly"]),
});

const quietHoursSettingsSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().optional().default("UTC"),
});

const notificationPreferencesSchema = z.object({
  categories: z.object({
    uploads: categorySettingsSchema,
    requests: categorySettingsSchema,
    reminders: categorySettingsSchema,
    team: categorySettingsSchema,
    system: categorySettingsSchema,
  }),
  doNotDisturb: z.boolean(),
  quietHours: quietHoursSettingsSchema,
  notificationSound: z.enum([
    "default",
    "chime",
    "bell",
    "ping",
    "subtle",
    "none",
  ]),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get notification preferences from user's preferences JSON field
 */
async function getUserNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Parse the preferences JSON field
  const userPreferences = (user.preferences as Record<string, unknown>) || {};
  const notificationPrefs = userPreferences.notifications as
    | NotificationPreferences
    | undefined;

  // Merge with defaults to ensure all fields exist
  if (notificationPrefs) {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...notificationPrefs,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...notificationPrefs.categories,
      },
      quietHours: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
        ...notificationPrefs.quietHours,
      },
    };
  }

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

/**
 * Save notification preferences to user's preferences JSON field
 */
async function saveUserNotificationPreferences(
  userId: string,
  notificationPrefs: NotificationPreferences
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const currentPreferences = (user.preferences as Record<string, unknown>) || {};

  // Update the notifications key within preferences
  // Use JSON.parse(JSON.stringify()) to ensure plain JSON compatibility with Prisma
  const updatedPreferences = JSON.parse(JSON.stringify({
    ...currentPreferences,
    notifications: {
      ...notificationPrefs,
      updatedAt: new Date().toISOString(),
    },
  }));

  await db.user.update({
    where: { id: userId },
    data: { preferences: updatedPreferences },
  });
}

// ============================================
// GET - Fetch user's notification preferences
// ============================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getUserNotificationPreferences(session.user.id);

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update user's notification preferences
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Validate the request body
    const validationResult = notificationPreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid notification preferences",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const preferences = validationResult.data as NotificationPreferences;

    // Save the preferences
    await saveUserNotificationPreferences(session.user.id, preferences);

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Partially update notification preferences
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Get current preferences
    const currentPreferences = await getUserNotificationPreferences(
      session.user.id
    );

    // Deep merge the updates with current preferences
    const updatedPreferences: NotificationPreferences = {
      ...currentPreferences,
      ...body,
      categories: body.categories
        ? {
            ...currentPreferences.categories,
            ...body.categories,
          }
        : currentPreferences.categories,
      quietHours: body.quietHours
        ? {
            ...currentPreferences.quietHours,
            ...body.quietHours,
          }
        : currentPreferences.quietHours,
    };

    // Validate the merged result
    const validationResult =
      notificationPreferencesSchema.safeParse(updatedPreferences);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid notification preferences after merge",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    // Save the preferences
    await saveUserNotificationPreferences(session.user.id, updatedPreferences);

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error("Error patching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
