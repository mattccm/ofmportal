import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// Validation schema for profile updates
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  email: z.string().email("Invalid email address").max(255, "Email is too long").optional(),
  phone: z.string().max(20, "Phone number is too long").nullable().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").nullable().optional(),
  timezone: z.string().max(50, "Invalid timezone").optional(),
  preferredLanguage: z.string().max(10, "Invalid language code").optional(),
  image: z.string().url("Invalid avatar URL").nullable().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// GET: Fetch current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        twoFactorEnabled: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        agency: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user settings from agency settings or defaults
    const agencySettings = user.agency?.id
      ? await db.agency.findUnique({
          where: { id: user.agency.id },
          select: { settings: true },
        })
      : null;

    // Parse settings JSON
    const settings = agencySettings?.settings as Record<string, unknown> | null;
    const userSettings = settings?.userSettings as Record<string, Record<string, unknown>> | null;
    const personalSettings = userSettings?.[user.id] || {};

    return NextResponse.json({
      ...user,
      bio: personalSettings?.bio || null,
      timezone: personalSettings?.timezone || "America/New_York",
      preferredLanguage: personalSettings?.preferredLanguage || "en",
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH: Update profile fields
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get current user to check role
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Separate user fields from settings
    const userFields: { name?: string; email?: string; phone?: string | null; image?: string | null } = {};
    const settingsFields: { bio?: string | null; timezone?: string; preferredLanguage?: string } = {};

    if (data.name !== undefined) userFields.name = data.name;
    if (data.phone !== undefined) userFields.phone = data.phone;
    if (data.image !== undefined) userFields.image = data.image;

    // Only OWNER role can change their email
    if (data.email !== undefined && data.email !== currentUser.email) {
      if (currentUser.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only account owners can change their email address" },
          { status: 403 }
        );
      }

      // Check if email is already in use
      const existingUser = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "This email address is already in use" },
          { status: 400 }
        );
      }

      userFields.email = data.email.toLowerCase();
    }
    if (data.bio !== undefined) settingsFields.bio = data.bio;
    if (data.timezone !== undefined) settingsFields.timezone = data.timezone;
    if (data.preferredLanguage !== undefined) settingsFields.preferredLanguage = data.preferredLanguage;

    // Update user record
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: userFields,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        agencyId: true,
        twoFactorEnabled: true,
        updatedAt: true,
      },
    });

    // Update settings in agency settings JSON if there are settings fields to update
    if (Object.keys(settingsFields).length > 0 && updatedUser.agencyId) {
      const agency = await db.agency.findUnique({
        where: { id: updatedUser.agencyId },
        select: { settings: true },
      });

      // Safely parse and rebuild settings object
      const currentSettingsObj = (agency?.settings && typeof agency.settings === "object")
        ? agency.settings as Record<string, unknown>
        : {};

      const currentUserSettingsObj = (currentSettingsObj.userSettings && typeof currentSettingsObj.userSettings === "object")
        ? currentSettingsObj.userSettings as Record<string, Record<string, unknown>>
        : {};

      const currentPersonalSettingsObj = currentUserSettingsObj[session.user.id] || {};

      // Build new personal settings without undefined values
      const newPersonalSettings: Record<string, string | null> = { ...currentPersonalSettingsObj as Record<string, string | null> };
      if (settingsFields.bio !== undefined) newPersonalSettings.bio = settingsFields.bio;
      if (settingsFields.timezone !== undefined) newPersonalSettings.timezone = settingsFields.timezone;
      if (settingsFields.preferredLanguage !== undefined) newPersonalSettings.preferredLanguage = settingsFields.preferredLanguage;

      // Build final settings object
      const newUserSettings = {
        ...currentUserSettingsObj,
        [session.user.id]: newPersonalSettings,
      };

      const newSettings = {
        ...currentSettingsObj,
        userSettings: newUserSettings,
      };

      // Use JSON round-trip to ensure clean serialization
      await db.agency.update({
        where: { id: updatedUser.agencyId },
        data: { settings: JSON.parse(JSON.stringify(newSettings)) as Prisma.InputJsonValue },
      });
    }

    // Return updated profile
    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        ...settingsFields,
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
