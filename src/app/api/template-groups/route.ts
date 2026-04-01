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

const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  platform: platformSchema,
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  templateIds: z.array(z.string()).optional().default([]),
  isDefault: z.boolean().optional().default(false),
});

// ============================================
// GET - List all template groups for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const includeTemplates = searchParams.get("includeTemplates") === "true";

    // Build where clause
    const where: {
      agencyId: string;
      platform?: string;
    } = {
      agencyId: session.user.agencyId,
    };

    if (platform && platform !== "all") {
      where.platform = platform;
    }

    // Fetch groups
    const groups = await db.templateGroup.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    // If templates are requested, fetch them for each group
    let groupsWithTemplates = groups.map((group) => ({
      ...group,
      templateIds: JSON.parse((group.templateIds as string) || "[]"),
      templates: [] as Array<{
        id: string;
        name: string;
        description: string | null;
        fieldCount: number;
        usageCount: number;
        isActive: boolean;
      }>,
    }));

    if (includeTemplates) {
      // Collect all template IDs
      const allTemplateIds = groupsWithTemplates.flatMap((g) => g.templateIds);
      const uniqueTemplateIds = [...new Set(allTemplateIds)];

      if (uniqueTemplateIds.length > 0) {
        // Fetch all templates at once
        const templates = await db.requestTemplate.findMany({
          where: {
            id: { in: uniqueTemplateIds },
            agencyId: session.user.agencyId,
          },
          include: {
            _count: {
              select: { requests: true },
            },
          },
        });

        // Create a map for quick lookup
        const templateMap = new Map(
          templates.map((t) => {
            let fieldCount = 0;
            try {
              const fields = typeof t.fields === "string" ? JSON.parse(t.fields) : t.fields;
              fieldCount = Array.isArray(fields) ? fields.length : 0;
            } catch {
              fieldCount = 0;
            }

            return [
              t.id,
              {
                id: t.id,
                name: t.name,
                description: t.description,
                fieldCount,
                usageCount: t._count.requests,
                isActive: t.isActive,
              },
            ];
          })
        );

        // Add templates to each group
        groupsWithTemplates = groupsWithTemplates.map((group) => ({
          ...group,
          templates: group.templateIds
            .map((id: string) => templateMap.get(id))
            .filter(Boolean) as Array<{
              id: string;
              name: string;
              description: string | null;
              fieldCount: number;
              usageCount: number;
              isActive: boolean;
            }>,
        }));
      }
    }

    return NextResponse.json({
      groups: groupsWithTemplates,
      total: groupsWithTemplates.length,
    });
  } catch (error) {
    console.error("Error fetching template groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch template groups" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new template group
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createGroupSchema.parse(body);

    // If setting as default, unset any existing default for this platform
    if (validatedData.isDefault) {
      await db.templateGroup.updateMany({
        where: {
          agencyId: session.user.agencyId,
          platform: validatedData.platform,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Get the highest sort order
    const lastGroup = await db.templateGroup.findFirst({
      where: { agencyId: session.user.agencyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const newSortOrder = (lastGroup?.sortOrder ?? -1) + 1;

    // Create the group
    const group = await db.templateGroup.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        platform: validatedData.platform,
        icon: validatedData.icon || null,
        color: validatedData.color || null,
        templateIds: JSON.stringify(validatedData.templateIds),
        isDefault: validatedData.isDefault,
        sortOrder: newSortOrder,
      },
    });

    return NextResponse.json(
      {
        ...group,
        templateIds: validatedData.templateIds,
        templates: [],
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

    console.error("Error creating template group:", error);
    return NextResponse.json(
      { error: "Failed to create template group" },
      { status: 500 }
    );
  }
}
