import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPageAccess, requestWhere } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TemplateField } from "@/lib/template-types";
import { fieldSpec } from "@/components/templates/template-spec";
import { TemplatesClient } from "./templates-client";

export const metadata: Metadata = { title: "Templates" };

// DATA FETCHING

// `scope`: the requests this person may see, so usage counts only cover their creators
async function getTemplates(agencyId: string, scope: Prisma.ContentRequestWhereInput) {
  const usage = await db.contentRequest.groupBy({
    by: ["templateId"],
    where: { ...scope, templateId: { not: null } },
    _max: { createdAt: true },
  });
  const lastUsed = new Map(usage.map((u) => [u.templateId, u._max.createdAt?.toISOString() ?? null]));
  const templates = await db.requestTemplate.findMany({
    where: { agencyId },
    include: {
      _count: {
        select: { requests: { where: scope } },
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
    orderBy: { updatedAt: "desc" },
  });

  return templates.map((t) => {
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
      categoryId: t.categoryId,
      category: t.category,
      fieldCount: fields.reduce((n, f) => n + (f.quantity && f.quantity > 1 ? f.quantity : 1), 0),
      fields: fields.slice(0, 7).map((f) => ({ label: f.label, spec: fieldSpec(f) })),
      usageCount: t._count.requests,
      lastUsedAt: lastUsed.get(t.id) ?? null,
      isActive: t.isActive,
      updatedAt: t.updatedAt,
    };
  });
}

// Template groups are stored as TemplateCategory rows (one group per template)
async function getCategories(agencyId: string) {
  const categories = await db.templateCategory.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return categories;
}

async function getTemplateStats(agencyId: string, scope: Prisma.ContentRequestWhereInput) {
  const [totalTemplates, activeTemplates, totalUsage] = await Promise.all([
    db.requestTemplate.count({ where: { agencyId } }),
    db.requestTemplate.count({ where: { agencyId, isActive: true } }),
    db.contentRequest.count({
      where: { ...scope, templateId: { not: null } },
    }),
  ]);

  return { totalTemplates, activeTemplates, totalUsage };
}

// PAGE COMPONENT

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ newGroup?: string }>;
}) {
  const access = await getPageAccess();
  if (!access.has("templates.view")) return <NoAccess what="templates" roleName={access.role.name} />;
  const agencyId = access.agencyId;
  const scope = requestWhere(access);
  const canManageGroups = access.has("templates.groups");
  const { newGroup } = await searchParams;

  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let stats: Awaited<ReturnType<typeof getTemplateStats>>;
  let categories: Awaited<ReturnType<typeof getCategories>>;
  try {
    [templates, stats, categories] = await Promise.all([
      getTemplates(agencyId, scope),
      getTemplateStats(agencyId, scope),
      getCategories(agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch templates data:", error);
    templates = [];
    stats = { totalTemplates: 0, activeTemplates: 0, totalUsage: 0 };
    categories = [];
  }

  const lede =
    stats.totalTemplates === 0
      ? "Templates are the requests you send often. Build one and it fills in the new-request form."
      : `${stats.activeTemplates} of ${stats.totalTemplates} ${stats.totalTemplates === 1 ? "template is" : "templates are"} switched on${
          categories.length ? `, in ${categories.length} ${categories.length === 1 ? "group" : "groups"}` : ""
        }. ${stats.totalUsage} ${stats.totalUsage === 1 ? "request has" : "requests have"} gone out from them.`;

  return (
    <div>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Templates</h1>
          <p className="mt-1 max-w-[70ch] text-[15px]">{lede}</p>
        </div>
        {access.has("templates.create") && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/dashboard/templates/new">
                <Plus className="size-4" aria-hidden="true" />
                New template
              </Link>
            </Button>
          </div>
        )}
      </header>
      <TemplatesClient
        initialTemplates={templates}
        initialGroups={categories}
        canManageGroups={canManageGroups}
        startCreating={newGroup === "1"}
      />
    </div>
  );
}
