import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const templateConfigSchema = z.object({
  templateId: z.string().min(1),
  defaultDueDays: z.number().min(1).optional(),
  defaultUrgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  autoAssign: z.boolean().optional(),
  staggerDays: z.number().min(0).optional(),
});

const createBundleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  templateIds: z.array(z.string()).min(1, "At least one template is required"),
  templateConfigs: z.array(templateConfigSchema),
  isOnboardingBundle: z.boolean().default(false),
  autoTrigger: z.enum(["on_creator_create", "manual"]).optional(),
});

const updateBundleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  templateIds: z.array(z.string()).min(1).optional(),
  templateConfigs: z.array(templateConfigSchema).optional(),
  isOnboardingBundle: z.boolean().optional(),
  autoTrigger: z.enum(["on_creator_create", "manual"]).nullable().optional(),
});

// ============================================
// GET - List all bundles for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isOnboardingOnly = searchParams.get("onboarding") === "true";

    const whereClause: { agencyId: string; isOnboardingBundle?: boolean } = {
      agencyId: session.user.agencyId,
    };

    if (isOnboardingOnly) {
      whereClause.isOnboardingBundle = true;
    }

    const bundles = await db.requestBundle.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
    });

    // Get all template IDs from bundles
    const allTemplateIds = new Set<string>();
    bundles.forEach((bundle) => {
      const templateIds = bundle.templateIds as string[];
      templateIds.forEach((id) => allTemplateIds.add(id));
    });

    // Fetch template details
    const templates = await db.requestTemplate.findMany({
      where: {
        id: { in: Array.from(allTemplateIds) },
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        fields: true,
        defaultDueDays: true,
        defaultUrgency: true,
        isActive: true,
      },
    });

    const templateMap = new Map(templates.map((t) => [t.id, t]));

    // Serialize bundles with template data
    const serializedBundles = bundles.map((bundle) => {
      const templateIds = bundle.templateIds as string[];
      const templateConfigs = bundle.templateConfigs as {
        templateId: string;
        defaultDueDays?: number;
        defaultUrgency?: string;
        autoAssign?: boolean;
        staggerDays?: number;
      }[];

      const bundleTemplates = templateIds
        .map((id) => templateMap.get(id))
        .filter(Boolean)
        .map((t) => {
          if (!t) return null;
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
            defaultDueDays: t.defaultDueDays,
            defaultUrgency: t.defaultUrgency,
            isActive: t.isActive,
          };
        })
        .filter(Boolean);

      return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        templateIds,
        templateConfigs,
        isOnboardingBundle: bundle.isOnboardingBundle,
        autoTrigger: bundle.autoTrigger,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
        templateCount: templateIds.length,
        templates: bundleTemplates,
      };
    });

    return NextResponse.json({
      bundles: serializedBundles,
      total: serializedBundles.length,
    });
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return NextResponse.json(
      { error: "Failed to fetch bundles" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new bundle
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createBundleSchema.parse(body);

    // Verify all templates belong to this agency
    const templates = await db.requestTemplate.findMany({
      where: {
        id: { in: validatedData.templateIds },
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    if (templates.length !== validatedData.templateIds.length) {
      return NextResponse.json(
        { error: "One or more templates not found or unauthorized" },
        { status: 400 }
      );
    }

    const bundle = await db.requestBundle.create({
      data: {
        agencyId: session.user.agencyId,
        name: validatedData.name,
        description: validatedData.description || null,
        templateIds: validatedData.templateIds,
        templateConfigs: validatedData.templateConfigs,
        isOnboardingBundle: validatedData.isOnboardingBundle,
        autoTrigger: validatedData.autoTrigger || null,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "bundle.created",
        entityType: "RequestBundle",
        entityId: bundle.id,
        metadata: {
          bundleName: bundle.name,
          templateCount: validatedData.templateIds.length,
          isOnboarding: validatedData.isOnboardingBundle,
        },
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating bundle:", error);
    return NextResponse.json(
      { error: "Failed to create bundle" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update bundle
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    const validatedData = updateBundleSchema.parse(updateData);

    // Verify bundle exists and belongs to this agency
    const existingBundle = await db.requestBundle.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingBundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // If templateIds are being updated, verify they belong to this agency
    if (validatedData.templateIds) {
      const templates = await db.requestTemplate.findMany({
        where: {
          id: { in: validatedData.templateIds },
          agencyId: session.user.agencyId,
        },
        select: { id: true },
      });

      if (templates.length !== validatedData.templateIds.length) {
        return NextResponse.json(
          { error: "One or more templates not found or unauthorized" },
          { status: 400 }
        );
      }
    }

    const bundle = await db.requestBundle.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        templateIds: validatedData.templateIds,
        templateConfigs: validatedData.templateConfigs,
        isOnboardingBundle: validatedData.isOnboardingBundle,
        autoTrigger: validatedData.autoTrigger,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "bundle.updated",
        entityType: "RequestBundle",
        entityId: bundle.id,
        metadata: {
          bundleName: bundle.name,
        },
      },
    });

    return NextResponse.json(bundle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating bundle:", error);
    return NextResponse.json(
      { error: "Failed to update bundle" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete bundle
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    // Verify bundle exists and belongs to this agency
    const existingBundle = await db.requestBundle.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingBundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    await db.requestBundle.delete({
      where: { id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "bundle.deleted",
        entityType: "RequestBundle",
        entityId: id,
        metadata: {
          bundleName: existingBundle.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bundle:", error);
    return NextResponse.json(
      { error: "Failed to delete bundle" },
      { status: 500 }
    );
  }
}
