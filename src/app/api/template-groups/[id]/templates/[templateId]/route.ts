import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ============================================
// DELETE - Remove a template from a group
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Parse existing template IDs
    const existingIds = JSON.parse((group.templateIds as string) || "[]") as string[];

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
    const updatedGroup = await db.templateGroup.update({
      where: { id },
      data: {
        templateIds: JSON.stringify(newIds),
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
