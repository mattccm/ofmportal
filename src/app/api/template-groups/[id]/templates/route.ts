import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const addTemplatesSchema = z.object({
  templateIds: z.array(z.string()).min(1, "At least one template is required"),
});

// ============================================
// GET - Get all templates in a group
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the group
    const group = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // Parse template IDs
    const templateIds = JSON.parse((group.templateIds as string) || "[]");

    if (templateIds.length === 0) {
      return NextResponse.json({ templates: [] });
    }

    // Fetch templates
    const templates = await db.requestTemplate.findMany({
      where: {
        id: { in: templateIds },
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    const formattedTemplates = templates.map((t) => {
      let fieldCount = 0;
      try {
        const fields = typeof t.fields === "string" ? JSON.parse(t.fields) : t.fields;
        fieldCount = Array.isArray(fields) ? fields.length : 0;
      } catch {
        fieldCount = 0;
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        fieldCount,
        usageCount: t._count.requests,
        isActive: t.isActive,
      };
    });

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error) {
    console.error("Error fetching group templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch group templates" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add templates to a group
// ============================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = addTemplatesSchema.parse(body);

    // Find the group
    const group = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // Verify all templates exist and belong to the agency
    const templates = await db.requestTemplate.findMany({
      where: {
        id: { in: validatedData.templateIds },
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    const validTemplateIds = templates.map((t) => t.id);
    const invalidIds = validatedData.templateIds.filter(
      (id) => !validTemplateIds.includes(id)
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some templates were not found",
          invalidIds,
        },
        { status: 400 }
      );
    }

    // Parse existing template IDs and add new ones (avoiding duplicates)
    const existingIds = JSON.parse((group.templateIds as string) || "[]") as string[];
    const newIds = [...new Set([...existingIds, ...validTemplateIds])];

    // Update the group
    const updatedGroup = await db.templateGroup.update({
      where: { id },
      data: {
        templateIds: JSON.stringify(newIds),
      },
    });

    // Fetch updated templates
    const updatedTemplates = await db.requestTemplate.findMany({
      where: {
        id: { in: newIds },
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    const formattedTemplates = updatedTemplates.map((t) => {
      let fieldCount = 0;
      try {
        const fields = typeof t.fields === "string" ? JSON.parse(t.fields) : t.fields;
        fieldCount = Array.isArray(fields) ? fields.length : 0;
      } catch {
        fieldCount = 0;
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        fieldCount,
        usageCount: t._count.requests,
        isActive: t.isActive,
      };
    });

    return NextResponse.json({
      ...updatedGroup,
      templateIds: newIds,
      templates: formattedTemplates,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error adding templates to group:", error);
    return NextResponse.json(
      { error: "Failed to add templates to group" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Replace all templates in a group
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Allow empty array for clearing all templates
    const templateIds = z.array(z.string()).parse(body.templateIds || []);

    // Find the group
    const group = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // Verify all templates exist and belong to the agency (if any)
    if (templateIds.length > 0) {
      const templates = await db.requestTemplate.findMany({
        where: {
          id: { in: templateIds },
          agencyId: session.user.agencyId,
        },
        select: { id: true },
      });

      const validTemplateIds = templates.map((t) => t.id);
      const invalidIds = templateIds.filter((id) => !validTemplateIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: "Some templates were not found",
            invalidIds,
          },
          { status: 400 }
        );
      }
    }

    // Update the group
    const updatedGroup = await db.templateGroup.update({
      where: { id },
      data: {
        templateIds: JSON.stringify(templateIds),
      },
    });

    return NextResponse.json({
      ...updatedGroup,
      templateIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating group templates:", error);
    return NextResponse.json(
      { error: "Failed to update group templates" },
      { status: 500 }
    );
  }
}
