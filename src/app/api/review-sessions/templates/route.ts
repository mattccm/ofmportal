// POST /api/review-sessions/templates - Create a new session template
// GET /api/review-sessions/templates - List session templates

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  CreateSessionTemplateRequest,
  SessionTemplate,
  DEFAULT_SESSION_SETTINGS,
} from "@/types/review-session";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, agencyId } = await getCurrentUser(request);
    const body: CreateSessionTemplateRequest = await request.json();

    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // Merge settings with defaults
    const settings = {
      ...DEFAULT_SESSION_SETTINGS,
      ...body.settings,
    };

    // Create the template
    const template = await db.sessionTemplate.create({
      data: {
        agencyId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        settings: settings as Prisma.InputJsonValue,
        defaultParticipantIds: (body.defaultParticipantIds || []) as Prisma.InputJsonValue,
        defaultParticipantRoles: (body.defaultParticipantRoles || {}) as Prisma.InputJsonValue,
        uploadFilters: (body.uploadFilters || {}) as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    // Create activity log
    await db.activityLog.create({
      data: {
        userId,
        action: "session_template.created",
        entityType: "SessionTemplate",
        entityId: template.id,
        metadata: {
          templateName: template.name,
        },
      },
    });

    const response: SessionTemplate = {
      id: template.id,
      agencyId: template.agencyId,
      name: template.name,
      description: template.description,
      settings: template.settings as SessionTemplate["settings"],
      defaultParticipantIds: template.defaultParticipantIds as string[],
      defaultParticipantRoles: template.defaultParticipantRoles as Record<string, "HOST" | "REVIEWER" | "OBSERVER">,
      uploadFilters: template.uploadFilters as SessionTemplate["uploadFilters"],
      createdById: template.createdById,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };

    return NextResponse.json({ template: response }, { status: 201 });
  } catch (error) {
    console.error("Error creating session template:", error);
    return NextResponse.json(
      { error: "Failed to create session template" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId } = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get templates
    const templates = await db.sessionTemplate.findMany({
      where: { agencyId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    // Get creator info
    const creatorIds = [...new Set(templates.map((t) => t.createdById))];
    const creators = await db.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c.name]));

    const response = templates.map((template) => ({
      id: template.id,
      agencyId: template.agencyId,
      name: template.name,
      description: template.description,
      settings: template.settings,
      defaultParticipantIds: template.defaultParticipantIds,
      defaultParticipantRoles: template.defaultParticipantRoles,
      uploadFilters: template.uploadFilters,
      createdById: template.createdById,
      createdByName: creatorMap.get(template.createdById) || "Unknown",
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));

    return NextResponse.json({ templates: response });
  } catch (error) {
    console.error("Error fetching session templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch session templates" },
      { status: 500 }
    );
  }
}
