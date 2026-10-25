import { db } from "@/lib/db";
import { roleWithin } from "./catalogue";
import { assignmentData, loadRole, loadRoles, roleIdOf, type RoleRecord } from "./roles";
import { staffWhere, type Access } from "./server";

/**
 * Who may hand out which role (invites and role changes):
 * - only an owner makes owners or changes an owner's role, and the last
 *   owner always stays an owner;
 * - someone with "roles.manage" may hand out any other role;
 * - anyone else only roles with no more access than their own.
 */
export function canGrant(access: Access, role: RoleRecord): boolean {
  if (access.isOwner) return true;
  if (role.kind === "owner") return false;
  if (access.has("roles.manage")) return true;
  return roleWithin(role, { keys: access.keys, creatorScope: access.creatorScope, teamScope: access.teamScope });
}

/** Roles this person may hand out, in display order */
export async function grantableRoles(access: Access): Promise<RoleRecord[]> {
  const roles = await loadRoles(access.agencyId);
  return roles.filter((r) => canGrant(access, r));
}

export type AssignResult =
  | { ok: true; member: { id: string; name: string; email: string; role: string; customRoleId: string | null }; previous: string; next: RoleRecord }
  | { ok: false; status: number; error: string };

/** Move a teammate to a role. The caller has already checked "team.changeRoles". */
export async function changeMemberRole(access: Access, memberId: string, roleId: string): Promise<AssignResult> {
  const member = await db.user.findFirst({
    where: { AND: [staffWhere(access), { id: memberId }] },
    select: { id: true, name: true, email: true, role: true, customRoleId: true },
  });
  if (!member) return { ok: false, status: 404, error: "Teammate not found" };

  const next = await loadRole(access.agencyId, roleId);
  if (!next) return { ok: false, status: 400, error: "That role no longer exists" };

  const roles = await loadRoles(access.agencyId);
  const presetRowIds = Object.fromEntries(roles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
  const currentId = roleIdOf(member, presetRowIds);
  const current = roles.find((r) => r.id === currentId) ?? null;
  if (currentId === next.id) return { ok: false, status: 400, error: `${member.name} already has the ${next.name} role` };

  if (member.id === access.userId && !access.isOwner) {
    return { ok: false, status: 403, error: "You can't change your own role. Ask an owner." };
  }
  if (member.role === "OWNER" && !access.isOwner) {
    return { ok: false, status: 403, error: "Only an owner can change an owner's role" };
  }
  if (next.kind === "owner" && !access.isOwner) {
    return { ok: false, status: 403, error: "Only an owner can make someone an owner" };
  }
  if (!access.isOwner && current) {
    if (current.keys.includes("roles.manage")) {
      return { ok: false, status: 403, error: "Only an owner can change the role of someone who manages roles" };
    }
    if (!canGrant(access, current)) {
      return { ok: false, status: 403, error: `${member.name} has more access than you, so you can't change their role` };
    }
  }
  if (!canGrant(access, next)) {
    return { ok: false, status: 403, error: `You can't give someone the ${next.name} role: it has more access than yours` };
  }
  if (member.role === "OWNER" && next.kind !== "owner") {
    const owners = await db.user.count({ where: { agencyId: access.agencyId, role: "OWNER" } });
    if (owners <= 1) return { ok: false, status: 400, error: "The last owner can't change role. Make someone else an owner first." };
  }

  const updated = await db.user.update({
    where: { id: member.id },
    data: assignmentData(next),
    select: { id: true, name: true, email: true, role: true, customRoleId: true },
  });

  await db.activityLog.create({
    data: {
      userId: access.userId,
      action: "team.role_updated",
      entityType: "User",
      entityId: member.id,
      metadata: { memberName: member.name, previousRole: current?.name ?? currentId, newRole: next.name },
    },
  });

  return { ok: true, member: updated, previous: current?.name ?? currentId, next };
}
