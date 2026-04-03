import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Suspense } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  SortAsc,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TemplateCard,
  TemplateCardSkeleton,
  EmptyTemplates,
} from "@/components/templates/template-card";
import { TemplateField, deserializeTemplate } from "@/lib/templates";
import { TemplatesClient } from "./templates-client";

// ============================================
// DATA FETCHING
// ============================================

async function getTemplates(agencyId: string) {
  const templates = await db.requestTemplate.findMany({
    where: { agencyId },
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
      fieldCount: fields.length,
      usageCount: t._count.requests,
      isActive: t.isActive,
      updatedAt: t.updatedAt,
    };
  });
}

async function getCategories(agencyId: string) {
  const categories = await db.templateCategory.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return categories;
}

async function getTemplateStats(agencyId: string) {
  const [totalTemplates, activeTemplates, totalUsage] = await Promise.all([
    db.requestTemplate.count({ where: { agencyId } }),
    db.requestTemplate.count({ where: { agencyId, isActive: true } }),
    db.contentRequest.count({
      where: { agencyId, templateId: { not: null } },
    }),
  ]);

  return { totalTemplates, activeTemplates, totalUsage };
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }
  const agencyId = session.user.agencyId;

  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let stats: Awaited<ReturnType<typeof getTemplateStats>>;
  let categories: Awaited<ReturnType<typeof getCategories>>;
  try {
    [templates, stats, categories] = await Promise.all([
      getTemplates(agencyId),
      getTemplateStats(agencyId),
      getCategories(agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch templates data:", error);
    templates = [];
    stats = { totalTemplates: 0, activeTemplates: 0, totalUsage: 0 };
    categories = [];
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Template Builder</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Request Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable templates for content requests
          </p>
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
        >
          <Link href="/dashboard/templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalTemplates}</p>
              <p className="text-sm text-muted-foreground">Total Templates</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeTemplates}</p>
              <p className="text-sm text-muted-foreground">Active Templates</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalUsage}</p>
              <p className="text-sm text-muted-foreground">Requests Using Templates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client-side filtering and list */}
      <TemplatesClient initialTemplates={templates} categories={categories} />
    </div>
  );
}
