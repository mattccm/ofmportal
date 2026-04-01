import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, verifyPassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const generateCodesSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

// Generate backup codes
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = randomBytes(4)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join("-") || randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

// POST /api/auth/2fa/backup-codes - Generate new backup codes
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { password } = generateCodesSchema.parse(body);

    // Verify user's password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, twoFactorEnabled: true, preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 400 }
      );
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        code: await hashPassword(code),
        used: false,
        createdAt: new Date().toISOString(),
      }))
    );

    // Store hashed codes in user preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPreferences = {
      ...currentPrefs,
      backupCodes: hashedBackupCodes,
      backupCodesGeneratedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    await db.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences },
    });

    // Log the security event
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "2fa.backup_codes_generated",
        entityType: "User",
        entityId: session.user.id,
        metadata: { codesGenerated: backupCodes.length },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({
      codes: backupCodes,
      message: "Backup codes generated. Save these codes in a safe place - they can only be viewed once!",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Generate backup codes error:", error);
    return NextResponse.json(
      { error: "Failed to generate backup codes" },
      { status: 500 }
    );
  }
}

// GET /api/auth/2fa/backup-codes - Get backup codes status (not the codes themselves)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = (user.preferences as Record<string, unknown>) || {};
    const backupCodes = (preferences.backupCodes as Array<{ used: boolean }>) || [];
    const generatedAt = preferences.backupCodesGeneratedAt as string | undefined;

    const totalCodes = backupCodes.length;
    const usedCodes = backupCodes.filter((code) => code.used).length;
    const remainingCodes = totalCodes - usedCodes;

    return NextResponse.json({
      hasBackupCodes: totalCodes > 0,
      totalCodes,
      usedCodes,
      remainingCodes,
      generatedAt,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    console.error("Get backup codes status error:", error);
    return NextResponse.json(
      { error: "Failed to get backup codes status" },
      { status: 500 }
    );
  }
}
