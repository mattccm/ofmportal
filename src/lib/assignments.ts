import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { excludePseudoUsers } from "./staff";
import { loadRoles, roleIdOf } from "./access/roles";

/**
 * Which teammates look after which creators. Stored on each teammate as
 * User.assignedCreatorIds (a JSON list of creator ids). A role whose creator
 * scope is "Creators assigned to them" sees exactly that list; for everyone
 * else it says who looks after a creator. Server only.
 */

const ids = (v: Prisma.JsonValue | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Teammate ids assigned to a creator */
export async function teammatesFor(agencyId: string, creatorId: string): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { agencyId, AND: [excludePseudoUsers], assignedCreatorIds: { array_contains: [creatorId] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** One teammate's assigned creators */
export async function creatorsFor(userId: string): Promise<string[]> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { assignedCreatorIds: true } });
  return ids(u?.assignedCreatorIds);
}

/**
 * Set who looks after a creator. `allowedUserIds` are the teammates the
 * person changing it may see: others keep whatever they had.
 */
export async function setTeammatesFor(agencyId: string, creatorId: string, userIds: string[], allowedUserIds: string[]) {
  const allowed = new Set(allowedUserIds);
  const want = new Set(userIds.filter((id) => allowed.has(id)));
  const staff = await db.user.findMany({
    where: { agencyId, id: { in: [...allowed] } },
    select: { id: true, assignedCreatorIds: true },
  });
  const updates = staff.flatMap((u) => {
    const now = ids(u.assignedCreatorIds);
    const has = now.includes(creatorId);
    if (want.has(u.id) === has) return [];
    const next = want.has(u.id) ? [...now, creatorId] : now.filter((id) => id !== creatorId);
    return [db.user.update({ where: { id: u.id }, data: { assignedCreatorIds: next } })];
  });
  if (updates.length) await db.$transaction(updates);
  return { changed: updates.length };
}

/**
 * Set a teammate's creators. `allowedCreatorIds` are the creators the person
 * changing it may see: assignments to creators they can't see are kept.
 */
export async function setCreatorsFor(userId: string, creatorIds: string[], allowedCreatorIds: string[]) {
  const allowed = new Set(allowedCreatorIds);
  const now = await creatorsFor(userId);
  const kept = now.filter((id) => !allowed.has(id));
  const chosen = [...new Set(creatorIds.filter((id) => allowed.has(id)))];
  const next = [...kept, ...chosen];
  await db.user.update({ where: { id: userId }, data: { assignedCreatorIds: next } });
  return { added: chosen.filter((id) => !now.includes(id)).length, removed: now.filter((id) => allowed.has(id) && !chosen.includes(id)).length };
}

/** Add one creator to a teammate's list (a creator they just added) */
export async function assignCreator(userId: string, creatorId: string) {
  const now = await creatorsFor(userId);
  if (now.includes(creatorId)) return;
  await db.user.update({ where: { id: userId }, data: { assignedCreatorIds: [...now, creatorId] } });
}

/**
 * What a teammate's role does with assignments: "shows" (their role sees only
 * their assigned creators), "all" (sees every creator anyway), or "hidden"
 * (a role limited to chosen creators or groups: an assignment alone won't
 * show them the creator). Keyed by user id; owners count as "all".
 */
export type AssignmentEffect = "shows" | "all" | "hidden";

export async function assignmentEffects(agencyId: string, users: { id: string; role: string; customRoleId: string | null }[]) {
  const roles = await loadRoles(agencyId);
  const presetRowIds = Object.fromEntries(roles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
  const byId = new Map(roles.map((r) => [r.id, r]));
  const out: Record<string, { effect: AssignmentEffect; roleId: string; roleName: string }> = {};
  for (const u of users) {
    const roleId = roleIdOf(u, presetRowIds as Record<string, "admin" | "manager" | "member">);
    const role = byId.get(roleId);
    const scope = roleId === "owner" ? "all" : role?.creatorScope.type ?? "all";
    out[u.id] = { effect: scope === "assigned" ? "shows" : scope === "all" ? "all" : "hidden", roleId, roleName: roleId === "owner" ? "Owner" : role?.name ?? "their role" };
  }
  return out;
}
