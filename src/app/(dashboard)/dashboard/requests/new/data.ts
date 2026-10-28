import { db } from "@/lib/db";
import { creatorWhere, requestWhere, type Access } from "@/lib/access/server";
import { loadEmailBranding } from "@/lib/email";
import type { TemplateField, RichContent } from "@/lib/template-types";
import { readPlan, type AgencyMessaging, type MessagingPlan } from "@/lib/messaging";
import { loadAgencyMessaging } from "@/lib/messaging-server";

/* Everything the composer needs, read once on the server. */

/**
 * A creator as the composer sees them. Fields the person's role hides
 * (creatorInfo.*) are blank: email "", the rest null.
 */
export interface ComposeCreator {
  id: string;
  name: string;
  email: string;
  hasPhone: boolean;
  preferredContact: "EMAIL" | "SMS" | "BOTH" | null;
  timezone: string | null;
  inviteStatus: string | null;
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
  /** Creator messages for requests made from it; null = agency defaults */
  messaging: MessagingPlan | null;
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
  /** The agency's creator-message defaults (Reminders, Email and texts) */
  agencyMessaging: AgencyMessaging;
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
  access: Access,
  agencyName?: string
): Promise<ComposeData> {
  const { agencyId, userId } = access;
  const [creators, groups, templates, usage, totalRequests, allowed, branding, agencyMessaging] = await Promise.all([
    db.creator.findMany({
      where: { ...creatorWhere(access), archivedAt: null },
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
      where: { ...requestWhere(access), templateId: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.contentRequest.count({ where: requestWhere(access) }),
    allowedCategories(userId),
    loadEmailBranding(agencyId, agencyName),
    loadAgencyMessaging(agencyId),
  ]);

  const useBy = new Map(usage.map((u) => [u.templateId, u]));

  let portalHost = "";
  try {
    portalHost = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").host;
  } catch {
    portalHost = "";
  }

  const visible = new Set(creators.map((c) => c.id));
  const show = {
    email: access.has("creatorInfo.email"),
    preferences: access.has("creatorInfo.preferences"),
    location: access.has("creatorInfo.location"),
    invite: access.has("creatorInfo.invite"),
  };

  return {
    creators: creators.map((c) => ({
      id: c.id,
      name: c.name,
      email: show.email ? c.email : "",
      // Whether a text can go at all; the number itself never leaves the server
      hasPhone: !!c.phone,
      preferredContact: show.preferences ? c.preferredContact : null,
      timezone: show.location ? c.timezone : null,
      inviteStatus: show.invite ? c.inviteStatus : null,
    })),
    // Groups list only the creators this person may see
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberIds: g.members.map((m) => m.creatorId).filter((id) => visible.has(id)),
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
          messaging: readPlan(t.messaging),
        };
      }),
    emailFrom: branding.fromName,
    portalHost,
    totalRequests,
    agencyMessaging,
  };
}
