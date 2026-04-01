import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const markStepCompleteSchema = z.object({
  stepKey: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// ONBOARDING STEP DEFINITIONS
// ============================================

const AGENCY_ONBOARDING_STEPS = [
  "agency_setup",
  "invite_team",
  "create_creator",
  "create_request",
  "dashboard_tour",
  "agency_onboarding_complete",
];

const CREATOR_ONBOARDING_STEPS = [
  "creator_profile",
  "upload_preferences",
  "notification_preferences",
  "portal_tour",
  "creator_onboarding_complete",
];

// ============================================
// GET - Fetch user's onboarding progress
// ============================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all completed onboarding steps for the user
    const completedSteps = await db.onboardingStep.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        stepKey: true,
        completedAt: true,
        data: true,
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    // Determine if onboarding is complete based on role
    const userRole = session.user.role;
    const relevantSteps =
      userRole === "OWNER" || userRole === "ADMIN"
        ? AGENCY_ONBOARDING_STEPS
        : CREATOR_ONBOARDING_STEPS;

    const completedStepKeys = completedSteps.map((s) => s.stepKey);
    const isComplete = relevantSteps.every((step) =>
      completedStepKeys.includes(step)
    );

    // Get user's onboardingCompleted flag
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true },
    });

    return NextResponse.json({
      completedSteps: completedStepKeys,
      steps: completedSteps,
      isComplete: isComplete || user?.onboardingCompleted || false,
      totalSteps: relevantSteps.length,
      progress: Math.round(
        (completedStepKeys.filter((k) => relevantSteps.includes(k)).length /
          relevantSteps.length) *
          100
      ),
    });
  } catch (error) {
    console.error("Error fetching onboarding progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding progress" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Mark a step as complete
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = markStepCompleteSchema.parse(body);

    // Check if step already exists
    const existingStep = await db.onboardingStep.findUnique({
      where: {
        userId_stepKey: {
          userId: session.user.id,
          stepKey: validatedData.stepKey,
        },
      },
    });

    if (existingStep) {
      // Step already completed, return success
      return NextResponse.json({
        success: true,
        message: "Step already completed",
        stepKey: validatedData.stepKey,
        completedAt: existingStep.completedAt,
      });
    }

    // Create the onboarding step record
    const step = await db.onboardingStep.create({
      data: {
        userId: session.user.id,
        stepKey: validatedData.stepKey,
        data: (validatedData.data || {}) as object,
      },
    });

    // Check if this completes onboarding
    const userRole = session.user.role;
    const relevantSteps =
      userRole === "OWNER" || userRole === "ADMIN"
        ? AGENCY_ONBOARDING_STEPS
        : CREATOR_ONBOARDING_STEPS;

    const completedSteps = await db.onboardingStep.findMany({
      where: {
        userId: session.user.id,
        stepKey: { in: relevantSteps },
      },
      select: { stepKey: true },
    });

    const completedStepKeys = completedSteps.map((s) => s.stepKey);
    const isComplete = relevantSteps.every((step) =>
      completedStepKeys.includes(step)
    );

    // Update user's onboardingCompleted flag if all steps are done
    if (isComplete) {
      await db.user.update({
        where: { id: session.user.id },
        data: { onboardingCompleted: true },
      });
    }

    return NextResponse.json({
      success: true,
      stepKey: validatedData.stepKey,
      completedAt: step.completedAt,
      isComplete,
      progress: Math.round(
        (completedStepKeys.length / relevantSteps.length) * 100
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error marking step complete:", error);
    return NextResponse.json(
      { error: "Failed to mark step complete" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Reset onboarding progress (for testing)
// ============================================

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow in development or for owners
    const isDevelopment = process.env.NODE_ENV === "development";
    const isOwner = session.user.role === "OWNER";

    if (!isDevelopment && !isOwner) {
      return NextResponse.json(
        { error: "Not allowed in production" },
        { status: 403 }
      );
    }

    // Delete all onboarding steps for the user
    const result = await db.onboardingStep.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    // Reset the user's onboardingCompleted flag
    await db.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: false },
    });

    return NextResponse.json({
      success: true,
      message: "Onboarding progress reset",
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Error resetting onboarding:", error);
    return NextResponse.json(
      { error: "Failed to reset onboarding" },
      { status: 500 }
    );
  }
}
