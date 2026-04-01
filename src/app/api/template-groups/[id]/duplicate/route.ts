import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ============================================
// POST - Duplicate a template group
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

    // Find the original group
    const originalGroup = await db.templateGroup.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!originalGroup) {
      return NextResponse.json(
        { error: "Template group not found" },
        { status: 404 }
      );
    }

    // Get the highest sort order
    const lastGroup = await db.templateGroup.findFirst({
      where: { agencyId: session.user.agencyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const newSortOrder = (lastGroup?.sortOrder ?? -1) + 1;

    // Create the duplicate
    const duplicatedGroup = await db.templateGroup.create({
      data: {
        agencyId: session.user.agencyId,
        name: `${originalGroup.name} (Copy)`,
        description: originalGroup.description,
        platform: originalGroup.platform,
        icon: originalGroup.icon,
        color: originalGroup.color,
        templateIds: originalGroup.templateIds as string[],
        isDefault: false, // Never duplicate as default
        sortOrder: newSortOrder,
      },
    });

    // Parse template IDs for the response
    const templateIds = JSON.parse((duplicatedGroup.templateIds as string) || "[]");

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

    return NextResponse.json(
      {
        ...duplicatedGroup,
        templateIds,
        templates,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error duplicating template group:", error);
    return NextResponse.json(
      { error: "Failed to duplicate template group" },
      { status: 500 }
    );
  }
}
