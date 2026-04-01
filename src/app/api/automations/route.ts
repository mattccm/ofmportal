import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const conditionSchema = z.object({
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
});

const actionSchema = z.object({
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
});

const createAutomationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  trigger: z.object({
    type: z.enum([
      "request_created",
      "upload_submitted",
      "due_date_approaching",
      "status_changed",
    ]),
    config: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  }),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1, "At least one action is required"),
  isActive: z.boolean().default(true),
});

const listAutomationsSchema = z.object({
  isActive: z.enum(["true", "false"]).optional(),
  triggerType: z
    .enum([
      "request_created",
      "upload_submitted",
      "due_date_approaching",
      "status_changed",
    ])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// ============================================
// GET - List all automations for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = listAutomationsSchema.parse({
      isActive: searchParams.get("isActive") || undefined,
      triggerType: searchParams.get("triggerType") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 50,
    });

    // Build the where clause
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    if (params.isActive !== undefined) {
      where.isActive = params.isActive === "true";
    }

    if (params.triggerType) {
      where.triggerType = params.triggerType;
    }

    // Fetch automations from database
    // Note: We're using a JSON field to store automation config since
    // the schema doesn't have an Automation model yet
    // In production, you would create a proper Automation model

    // For now, we'll use the agency settings to store automations
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { settings: true },
    });

    // Parse automations from settings
    let automations: Array<{
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
    }> = [];

    if (agency?.settings && typeof agency.settings === "object") {
      const settings = agency.settings as Record<string, unknown>;
      if (Array.isArray(settings.automations)) {
        automations = settings.automations as typeof automations;
      }
    }

    // Apply filters
    if (params.isActive !== undefined) {
      const isActiveFilter = params.isActive === "true";
      automations = automations.filter((a) => a.isActive === isActiveFilter);
    }

    if (params.triggerType) {
      automations = automations.filter(
        (a) => a.trigger.type === params.triggerType
      );
    }

    // Sort by creation date (newest first)
    automations.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const total = automations.length;
    const startIndex = (params.page - 1) * params.limit;
    const paginatedAutomations = automations.slice(
      startIndex,
      startIndex + params.limit
    );

    return NextResponse.json({
      automations: paginatedAutomations,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error fetching automations:", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new automation
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role - only OWNER, ADMIN, or MANAGER can create automations
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createAutomationSchema.parse(body);

    // Get current agency settings
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { settings: true },
    });

    let automations: Array<{
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
    }> = [];

    if (agency?.settings && typeof agency.settings === "object") {
      const settings = agency.settings as Record<string, unknown>;
      if (Array.isArray(settings.automations)) {
        automations = settings.automations as typeof automations;
      }
    }

    // Create new automation
    const now = new Date().toISOString();
    const newAutomation = {
      id: crypto.randomUUID(),
      name: validatedData.name,
      description: validatedData.description || "",
      trigger: validatedData.trigger as {
        type: string;
        config: Record<string, unknown>;
      },
      conditions: validatedData.conditions,
      actions: validatedData.actions as Array<{
        id: string;
        type: string;
        config: Record<string, unknown>;
      }>,
      isActive: validatedData.isActive,
      lastTriggered: null,
      triggerCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    automations.push(newAutomation);

    // Update agency settings
    const currentSettings =
      agency?.settings && typeof agency.settings === "object"
        ? (agency.settings as Record<string, unknown>)
        : {};

    const settingsUpdate = {
      ...currentSettings,
      automations,
    };

    await db.agency.update({
      where: { id: session.user.agencyId },
      data: {
        settings: JSON.parse(JSON.stringify(settingsUpdate)),
      },
    });

    return NextResponse.json(newAutomation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating automation:", error);
    return NextResponse.json(
      { error: "Failed to create automation" },
      { status: 500 }
    );
  }
}
