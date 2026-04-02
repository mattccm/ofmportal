import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import TeamClient from "./team-client";

async function getTeamMembers(agencyId: string) {
  const members = await db.user.findMany({
    where: { agencyId },
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
      customRole: {
        select: {
          id: true,
          name: true,
          color: true,
          description: true,
        },
      },
      permissionOverrides: true,
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
    orderBy: [
      { role: "asc" },
      { name: "asc" },
    ],
  });

  // Calculate online status for each member (active within last 5 minutes)
  const membersWithStatus = members.map((member) => {
    const isOnline = member.lastActiveAt
      ? new Date().getTime() - new Date(member.lastActiveAt).getTime() < 5 * 60 * 1000
      : false;

    return {
      ...member,
      isOnline,
      lastActiveAt: member.lastActiveAt?.toISOString() || null,
      createdAt: member.createdAt.toISOString(),
      customRole: member.customRole ? {
        ...member.customRole,
      } : null,
      permissionOverrides: (member.permissionOverrides as unknown[]) || [],
      assignedCreatorIds: (member.assignedCreatorIds as unknown[]) || [],
      activityLogs: member.activityLogs.map((log) => ({
        ...log,
        metadata: (log.metadata as Record<string, unknown>) || {},
        createdAt: log.createdAt.toISOString(),
      })),
    };
  });

  return membersWithStatus;
}

async function getCustomRoles(agencyId: string) {
  const roles = await db.customRole.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  return roles;
}

export default async function TeamPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  let members: Awaited<ReturnType<typeof getTeamMembers>>;
  let customRoles: Awaited<ReturnType<typeof getCustomRoles>>;
  try {
    [members, customRoles] = await Promise.all([
      getTeamMembers(session.user.agencyId),
      getCustomRoles(session.user.agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch team data:", error);
    members = [];
    customRoles = [];
  }

  return (
    <TeamClient
      initialMembers={members}
      customRoles={customRoles}
      currentUserRole={session.user.role}
      currentUserId={session.user.id}
    />
  );
}

export const metadata = {
  title: "Team Management | Content Portal",
  description: "Manage your team members and their roles",
};
