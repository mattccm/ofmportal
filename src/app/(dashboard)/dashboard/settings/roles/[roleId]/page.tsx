import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NoAccess } from "@/components/access/no-access";
import { RoleEditor, type RoleEditorData } from "@/components/settings/role-editor";
import { getPageAccess, staffWhere } from "@/lib/access/server";
import { holdersWhere, loadRole, loadRoles, roleIdOf } from "@/lib/access/roles";
import { withCounts } from "@/lib/access/role-input";
import { canGrant } from "@/lib/access/assign";
import { ALL_CREATORS, EVERYONE } from "@/lib/access/catalogue";

export const metadata = { title: "Role · Roles and permissions" };

/** One role: /dashboard/settings/roles/{owner|admin|manager|member|<custom id>|new} */
export default async function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const access = await getPageAccess();
  if (!access.has("roles.manage")) return <NoAccess what="managing roles and permissions" roleName={access.role.name} />;
  const { roleId } = await params;
  const agencyId = access.agencyId;

  const isNew = roleId === "new";
  const role = isNew ? null : await loadRole(agencyId, roleId);
  if (!isNew && !role) notFound();

  const [allRoles, groups, creators, staff] = await Promise.all([
    loadRoles(agencyId).then((r) => withCounts(agencyId, r)),
    db.creatorGroup.findMany({ where: { agencyId }, select: { id: true, name: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }),
    db.creator.findMany({ where: { agencyId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: staffWhere(access),
      select: { id: true, name: true, email: true, role: true, customRoleId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const presetRowIds = Object.fromEntries(allRoles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
  const holders = role
    ? await db.user.findMany({ where: { AND: [staffWhere(access), holdersWhere(role)] }, select: { id: true }, orderBy: { name: "asc" } })
    : [];
  const holderIds = new Set(holders.map((h) => h.id));

  const data: RoleEditorData = {
    role: role
      ? {
          id: role.id,
          kind: role.kind,
          name: role.name,
          description: role.description ?? "",
          color: role.color,
          keys: role.keys,
          creatorScope: role.creatorScope,
          teamScope: role.teamScope,
        }
      : { id: "new", kind: "custom", name: "", description: "", color: null, keys: [], creatorScope: ALL_CREATORS, teamScope: EVERYONE },
    roles: allRoles.map((r) => ({ id: r.id, name: r.name, kind: r.kind, memberCount: r.memberCount, grantable: canGrant(access, r) })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members })),
    creators,
    staff: staff.map((u) => ({ id: u.id, name: u.name, email: u.email, roleId: roleIdOf(u, presetRowIds) })),
    holderIds: [...holderIds],
    me: { id: access.userId, isOwner: access.isOwner, canChangeRoles: access.has("team.changeRoles") },
  };

  return <RoleEditor data={data} />;
}
