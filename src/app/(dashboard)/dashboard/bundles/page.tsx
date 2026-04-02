import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Package, Sparkles } from "lucide-react";
import { BundlesClient } from "./bundles-client";
import type { TemplateField } from "@/lib/template-types";

// ============================================
// DATA FETCHING
// ============================================

async function getBundles(agencyId: string) {
  const bundles = await db.requestBundle.findMany({
    where: { agencyId },
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
      agencyId,
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
  return bundles.map((bundle) => {
    const templateIds = bundle.templateIds as string[];
    const rawConfigs = bundle.templateConfigs as {
      templateId: string;
      defaultDueDays?: number;
      defaultUrgency?: string;
      autoAssign?: boolean;
      staggerDays?: number;
    }[];

    // Ensure defaultUrgency is properly typed
    const templateConfigs = rawConfigs.map((cfg) => ({
      ...cfg,
      defaultUrgency: cfg.defaultUrgency as "LOW" | "NORMAL" | "HIGH" | "URGENT" | undefined,
    }));

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
          defaultUrgency: t.defaultUrgency as "LOW" | "NORMAL" | "HIGH" | "URGENT",
          isActive: t.isActive,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description || undefined,
      templateIds,
      templateConfigs,
      isOnboardingBundle: bundle.isOnboardingBundle,
      autoTrigger: bundle.autoTrigger as "on_creator_create" | "manual" | undefined,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
      templates: bundleTemplates,
    };
  });
}

async function getTemplates(agencyId: string) {
  const templates = await db.requestTemplate.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
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

  return templates.map((t) => {
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
      defaultUrgency: t.defaultUrgency as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      isActive: t.isActive,
    };
  });
}

async function getCreators(agencyId: string) {
  const creators = await db.creator.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return creators;
}

async function getBundleStats(agencyId: string) {
  const [totalBundles, onboardingBundles, autoTriggerBundles] = await Promise.all([
    db.requestBundle.count({ where: { agencyId } }),
    db.requestBundle.count({ where: { agencyId, isOnboardingBundle: true } }),
    db.requestBundle.count({ where: { agencyId, autoTrigger: "on_creator_create" } }),
  ]);

  return { totalBundles, onboardingBundles, autoTriggerBundles };
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function BundlesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }
  const agencyId = session.user.agencyId;

  const [bundles, templates, creators, stats] = await Promise.all([
    getBundles(agencyId),
    getTemplates(agencyId),
    getCreators(agencyId),
    getBundleStats(agencyId),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Onboarding Tools</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Request Bundles
          </h1>
          <p className="text-muted-foreground mt-1">
            Create pre-configured sets of templates to quickly onboard new creators
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalBundles}</p>
              <p className="text-sm text-muted-foreground">Total Bundles</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.onboardingBundles}</p>
              <p className="text-sm text-muted-foreground">Onboarding Bundles</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.autoTriggerBundles}</p>
              <p className="text-sm text-muted-foreground">Auto-Trigger Bundles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Component for Bundle Management */}
      <BundlesClient
        initialBundles={bundles}
        availableTemplates={templates}
        creators={creators}
      />
    </div>
  );
}
