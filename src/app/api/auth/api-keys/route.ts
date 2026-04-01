import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  expiresIn: z.enum(["30d", "90d", "1y", "never"]).optional(),
});

// Generate a secure API key
function generateApiKey(): string {
  const prefix = "cp"; // content portal
  const key = randomBytes(32).toString("hex");
  return `${prefix}_${key}`;
}

// Hash API key for storage (simple hash, in production use bcrypt)
function hashApiKey(key: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(key).digest("hex");
}

// GET /api/auth/api-keys - Get all API keys for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Note: API keys would need a dedicated table in the database
    // For now, we'll use the user's preferences JSON field as a simple store
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const apiKeys = (preferences.apiKeys as Array<{
      id: string;
      name: string;
      prefix: string;
      createdAt: string;
      expiresAt: string | null;
      lastUsedAt: string | null;
    }>) || [];

    // Return keys without the actual key value (only prefix and metadata)
    return NextResponse.json({
      keys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
      })),
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    return NextResponse.json(
      { error: "Failed to get API keys" },
      { status: 500 }
    );
  }
}

// POST /api/auth/api-keys - Create a new API key
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, expiresIn } = createKeySchema.parse(body);

    // Generate the API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    const keyId = randomBytes(8).toString("hex");

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (expiresIn && expiresIn !== "never") {
      expiresAt = new Date();
      switch (expiresIn) {
        case "30d":
          expiresAt.setDate(expiresAt.getDate() + 30);
          break;
        case "90d":
          expiresAt.setDate(expiresAt.getDate() + 90);
          break;
        case "1y":
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
      }
    }

    // Get current preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const apiKeys = (preferences.apiKeys as Array<Record<string, unknown>>) || [];

    // Add new key
    const newKey = {
      id: keyId,
      name,
      prefix: apiKey.slice(0, 10) + "...",
      hashedKey,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() || null,
      lastUsedAt: null,
    };

    apiKeys.push(newKey);

    // Update user preferences
    const updatedPreferences = { ...preferences, apiKeys } as unknown as Prisma.InputJsonValue;
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPreferences,
      },
    });

    // Log the security event
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "api_key.created",
        entityType: "ApiKey",
        entityId: keyId,
        metadata: { name },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({
      key: {
        id: keyId,
        name,
        apiKey, // Only returned once during creation
        prefix: apiKey.slice(0, 10) + "...",
        createdAt: newKey.createdAt,
        expiresAt: newKey.expiresAt,
      },
      message: "API key created. Make sure to copy it now - you won't be able to see it again!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/api-keys - Revoke an API key
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId } = await req.json();

    if (!keyId) {
      return NextResponse.json(
        { error: "Key ID is required" },
        { status: 400 }
      );
    }

    // Get current preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const apiKeys = (preferences.apiKeys as Array<{ id: string; name?: string }>) || [];

    // Find and remove the key
    const keyIndex = apiKeys.findIndex((key) => key.id === keyId);

    if (keyIndex === -1) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    const removedKey = apiKeys.splice(keyIndex, 1)[0];

    // Update user preferences
    const updatedPrefsDelete = { ...preferences, apiKeys } as unknown as Prisma.InputJsonValue;
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefsDelete,
      },
    });

    // Log the security event
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "api_key.revoked",
        entityType: "ApiKey",
        entityId: keyId,
        metadata: { name: removedKey.name },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({ message: "API key revoked" });
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
