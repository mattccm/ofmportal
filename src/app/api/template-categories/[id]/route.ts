import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().max(500, "Description too long").optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// ============================================
// GET - Get a single category with templates
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

    const category = await db.templateCategory.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        templates: {
          include: {
            _count: {
              select: { requests: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Parse template fields
    const formattedTemplates = category.templates.map((t) => {
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
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
      templates: formattedTemplates,
      templateCount: formattedTemplates.length,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching template category:", error);
    return NextResponse.json(
      { error: "Failed to fetch template category" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update a category
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

    // Only owners/admins can update categories
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only administrators can update template categories" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateCategorySchema.parse(body);

    // Check category exists and belongs to agency
    const existing = await db.templateCategory.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicate = await db.templateCategory.findUnique({
        where: {
          agencyId_name: {
            agencyId: session.user.agencyId,
            name: validatedData.name,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Update the category
    const category = await db.templateCategory.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.icon !== undefined && { icon: validatedData.icon }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        ...(validatedData.sortOrder !== undefined && { sortOrder: validatedData.sortOrder }),
      },
      include: {
        _count: {
          select: { templates: true },
        },
      },
    });

    return NextResponse.json({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
      templateCount: category._count.templates,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating template category:", error);
    return NextResponse.json(
      { error: "Failed to update template category" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a category
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

    // Only owners/admins can delete categories
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only administrators can delete template categories" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check category exists and belongs to agency
    const category = await db.templateCategory.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: { templates: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Remove category from templates (set categoryId to null)
    await db.requestTemplate.updateMany({
      where: {
        categoryId: id,
        agencyId: session.user.agencyId,
      },
      data: {
        categoryId: null,
      },
    });

    // Delete the category
    await db.templateCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      templatesUpdated: category._count.templates,
    });
  } catch (error) {
    console.error("Error deleting template category:", error);
    return NextResponse.json(
      { error: "Failed to delete template category" },
      { status: 500 }
    );
  }
}
