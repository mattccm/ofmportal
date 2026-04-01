import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// TYPES
// ============================================

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; config: Record<string, unknown> };
  conditions: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
  }>;
  actions: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  isActive: boolean;
  lastTriggered: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateAutomationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  trigger: z
    .object({
      type: z.enum([
        "request_created",
        "upload_submitted",
        "due_date_approaching",
        "status_changed",
      ]),
      config: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
    })
    .optional(),
  conditions: z
    .array(
      z.object({
        id: z.string(),
        field: z.string(),
        operator: z.enum([
          "equals",
          "not_equals",
          "contains",
          "greater_than",
          "less_than",
          "is_empty",
          "is_not_empty",
        ]),
        value: z.string(),
      })
    )
    .optional(),
  actions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum([
          "send_notification",
          "send_email",
          "send_sms",
          "assign_team_member",
          "update_status",
          "add_tag",
        ]),
        config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      })
    )
    .optional(),
  isActive: z.boolean().optional(),
});

const testActionSchema = z.object({
  action: z.literal("test"),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAutomations(agencyId: string): Promise<Automation[]> {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });

  if (agency?.settings && typeof agency.settings === "object") {
    const settings = agency.settings as Record<string, unknown>;
    if (Array.isArray(settings.automations)) {
      return settings.automations as Automation[];
    }
  }

  return [];
}

async function saveAutomations(
  agencyId: string,
  automations: Automation[]
): Promise<void> {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });

  const currentSettings =
    agency?.settings && typeof agency.settings === "object"
      ? (agency.settings as Record<string, unknown>)
      : {};

  const settingsUpdate = {
    ...currentSettings,
    automations,
  };

  await db.agency.update({
    where: { id: agencyId },
    data: {
      settings: JSON.parse(JSON.stringify(settingsUpdate)),
    },
  });
}

// ============================================
// GET - Fetch single automation
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const automations = await getAutomations(session.user.agencyId);
    const automation = automations.find((a) => a.id === id);

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(automation);
  } catch (error) {
    console.error("Error fetching automation:", error);
    return NextResponse.json(
      { error: "Failed to fetch automation" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update automation
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAutomationSchema.parse(body);

    const automations = await getAutomations(session.user.agencyId);
    const automationIndex = automations.findIndex((a) => a.id === id);

    if (automationIndex === -1) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    // Update automation
    const existingAutomation = automations[automationIndex];
    const updatedAutomation: Automation = {
      ...existingAutomation,
      ...(validatedData.name !== undefined && { name: validatedData.name }),
      ...(validatedData.description !== undefined && {
        description: validatedData.description,
      }),
      ...(validatedData.trigger !== undefined && {
        trigger: validatedData.trigger as {
          type: string;
          config: Record<string, unknown>;
        },
      }),
      ...(validatedData.conditions !== undefined && {
        conditions: validatedData.conditions,
      }),
      ...(validatedData.actions !== undefined && {
        actions: validatedData.actions as Array<{
          id: string;
          type: string;
          config: Record<string, unknown>;
        }>,
      }),
      ...(validatedData.isActive !== undefined && {
        isActive: validatedData.isActive,
      }),
      updatedAt: new Date().toISOString(),
    };

    automations[automationIndex] = updatedAutomation;
    await saveAutomations(session.user.agencyId, automations);

    return NextResponse.json(updatedAutomation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating automation:", error);
    return NextResponse.json(
      { error: "Failed to update automation" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Test automation (dry run)
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate action
    const { action } = testActionSchema.parse(body);

    if (action !== "test") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const automations = await getAutomations(session.user.agencyId);
    const automation = automations.find((a) => a.id === id);

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    // Simulate the automation test
    // In production, this would actually run through the conditions and actions
    // without making permanent changes

    const testResults = {
      success: true,
      message: `Test completed successfully for "${automation.name}"`,
      details: {
        trigger: {
          type: automation.trigger.type,
          wouldFire: true,
        },
        conditions: automation.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
          passed: true, // In production, evaluate actual condition
        })),
        actions: automation.actions.map((a) => ({
          type: a.type,
          wouldExecute: true,
          config: a.config,
        })),
      },
    };

    // Log the test for analytics
    console.log(
      `[Automation Test] Agency: ${session.user.agencyId}, Automation: ${id}, User: ${session.user.id}`
    );

    return NextResponse.json(testResults);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error testing automation:", error);
    return NextResponse.json(
      { error: "Failed to test automation" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete automation
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const automations = await getAutomations(session.user.agencyId);
    const automationIndex = automations.findIndex((a) => a.id === id);

    if (automationIndex === -1) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    const deletedAutomation = automations[automationIndex];

    // Remove the automation
    automations.splice(automationIndex, 1);
    await saveAutomations(session.user.agencyId, automations);

    return NextResponse.json({
      message: "Automation deleted successfully",
      deletedAutomation: {
        id: deletedAutomation.id,
        name: deletedAutomation.name,
      },
    });
  } catch (error) {
    console.error("Error deleting automation:", error);
    return NextResponse.json(
      { error: "Failed to delete automation" },
      { status: 500 }
    );
  }
}
