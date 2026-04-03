import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validateTemplateFields, TemplateField } from "@/lib/templates";

// ============================================
// VALIDATION SCHEMA
// ============================================

// Rich content schema for template and field-level examples
const richContentSchema = z.object({
  description: z.string().optional(),
  exampleText: z.string().optional(),
  exampleImages: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
  })).optional(),
  exampleVideoUrl: z.string().optional(),
  referenceLinks: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).optional(),
  exampleImageUrl: z.string().optional(), // Legacy support
}).optional();

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  richContent: richContentSchema,
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "number", "date", "select", "checkbox", "file"]),
    required: z.boolean(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
    })).optional(),
    validation: z.array(z.object({
      type: z.enum(["minLength", "maxLength", "min", "max", "pattern", "required"]),
      value: z.union([z.string(), z.number(), z.boolean()]),
      message: z.string().optional(),
    })).optional(),
    conditionalVisibility: z.object({
      fieldId: z.string(),
      operator: z.enum(["equals", "notEquals", "contains", "greaterThan", "lessThan"]),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    // Quantity/multiplier for fields
    quantity: z.number().min(1).max(20).optional(),
    quantityLabel: z.string().optional(),
    // Rich content for field-level examples
    richContent: richContentSchema,
    // File-specific options
    acceptedFileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    maxFiles: z.number().optional(),
    minFiles: z.number().optional(),
    showMaxFileSize: z.boolean().optional(),
    // Enforcement flags
    enforceFileTypes: z.boolean().optional(),
    enforceMaxFileSize: z.boolean().optional(),
    enforceFileCount: z.boolean().optional(),
  })).default([]),
  defaultDueDays: z.number().min(1).default(7),
  defaultUrgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isActive: z.boolean().default(true),
});

// ============================================
// GET - List all templates for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isActiveParam = searchParams.get("isActive");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const categoryId = searchParams.get("categoryId");

    // Get user's allowed categories (if restricted)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { allowedCategoryIds: true, role: true },
    });

    let allowedCategoryIds: string[] = [];
    if (user?.allowedCategoryIds) {
      try {
        const parsed = typeof user.allowedCategoryIds === "string"
          ? JSON.parse(user.allowedCategoryIds)
          : user.allowedCategoryIds;
        if (Array.isArray(parsed) && parsed.length > 0) {
          allowedCategoryIds = parsed;
        }
      } catch {
        allowedCategoryIds = [];
      }
    }

    // Build where clause
    const where: {
      agencyId: string;
      isActive?: boolean;
      categoryId?: string | { in: string[] } | null;
    } = {
      agencyId: session.user.agencyId,
    };

    // Filter by active status if specified
    if (isActiveParam !== null) {
      where.isActive = isActiveParam === "true";
    } else if (!includeInactive) {
      // By default, only show active templates unless includeInactive is true
      where.isActive = true;
    }

    // Filter by specific category if requested
    if (categoryId) {
      if (categoryId === "uncategorized") {
        where.categoryId = null;
      } else {
        where.categoryId = categoryId;
      }
    }

    // Apply category restrictions for non-admin users
    // If user has allowed categories, only show templates in those categories (or uncategorized)
    if (allowedCategoryIds.length > 0 && !["OWNER", "ADMIN"].includes(user?.role || "")) {
      // User can see templates in their allowed categories OR uncategorized templates
      // This is handled by fetching all then filtering (Prisma doesn't support OR with null easily in where)
    }

    const templates = await db.requestTemplate.findMany({
      where,
      include: {
        _count: {
          select: { requests: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Filter by allowed categories if user has restrictions
    let filteredTemplates = templates;
    if (allowedCategoryIds.length > 0 && !["OWNER", "ADMIN"].includes(user?.role || "")) {
      filteredTemplates = templates.filter((t) => {
        // Allow uncategorized templates
        if (!t.categoryId) return true;
        // Allow templates in user's allowed categories
        return allowedCategoryIds.includes(t.categoryId);
      });
    }

    // Parse fields JSON for each template
    const serializedTemplates = filteredTemplates.map((t) => {
      let fields: TemplateField[] = [];
      try {
        if (typeof t.fields === "string") {
          fields = JSON.parse(t.fields);
        } else if (Array.isArray(t.fields)) {
          fields = t.fields as unknown as TemplateField[];
        }
      } catch {
        fields = [];
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        categoryId: t.categoryId,
        category: t.category,
        fields,
        fieldCount: fields.length,
        usageCount: t._count.requests,
        isActive: t.isActive,
        defaultDueDays: t.defaultDueDays,
        defaultUrgency: t.defaultUrgency,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    return NextResponse.json(serializedTemplates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new template
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createTemplateSchema.parse(body);

    // Validate template fields if publishing (isActive = true)
    if (validatedData.isActive && validatedData.fields.length > 0) {
      const validationErrors = validateTemplateFields(validatedData.fields as TemplateField[]);
      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid template fields",
            details: validationErrors,
          },
          { status: 400 }
        );
      }
    }

    // If categoryId is provided, verify it exists and belongs to the agency
    if (validatedData.categoryId) {
      const category = await db.templateCategory.findFirst({
        where: {
          id: validatedData.categoryId,
          agencyId: session.user.agencyId,
        },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }
    }

    const template = await db.requestTemplate.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        categoryId: validatedData.categoryId || null,
        richContent: validatedData.richContent ?? Prisma.DbNull,
        fields: JSON.stringify(validatedData.fields),
        defaultDueDays: validatedData.defaultDueDays,
        defaultUrgency: validatedData.defaultUrgency,
        isActive: validatedData.isActive,
      },
      include: {
        _count: {
          select: { requests: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      categoryId: template.categoryId,
      category: template.category,
      fields: validatedData.fields,
      fieldCount: validatedData.fields.length,
      usageCount: 0,
      isActive: template.isActive,
      defaultDueDays: template.defaultDueDays,
      defaultUrgency: template.defaultUrgency,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
