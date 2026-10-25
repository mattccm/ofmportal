import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, staffWhere, type Access } from "@/lib/access/server";
import type { PermissionKey } from "@/lib/access/catalogue";

/**
 * Activity feeds (the Activity page, the activity timelines on creator and
 * request pages, the overview's recent activity, oversight) show work on
 * creators, requests and uploads. The feed needs activity.view and is limited
 * to the creators and teammates inside the person's scopes.
 */
export const ACTIVITY_KEYS: PermissionKey[] = ["activity.view"];

export interface ActivityScope {
  /** null = every creator in the agency */
  creatorIds: string[] | null;
  /** null = every teammate */
  staffIds: string[] | null;
}

/** Resolve the ids behind a role's creator and team scopes (null when unrestricted) */
export async function activityScopeOf(
  access: Pick<Access, "agencyId" | "userId" | "creatorScope" | "teamScope">
): Promise<ActivityScope> {
  const [creatorIds, staffIds] = await Promise.all([
    access.creatorScope.type === "all"
      ? null
      : db.creator.findMany({ where: creatorWhere(access), select: { id: true } }).then((r) => r.map((c) => c.id)),
    access.teamScope.type === "all"
      ? null
      : db.user.findMany({ where: staffWhere(access), select: { id: true } }).then((r) => r.map((u) => u.id)),
  ]);
  return { creatorIds, staffIds };
}

/**
 * SQL WHERE body for "ActivityLog" a: activity on this agency's uploads,
 * requests and creators, limited to the creator scope, and done by a teammate
 * inside the team scope (creator actions and system rows stay).
 */
export function activityFeedSql(agencyId: string, scope: ActivityScope): Prisma.Sql {
  const ids = scope.creatorIds;
  const crScope = ids ? Prisma.sql`AND cr."creatorId" = ANY(${ids}::text[])` : Prisma.empty;
  const cScope = ids ? Prisma.sql`AND c.id = ANY(${ids}::text[])` : Prisma.empty;
  const staff = scope.staffIds
    ? Prisma.sql`AND (
        a."userId" IS NULL
        OR a."userId" = ANY(${scope.staffIds}::text[])
        OR EXISTS (SELECT 1 FROM "User" pu WHERE pu.id = a."userId" AND pu.email LIKE '%.internal')
      )`
    : Prisma.empty;
  return Prisma.sql`(
    (a."entityType" = 'Upload' AND EXISTS (
      SELECT 1 FROM "Upload" up
      JOIN "ContentRequest" cr ON up."requestId" = cr.id
      WHERE up.id = a."entityId" AND cr."agencyId" = ${agencyId} ${crScope}
    ))
    OR (a."entityType" = 'ContentRequest' AND EXISTS (
      SELECT 1 FROM "ContentRequest" cr
      WHERE cr.id = a."entityId" AND cr."agencyId" = ${agencyId} ${crScope}
    ))
    OR (a."entityType" = 'Creator' AND EXISTS (
      SELECT 1 FROM "Creator" c
      WHERE c.id = a."entityId" AND c."agencyId" = ${agencyId} ${cScope}
    ))
  ) ${staff}`;
}

/** Metadata keys each creator-information permission unlocks */
const META_FIELDS: [PermissionKey, RegExp][] = [
  ["creatorInfo.email", /(^email$|Email$|^to$|recipient)/i],
  ["creatorInfo.phone", /phone/i],
  ["creatorInfo.notes", /note/i],
  ["creatorInfo.location", /(timezone|location)/i],
  ["creatorInfo.preferences", /(preferen|preferredContact)/i],
  ["creatorInfo.invite", /(invite(Token|Link|Url|Expires)|token)/i],
  ["creatorInfo.activity", /(lastLogin|lastActive|lastSeen|ipAddress|userAgent)/i],
];

/** Drop creator details from activity metadata that this role may not see */
export function redactActivityMetadata(
  access: Pick<Access, "has">,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const hidden = META_FIELDS.filter(([key]) => !access.has(key)).map(([, re]) => re);
  if (hidden.length === 0) return metadata;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!hidden.some((re) => re.test(k))) out[k] = v;
  }
  return out;
}

/**
 * Keep only activity rows (with entityType/entityId) whose creator is inside
 * the scope. Rows about other things (settings, team) are kept.
 */
export async function filterActivityByCreatorScope<T extends { entityType: string; entityId: string }>(
  access: Pick<Access, "agencyId" | "creatorScope">,
  rows: T[]
): Promise<T[]> {
  if (access.creatorScope.type === "all" || rows.length === 0) return rows;
  const idsOf = (type: string) => rows.filter((r) => r.entityType === type).map((r) => r.entityId);
  const scope = creatorWhere(access);
  const [creators, requests, uploads] = await Promise.all([
    db.creator.findMany({ where: { AND: [scope, { id: { in: idsOf("Creator") } }] }, select: { id: true } }),
    db.contentRequest.findMany({
      where: { AND: [{ creator: scope }, { id: { in: idsOf("ContentRequest") } }] },
      select: { id: true },
    }),
    db.upload.findMany({
      where: { AND: [{ request: { creator: scope } }, { id: { in: idsOf("Upload") } }] },
      select: { id: true },
    }),
  ]);
  const ok = new Set([...creators, ...requests, ...uploads].map((x) => x.id));
  const scoped = new Set(["Creator", "ContentRequest", "Upload"]);
  return rows.filter((r) => !scoped.has(r.entityType) || ok.has(r.entityId));
}
