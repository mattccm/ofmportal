import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";

// DELETE - Remove a template from a group

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const gate = await requireAccess("templates.groups");
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id, templateId } = await params;

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

    // Existing template IDs (stored as a JSON array column)
    const existingIds = Array.isArray(group.templateIds)
      ? (group.templateIds as string[])
      : [];

    // Check if the template is in the group
    if (!existingIds.includes(templateId)) {
      return NextResponse.json(
        { error: "Template not found in this group" },
        { status: 404 }
      );
    }

    // Remove the template from the group
    const newIds = existingIds.filter((id) => id !== templateId);

    // Update the group
    await db.templateGroup.update({
      where: { id },
      data: {
        templateIds: newIds,
      },
    });

    return NextResponse.json({
      success: true,
      templateIds: newIds,
    });
  } catch (error) {
    console.error("Error removing template from group:", error);
    return NextResponse.json(
      { error: "Failed to remove template from group" },
      { status: 500 }
    );
  }
}
