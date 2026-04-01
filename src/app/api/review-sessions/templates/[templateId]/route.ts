// GET /api/review-sessions/templates/[templateId] - Get a single template
// PUT /api/review-sessions/templates/[templateId] - Update a template
// DELETE /api/review-sessions/templates/[templateId] - Delete a template

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const { agencyId } = await getCurrentUser(request);

    const template = await db.sessionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get creator info
    const creator = await db.user.findUnique({
      where: { id: template.createdById },
      select: { id: true, name: true },
    });

    const response: SessionTemplate & { createdByName: string } = {
      id: template.id,
      agencyId: template.agencyId,
      name: template.name,
      description: template.description,
      settings: template.settings as SessionTemplate["settings"],
      defaultParticipantIds: template.defaultParticipantIds as string[],
      defaultParticipantRoles: template.defaultParticipantRoles as Record<string, "HOST" | "REVIEWER" | "OBSERVER">,
      uploadFilters: template.uploadFilters as SessionTemplate["uploadFilters"],
      createdById: template.createdById,
      createdByName: creator?.name || "Unknown",
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };

    return NextResponse.json({ template: response });
  } catch (error) {
    console.error("Error fetching session template:", error);
    return NextResponse.json(
      { error: "Failed to fetch session template" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const { userId, agencyId } = await getCurrentUser(request);
    const body: Partial<CreateSessionTemplateRequest> = await request.json();

    const template = await db.sessionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Merge settings with existing settings
    const existingSettings = template.settings as Record<string, unknown>;
    const newSettings = body.settings
      ? { ...DEFAULT_SESSION_SETTINGS, ...existingSettings, ...body.settings }
      : existingSettings;

    // Update the template
    const updatedTemplate = await db.sessionTemplate.update({
      where: { id: templateId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
        settings: newSettings as Prisma.InputJsonValue,
        ...(body.defaultParticipantIds ? { defaultParticipantIds: body.defaultParticipantIds as Prisma.InputJsonValue } : {}),
        ...(body.defaultParticipantRoles ? { defaultParticipantRoles: body.defaultParticipantRoles as Prisma.InputJsonValue } : {}),
        ...(body.uploadFilters ? { uploadFilters: body.uploadFilters as Prisma.InputJsonValue } : {}),
      },
    });

    // Create activity log
    await db.activityLog.create({
      data: {
        userId,
        action: "session_template.updated",
        entityType: "SessionTemplate",
        entityId: templateId,
        metadata: {
          templateName: updatedTemplate.name,
        },
      },
    });

    const response: SessionTemplate = {
      id: updatedTemplate.id,
      agencyId: updatedTemplate.agencyId,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      settings: updatedTemplate.settings as SessionTemplate["settings"],
      defaultParticipantIds: updatedTemplate.defaultParticipantIds as string[],
      defaultParticipantRoles: updatedTemplate.defaultParticipantRoles as Record<string, "HOST" | "REVIEWER" | "OBSERVER">,
      uploadFilters: updatedTemplate.uploadFilters as SessionTemplate["uploadFilters"],
      createdById: updatedTemplate.createdById,
      createdAt: updatedTemplate.createdAt,
      updatedAt: updatedTemplate.updatedAt,
    };

    return NextResponse.json({ template: response });
  } catch (error) {
    console.error("Error updating session template:", error);
    return NextResponse.json(
      { error: "Failed to update session template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const { userId, agencyId } = await getCurrentUser(request);

    const template = await db.sessionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Delete the template
    await db.sessionTemplate.delete({
      where: { id: templateId },
    });

    // Create activity log
    await db.activityLog.create({
      data: {
        userId,
        action: "session_template.deleted",
        entityType: "SessionTemplate",
        entityId: templateId,
        metadata: {
          templateName: template.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session template:", error);
    return NextResponse.json(
      { error: "Failed to delete session template" },
      { status: 500 }
    );
  }
}
