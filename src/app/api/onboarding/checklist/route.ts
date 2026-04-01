import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  AGENCY_CHECKLIST_TASKS,
  CHECKLIST_STORAGE_KEY,
  calculateCompletionPercentage,
  isChecklistComplete,
  type AgencyChecklistState,
  type ChecklistStatus,
} from "@/lib/onboarding-tasks";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const markTaskCompleteSchema = z.object({
  taskId: z.string().min(1).max(100),
});

const dismissChecklistSchema = z.object({
  dismissed: z.boolean(),
});

// ============================================
// AUTO-DETECTION FUNCTIONS
// ============================================

async function autoDetectTaskCompletion(
  userId: string,
  agencyId: string
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  try {
    // Check profile completion (has name and avatar)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, avatar: true, bio: true },
    });
    results.set(
      "complete_profile",
      !!(user?.name && user?.name.length > 0 && (user?.avatar || user?.bio))
    );

    // Check if creator has been invited
    const creatorCount = await db.creator.count({
      where: { agencyId },
    });
    results.set("invite_creator", creatorCount > 0);

    // Check if template exists
    const templateCount = await db.requestTemplate.count({
      where: { agencyId },
    });
    results.set("create_template", templateCount > 0);

    // Check if request has been sent
    const requestCount = await db.contentRequest.count({
      where: { agencyId },
    });
    results.set("send_request", requestCount > 0);

    // Check if user has reviewed an upload
    const reviewedUploadCount = await db.upload.count({
      where: {
        reviewedById: userId,
        status: { in: ["APPROVED", "REJECTED"] },
      },
    });
    results.set("review_upload", reviewedUploadCount > 0);

    // Check if team member has been invited (more than one user in agency)
    const teamMemberCount = await db.user.count({
      where: { agencyId },
    });
    results.set("invite_team_member", teamMemberCount > 1);

    // Check if branding has been set up (agency has logo or custom settings)
    const agency = await db.agency.findUnique({
      where: { id: agencyId },
      select: { logo: true, settings: true },
    });
    const settings = agency?.settings as Record<string, unknown> | null;
    const hasBranding =
      !!agency?.logo ||
      (settings &&
        (settings.primaryColor ||
          settings.brandName ||
          settings.customTheme));
    results.set("setup_branding", !!hasBranding);
  } catch (error) {
    console.error("Error auto-detecting task completion:", error);
  }

  return results;
}

