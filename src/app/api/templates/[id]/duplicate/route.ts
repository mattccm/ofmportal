import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateField, deserializeTemplate } from "@/lib/templates";

// ============================================
// POST - Duplicate template
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the original template
    const originalTemplate = await db.requestTemplate.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!originalTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Parse and regenerate field IDs for the copy
    let fields: TemplateField[] = [];
    try {
      if (typeof originalTemplate.fields === "string") {
        fields = JSON.parse(originalTemplate.fields);
      } else if (Array.isArray(originalTemplate.fields)) {
        fields = originalTemplate.fields as unknown as TemplateField[];
      }
    } catch {
      fields = [];
    }

    // Create a mapping of old IDs to new IDs
    const idMapping: Record<string, string> = {};
    const duplicatedFields = fields.map((field) => {
      const newId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMapping[field.id] = newId;

      return {
        ...field,
        id: newId,
        // Regenerate option IDs for select fields
        options: field.options?.map((opt) => ({
          ...opt,
          id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })),
      };
    });

    // Update conditional visibility references to use new IDs
    const updatedFields = duplicatedFields.map((field) => {
      if (field.conditionalVisibility) {
        const newFieldId = idMapping[field.conditionalVisibility.fieldId];
        if (newFieldId) {
          return {
            ...field,
            conditionalVisibility: {
              ...field.conditionalVisibility,
              fieldId: newFieldId,
            },
          };
        }
      }
      return field;
    });

    // Generate unique name for the copy
    const baseName = originalTemplate.name.replace(/\s*\(copy(?:\s*\d+)?\)$/, "");
    const existingCopies = await db.requestTemplate.count({
      where: {
        agencyId: session.user.agencyId,
        name: {
          startsWith: `${baseName} (copy`,
        },
      },
    });
    const copyNumber = existingCopies > 0 ? existingCopies + 1 : "";
    const newName = `${baseName} (copy${copyNumber ? ` ${copyNumber}` : ""})`;

    // Create the duplicate
    const duplicatedTemplate = await db.requestTemplate.create({
      data: {
        agencyId: session.user.agencyId,
        name: newName,
        description: originalTemplate.description,
        fields: JSON.stringify(updatedFields),
        defaultDueDays: originalTemplate.defaultDueDays,
        defaultUrgency: originalTemplate.defaultUrgency,
        isActive: false, // Start as draft
      },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    return NextResponse.json({
      id: duplicatedTemplate.id,
      name: duplicatedTemplate.name,
      description: duplicatedTemplate.description,
      fields: updatedFields,
      fieldCount: updatedFields.length,
      usageCount: 0,
      isActive: duplicatedTemplate.isActive,
      defaultDueDays: duplicatedTemplate.defaultDueDays,
      defaultUrgency: duplicatedTemplate.defaultUrgency,
      createdAt: duplicatedTemplate.createdAt,
      updatedAt: duplicatedTemplate.updatedAt,
    });
  } catch (error) {
    console.error("Error duplicating template:", error);
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 }
    );
  }
}
