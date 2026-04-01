import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateTemplateFields, TemplateField } from "@/lib/templates";

// ============================================
// VALIDATION SCHEMA
// ============================================

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
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
    acceptedFileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    maxFiles: z.number().optional(),
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

    const where: { agencyId: string; isActive?: boolean } = {
      agencyId: session.user.agencyId,
    };

    // Filter by active status if specified
    if (isActiveParam !== null) {
      where.isActive = isActiveParam === "true";
    } else if (!includeInactive) {
      // By default, only show active templates unless includeInactive is true
      where.isActive = true;
    }

    const templates = await db.requestTemplate.findMany({
      where,
      include: {
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Parse fields JSON for each template
    const serializedTemplates = templates.map((t) => {
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

    const template = await db.requestTemplate.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        fields: JSON.stringify(validatedData.fields),
        defaultDueDays: validatedData.defaultDueDays,
        defaultUrgency: validatedData.defaultUrgency,
        isActive: validatedData.isActive,
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
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