// ============================================
// GET - Fetch checklist status
// ============================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, agencyId } = session.user;

    // Get user preferences to check for stored checklist state
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = user?.preferences as Record<string, unknown> | null;
    const storedState = preferences?.[CHECKLIST_STORAGE_KEY] as
      | Partial<AgencyChecklistState>
      | undefined;

    // Auto-detect task completion from database
    const autoDetectedTasks = await autoDetectTaskCompletion(userId, agencyId);

    // Merge stored state with auto-detected state
    const taskStatuses: ChecklistStatus[] = AGENCY_CHECKLIST_TASKS.map((task) => {
      const storedTask = storedState?.tasks?.find((t) => t.taskId === task.id);
      const autoDetected = autoDetectedTasks.get(task.id) || false;

      // Task is complete if either manually marked or auto-detected
      const completed = storedTask?.completed || autoDetected;

      return {
        taskId: task.id,
        completed,
        completedAt: storedTask?.completedAt
          ? new Date(storedTask.completedAt)
          : autoDetected
            ? new Date()
            : undefined,
        autoDetected: autoDetected && !storedTask?.completed,
      };
    });

    const completedTaskIds = taskStatuses
      .filter((t) => t.completed)
      .map((t) => t.taskId);

    const checklistState: AgencyChecklistState = {
      tasks: taskStatuses,
      dismissed: storedState?.dismissed || false,
      dismissedAt: storedState?.dismissedAt
        ? new Date(storedState.dismissedAt)
        : undefined,
      completionPercentage: calculateCompletionPercentage(completedTaskIds),
      isComplete: isChecklistComplete(completedTaskIds),
    };

    return NextResponse.json(checklistState);
  } catch (error) {
    console.error("Error fetching checklist status:", error);
    return NextResponse.json(
      { error: "Failed to fetch checklist status" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Mark task as complete
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, agencyId } = session.user;
    const body = await req.json();
    const { taskId } = markTaskCompleteSchema.parse(body);

    // Validate task ID
    const validTask = AGENCY_CHECKLIST_TASKS.find((t) => t.id === taskId);
    if (!validTask) {
      return NextResponse.json(
        { error: "Invalid task ID" },
        { status: 400 }
      );
    }

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const currentState = (preferences[CHECKLIST_STORAGE_KEY] as Partial<AgencyChecklistState>) || {
      tasks: [],
      dismissed: false,
    };

    // Update task status
    const existingTaskIndex = currentState.tasks?.findIndex(
      (t) => t.taskId === taskId
    );
    const now = new Date();

    if (existingTaskIndex !== undefined && existingTaskIndex >= 0 && currentState.tasks) {
      currentState.tasks[existingTaskIndex] = {
        taskId,
        completed: true,
        completedAt: now,
        autoDetected: false,
      };
    } else {
      currentState.tasks = [
        ...(currentState.tasks || []),
        {
          taskId,
          completed: true,
          completedAt: now,
          autoDetected: false,
        },
      ];
    }

    // Calculate new completion status
    const completedTaskIds = currentState.tasks
      .filter((t) => t.completed)
      .map((t) => t.taskId);

    // Merge with auto-detected tasks
    const autoDetectedTasks = await autoDetectTaskCompletion(userId, agencyId);
    autoDetectedTasks.forEach((completed, id) => {
      if (completed && !completedTaskIds.includes(id)) {
        completedTaskIds.push(id);
      }
    });

    const completionPercentage = calculateCompletionPercentage(completedTaskIds);
    const isComplete = isChecklistComplete(completedTaskIds);

    // Update user preferences
    const updatedPreferences = {
      ...preferences,
      [CHECKLIST_STORAGE_KEY]: {
        ...currentState,
        completionPercentage,
        isComplete,
      },
    };

    await db.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    // Also mark as onboarding step if this is a key milestone
    const stepKey = `checklist_${taskId}`;
    await db.onboardingStep.upsert({
      where: {
        userId_stepKey: { userId, stepKey },
      },
      create: {
        userId,
        stepKey,
        data: { taskId, completedVia: "checklist" },
      },
      update: {
        data: { taskId, completedVia: "checklist", updatedAt: now },
      },
    });

    return NextResponse.json({
      success: true,
      taskId,
      completedAt: now,
      completionPercentage,
      isComplete,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error marking task complete:", error);
    return NextResponse.json(
      { error: "Failed to mark task complete" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Dismiss checklist
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = session.user;
    const body = await req.json();
    const { dismissed } = dismissChecklistSchema.parse(body);

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const currentState = (preferences[CHECKLIST_STORAGE_KEY] as Partial<AgencyChecklistState>) || {
      tasks: [],
      dismissed: false,
    };

    const now = new Date();

    // Update dismissed state
    const updatedState: Partial<AgencyChecklistState> = {
      ...currentState,
      dismissed,
      dismissedAt: dismissed ? now : undefined,
    };

    // Update user preferences
    const updatedPreferences = {
      ...preferences,
      [CHECKLIST_STORAGE_KEY]: updatedState,
    };

    await db.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    // Mark checklist dismissed as onboarding step
    if (dismissed) {
      await db.onboardingStep.upsert({
        where: {
          userId_stepKey: { userId, stepKey: "checklist_dismissed" },
        },
        create: {
          userId,
          stepKey: "checklist_dismissed",
          data: { dismissedAt: now },
        },
        update: {
          data: { dismissedAt: now },
        },
      });
    }

    return NextResponse.json({
      success: true,
      dismissed,
      dismissedAt: dismissed ? now : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error dismissing checklist:", error);
    return NextResponse.json(
      { error: "Failed to dismiss checklist" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Reset checklist (for testing/dev)
// ============================================

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Only available in development" },
        { status: 403 }
      );
    }

    const { id: userId } = session.user;

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as Record<string, unknown>) || {};

    // Remove checklist state from preferences
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [CHECKLIST_STORAGE_KEY]: _, ...restPreferences } = preferences;

    await db.user.update({
      where: { id: userId },
      data: {
        preferences: restPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    // Delete checklist-related onboarding steps
    await db.onboardingStep.deleteMany({
      where: {
        userId,
        stepKey: { startsWith: "checklist_" },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Checklist reset successfully",
    });
  } catch (error) {
    console.error("Error resetting checklist:", error);
    return NextResponse.json(
      { error: "Failed to reset checklist" },
      { status: 500 }
    );
  }
}
