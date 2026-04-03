import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateTemplateFields, TemplateField, deserializeTemplate } from "@/lib/templates";

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

const updateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
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
  })).optional(),
  defaultDueDays: z.number().min(1).optional(),
  defaultUrgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// GET - Fetch single template
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

    const template = await db.requestTemplate.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
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

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const deserialized = deserializeTemplate(template);

    return NextResponse.json({
      ...deserialized,
      categoryId: template.categoryId,
      category: template.category,
      fieldCount: deserialized.fields.length,
      usageCount: template._count.requests,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update template
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

    const { id } = await params;

    // Check if template exists and belongs to agency
    const existingTemplate = await db.requestTemplate.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    // Validate template fields if publishing (isActive = true)
    if (validatedData.isActive && validatedData.fields && validatedData.fields.length > 0) {
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

    // If categoryId is being set, verify it exists and belongs to the agency
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

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.categoryId !== undefined)
      updateData.categoryId = validatedData.categoryId;
    if (validatedData.richContent !== undefined)
      updateData.richContent = validatedData.richContent;
    if (validatedData.fields !== undefined)
      updateData.fields = JSON.stringify(validatedData.fields);
    if (validatedData.defaultDueDays !== undefined)
      updateData.defaultDueDays = validatedData.defaultDueDays;
    if (validatedData.defaultUrgency !== undefined)
      updateData.defaultUrgency = validatedData.defaultUrgency;
    if (validatedData.isActive !== undefined)
      updateData.isActive = validatedData.isActive;

    const updatedTemplate = await db.requestTemplate.update({
      where: { id },
      data: updateData,
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

    const deserialized = deserializeTemplate(updatedTemplate);

    return NextResponse.json({
      ...deserialized,
      categoryId: updatedTemplate.categoryId,
      category: updatedTemplate.category,
      fieldCount: deserialized.fields.length,
      usageCount: updatedTemplate._count.requests,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete template (soft delete if in use)
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

    const { id } = await params;

    // Check if template exists and belongs to agency
    const existingTemplate = await db.requestTemplate.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // If template is in use, soft delete by deactivating
    if (existingTemplate._count.requests > 0) {
      await db.requestTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: "Template deactivated (in use by existing requests)",
        softDeleted: true,
      });
    }

    // If not in use, hard delete
    await db.requestTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Template deleted",
      softDeleted: false,
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
