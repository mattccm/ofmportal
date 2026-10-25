import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { BundlesClient } from "./bundles-client";

// DATA FETCHING

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

// PAGE COMPONENT

export const metadata: Metadata = { title: "Bundles" };

export default async function BundlesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }
  const agencyId = session.user.agencyId;

  let bundles: Awaited<ReturnType<typeof getBundles>>;
  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let stats: Awaited<ReturnType<typeof getBundleStats>>;
  try {
    [bundles, templates, creators, stats] = await Promise.all([
      getBundles(agencyId),
      getTemplates(agencyId),
      getCreators(agencyId),
      getBundleStats(agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch bundles data:", error);
    bundles = [];
    templates = [];
    creators = [];
    stats = { totalBundles: 0, onboardingBundles: 0, autoTriggerBundles: 0 };
  }

  const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;
  const lede =
    stats.totalBundles === 0
      ? "A bundle sends several templates at once, for example everything a new creator needs in their first week."
      : `${plural(stats.totalBundles, "bundle")}. ${stats.onboardingBundles} for onboarding${
          stats.autoTriggerBundles ? `, ${stats.autoTriggerBundles} sent by themselves when a creator is added` : ""
        }.`;

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Bundles</h1>
        <p className="mt-1 max-w-[70ch] text-[15px]">{lede}</p>
      </header>

      {/* Client Component for Bundle Management */}
      <BundlesClient
        initialBundles={bundles}
        availableTemplates={templates}
        creators={creators}
      />
    </div>
  );
}
