import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
});

// ============================================
// GET - List all template categories for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeTemplateCount = searchParams.get("includeTemplateCount") === "true";

    // Fetch categories
    const categories = await db.templateCategory.findMany({
      where: {
        agencyId: session.user.agencyId,
      },
      include: includeTemplateCount ? {
        _count: {
          select: { templates: true },
        },
      } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Transform response
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      sortOrder: cat.sortOrder,
      templateCount: (cat as { _count?: { templates: number } })._count?.templates ?? 0,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    return NextResponse.json({
      categories: formattedCategories,
      total: formattedCategories.length,
    });
  } catch (error) {
    console.error("Error fetching template categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch template categories" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new template category
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only owners/admins can create categories
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only administrators can create template categories" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createCategorySchema.parse(body);

    // Check for duplicate name
    const existing = await db.templateCategory.findUnique({
      where: {
        agencyId_name: {
          agencyId: session.user.agencyId,
          name: validatedData.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    // Get the highest sort order
    const lastCategory = await db.templateCategory.findFirst({
      where: { agencyId: session.user.agencyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const newSortOrder = (lastCategory?.sortOrder ?? -1) + 1;

    // Create the category
    const category = await db.templateCategory.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        icon: validatedData.icon || null,
        color: validatedData.color || null,
        sortOrder: newSortOrder,
      },
    });

    return NextResponse.json(
      {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
        sortOrder: category.sortOrder,
        templateCount: 0,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating template category:", error);
    return NextResponse.json(
      { error: "Failed to create template category" },
      { status: 500 }
    );
  }
}
