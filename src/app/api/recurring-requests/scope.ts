import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, type Access } from "@/lib/access/server";
import type { PermissionKey } from "@/lib/access/catalogue";

/**
 * Creator scope for schedules (recurring requests, scheduled tasks) and other
 * workflow objects that name creators and creator groups by id.
 *
 * A schedule is visible to someone only when every creator and every creator
 * group it targets is inside their creator scope, so nobody sees or changes
 * a schedule that sends to creators they can't see.
 */

/** Creator groups this person may target: all groups, their scope's groups, or none */
export function creatorGroupWhere(access: Pick<Access, "agencyId" | "creatorScope">): Prisma.CreatorGroupWhereInput {
  const s = access.creatorScope;
  if (s.type === "groups") return { agencyId: access.agencyId, id: { in: s.groupIds } };
  if (s.type === "creators") return { agencyId: access.agencyId, id: { in: [] } };
  return { agencyId: access.agencyId };
}

/** Ids among `ids` that are in this person's creator scope */
export async function visibleCreatorIds(access: Access, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Set();
  if (access.creatorScope.type === "all") {
    const rows = await db.creator.findMany({ where: { agencyId: access.agencyId, id: { in: unique } }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }
  const rows = await db.creator.findMany({ where: { AND: [creatorWhere(access), { id: { in: unique } }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** True when this person may target every listed creator group */
export function groupsInScope(access: Pick<Access, "creatorScope">, groupIds: string[]): boolean {
  const s = access.creatorScope;
  if (s.type === "all" || groupIds.length === 0) return true;
  if (s.type === "groups") return groupIds.every((g) => s.groupIds.includes(g));
  return false;
}

const asIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Keep only the rows whose creators and creator groups are all in scope.
 * One query for the whole list.
 */
export async function filterTargetsInScope<T extends { creatorIds: unknown; creatorGroupIds: unknown }>(
  access: Access,
  rows: T[]
): Promise<T[]> {
  if (access.creatorScope.type === "all") return rows;
  const visible = await visibleCreatorIds(access, rows.flatMap((r) => asIds(r.creatorIds)));
  return rows.filter(
    (r) => asIds(r.creatorIds).every((id) => visible.has(id)) && groupsInScope(access, asIds(r.creatorGroupIds))
  );
}

/** True when one row's creators and creator groups are all in scope */
export async function targetsInScope(
  access: Access,
  row: { creatorIds: unknown; creatorGroupIds: unknown }
): Promise<boolean> {
  return (await filterTargetsInScope(access, [row])).length === 1;
}

/** What a scheduled task does when it runs, as the permission that action needs */
export const TASK_TYPE_KEY: Record<string, PermissionKey> = {
  CREATE_REQUEST: "requests.create",
  APPLY_BUNDLE: "bundles.run",
  SEND_REMINDER: "reminders.send",
  SEND_BULK_EMAIL: "messages.email",
};
