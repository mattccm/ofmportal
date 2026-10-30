import { db } from "@/lib/db";
import { listOpenStaffInvites, type StaffInviteRow } from "@/lib/staff-invites";
import { NoAccess } from "@/components/access/no-access";
import { getPageAccess, staffWhere, type Access } from "@/lib/access/server";
import { loadRoles, roleIdOf } from "@/lib/access/roles";
import { withCounts } from "@/lib/access/role-input";
import { canGrant } from "@/lib/access/assign";
import TeamClient, { type TeamRole } from "./team-client";

async function getTeamMembers(access: Access, presetRowIds: Record<string, string>) {
  const members = await db.user.findMany({
    where: staffWhere(access),
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      lastActiveAt: true,
      createdAt: true,
      twoFactorEnabled: true,
      customRoleId: true,
      assignedCreatorIds: true,
      activityLogs: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return members.map(({ assignedCreatorIds, ...member }) => ({
    ...member,
    assignedCount: Array.isArray(assignedCreatorIds) ? assignedCreatorIds.length : 0,
    roleId: roleIdOf(member, presetRowIds as Record<string, "admin" | "manager" | "member">),
    // Active within the last 5 minutes
    isOnline: member.lastActiveAt ? Date.now() - new Date(member.lastActiveAt).getTime() < 5 * 60 * 1000 : false,
    lastActiveAt: member.lastActiveAt?.toISOString() || null,
    createdAt: member.createdAt.toISOString(),
    activityLogs: member.activityLogs.map((log) => ({
      ...log,
      metadata: (log.metadata as Record<string, unknown>) || {},
      createdAt: log.createdAt.toISOString(),
    })),
  }));
}

export default async function TeamPage() {
  const access = await getPageAccess();
  if (!access.has("team.view")) return <NoAccess what="the team page" roleName={access.role.name} />;

  const canInvite = access.has("team.invite");
  let members: Awaited<ReturnType<typeof getTeamMembers>> = [];
  let roles: TeamRole[] = [];
  let invites: StaffInviteRow[] = [];
  try {
    const all = await withCounts(access.agencyId, await loadRoles(access.agencyId));
    const presetRowIds = Object.fromEntries(all.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
    roles = all.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      color: r.color,
      description: r.description,
      memberCount: r.memberCount,
      grantable: canGrant(access, r),
      creatorScope: r.kind === "owner" ? "all" : r.creatorScope.type,
    }));
    [members, invites] = await Promise.all([
      getTeamMembers(access, presetRowIds),
      canInvite ? listOpenStaffInvites(access.agencyId) : Promise.resolve([]),
    ]);
  } catch (error) {
    console.error("Failed to fetch team data:", error);
  }

  return (
    <TeamClient
      initialMembers={members}
      roles={roles}
      initialInvites={invites}
      currentUserId={access.userId}
      can={{
        invite: canInvite,
        changeRoles: access.has("team.changeRoles"),
        remove: access.has("team.remove"),
        manageRoles: access.has("roles.manage"),
        isOwner: access.isOwner,
        assign: access.has("creators.assign"),
      }}
    />
  );
}

export const metadata = {
  title: "Team",
  description: "Manage your team members and their roles",
};
