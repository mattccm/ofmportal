import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const platformSchema = z.enum([
  "instagram",
  "twitter",
  "tiktok",
  "onlyfans",
  "fansly",
  "youtube",
  "reddit",
  "custom",
]);

const updateGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().max(500, "Description too long").optional().nullable(),
  platform: platformSchema.optional(),
  icon: z.string().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),
  templateIds: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ============================================
// GET - Get a single template group
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

    // Fetch templates if there are any
    let templates: Array<{
      id: string;
      name: string;
      description: string | null;
      fieldCount: number;
      usageCount: number;
      isActive: boolean;
    }> = [];

    if (templateIds.length > 0) {
      const templateRecords = await db.requestTemplate.findMany({
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

      templates = templateRecords.map((t) => {
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
    }

    return NextResponse.json({
      group: {
        ...group,
        templateIds,
        templates,
      },
    });
  } catch (error) {
    console.error("Error fetching template group:", error);
    return NextResponse.json(
      { error: "Failed to fetch template group" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update a template group
// ============================================

export async function PATCH(
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
    const validatedData = updateGroupSchema.parse(body);

    // Check if the group exists and belongs to the agency
    const existingGroup = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset any existing default for this platform
    const newPlatform = validatedData.platform || existingGroup.platform;
    if (validatedData.isDefault) {
      await db.templateGroup.updateMany({
        where: {
          agencyId: session.user.agencyId,
          platform: newPlatform,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.platform !== undefined) {
      updateData.platform = validatedData.platform;
    }
    if (validatedData.icon !== undefined) {
      updateData.icon = validatedData.icon;
    }
    if (validatedData.color !== undefined) {
      updateData.color = validatedData.color;
    }
    if (validatedData.templateIds !== undefined) {
      updateData.templateIds = JSON.stringify(validatedData.templateIds);
    }
    if (validatedData.isDefault !== undefined) {
      updateData.isDefault = validatedData.isDefault;
    }
    if (validatedData.sortOrder !== undefined) {
      updateData.sortOrder = validatedData.sortOrder;
    }

    // Update the group
    const updatedGroup = await db.templateGroup.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updatedGroup,
      templateIds: validatedData.templateIds !== undefined
        ? validatedData.templateIds
        : JSON.parse((existingGroup.templateIds as string) || "[]"),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating template group:", error);
    return NextResponse.json(
      { error: "Failed to update template group" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a template group
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if the group exists and belongs to the agency
    const existingGroup = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // Delete the group
    await db.templateGroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template group:", error);
    return NextResponse.json(
      { error: "Failed to delete template group" },
      { status: 500 }
    );
  }
}
