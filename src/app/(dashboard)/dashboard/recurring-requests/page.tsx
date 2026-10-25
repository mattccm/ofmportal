import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, redactCreator } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { creatorGroupWhere } from "@/app/api/recurring-requests/scope";
import { RecurringRequestsList } from "@/components/recurring-requests";

async function getTemplates(agencyId: string) {
  return db.requestTemplate.findMany({
    where: {
      agencyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });
}

// Only creators and groups inside this person's creator scope; email only
// for roles that may see it (never even loaded otherwise)
async function getCreators(where: Prisma.CreatorWhereInput, withEmail: boolean) {
  return db.creator.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: withEmail,
    },
    orderBy: { name: "asc" },
  });
}

async function getCreatorGroups(where: Prisma.CreatorGroupWhereInput) {
  return db.creatorGroup.findMany({
    where,
    select: {
      id: true,
      name: true,
      _count: {
        select: { members: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export default async function RecurringRequestsPage() {
  const access = await getPageAccess();
  if (!access.has("recurring.view")) {
    return <NoAccess what="recurring requests" roleName={access.role.name} />;
  }

  let templates: Awaited<ReturnType<typeof getTemplates>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let creatorGroups: Awaited<ReturnType<typeof getCreatorGroups>>;
  try {
    [templates, creators, creatorGroups] = await Promise.all([
      getTemplates(access.agencyId),
      getCreators(creatorWhere(access), access.has("creatorInfo.email")),
      getCreatorGroups(creatorGroupWhere(access)),
    ]);
  } catch (error) {
    console.error("Failed to fetch recurring requests data:", error);
    templates = [];
    creators = [];
    creatorGroups = [];
  }

  // Transform creator groups to include memberCount
  const formattedGroups = creatorGroups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
  }));

  return (
    <RecurringRequestsList
      templates={templates}
      creators={redactCreator(access, creators)}
      creatorGroups={formattedGroups}
    />
  );
}
