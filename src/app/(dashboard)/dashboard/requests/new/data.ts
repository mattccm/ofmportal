import { db } from "@/lib/db";
import { loadEmailBranding } from "@/lib/email";
import type { TemplateField, RichContent } from "@/lib/template-types";

/* Everything the composer needs, read once on the server. */

export interface ComposeCreator {
  id: string;
  name: string;
  email: string;
  hasPhone: boolean;
  preferredContact: "EMAIL" | "SMS" | "BOTH";
  timezone: string;
  inviteStatus: string;
}

export interface ComposeGroup {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
}

export interface ComposeTemplate {
  id: string;
  name: string;
  description: string | null;
  richContent: RichContent | null;
  fields: TemplateField[];
  defaultDueDays: number;
  defaultUrgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  usageCount: number;
  lastUsedAt: string | null;
}

export interface ComposeData {
  creators: ComposeCreator[];
  groups: ComposeGroup[];
  templates: ComposeTemplate[];
  /** The sender name creators see on the email (agency setting, else the agency) */
  emailFrom: string;
  /** Host of the portal link in the SMS ("portal.example.com") */
  portalHost: string;
  totalRequests: number;
}

function parseFields(raw: unknown): TemplateField[] {
  try {
    if (typeof raw === "string") return JSON.parse(raw) as TemplateField[];
    if (Array.isArray(raw)) return raw as unknown as TemplateField[];
  } catch {
    /* a broken template shows as blank rather than breaking the page */
  }
  return [];
}

async function allowedCategories(userId: string): Promise<string[] | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { allowedCategoryIds: true, role: true },
  });
  if (!user || ["OWNER", "ADMIN"].includes(user.role)) return null;
  try {
    const parsed =
      typeof user.allowedCategoryIds === "string"
        ? JSON.parse(user.allowedCategoryIds)
        : user.allowedCategoryIds;
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

export async function getComposeData(
  agencyId: string,
  userId: string,
  agencyName?: string
): Promise<ComposeData> {
  const [creators, groups, templates, usage, totalRequests, allowed, branding] = await Promise.all([
    db.creator.findMany({
      where: { agencyId, archivedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        preferredContact: true,
        timezone: true,
        inviteStatus: true,
      },
      orderBy: { name: "asc" },
    }),
    db.creatorGroup.findMany({
      where: { agencyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        members: { orderBy: { sortOrder: "asc" }, select: { creatorId: true } },
      },
    }),
    db.requestTemplate.findMany({
      where: { agencyId, isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.contentRequest.groupBy({
      by: ["templateId"],
      where: { agencyId, templateId: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.contentRequest.count({ where: { agencyId } }),
    allowedCategories(userId),
    loadEmailBranding(agencyId, agencyName),
  ]);

  const useBy = new Map(usage.map((u) => [u.templateId, u]));

  let portalHost = "";
  try {
    portalHost = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").host;
  } catch {
    portalHost = "";
  }

  return {
    creators: creators.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      hasPhone: !!c.phone,
      preferredContact: c.preferredContact,
      timezone: c.timezone,
      inviteStatus: c.inviteStatus,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberIds: g.members.map((m) => m.creatorId),
    })),
    templates: templates
      .filter((t) => !allowed || !t.categoryId || allowed.includes(t.categoryId))
      .map((t) => {
        const u = useBy.get(t.id);
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          richContent: (t.richContent as RichContent | null) ?? null,
          fields: parseFields(t.fields),
          defaultDueDays: t.defaultDueDays,
          defaultUrgency: t.defaultUrgency,
          usageCount: u?._count._all ?? 0,
          lastUsedAt: u?._max.createdAt?.toISOString() ?? null,
        };
      }),
    emailFrom: branding.fromName,
    portalHost,
    totalRequests,
  };
}
