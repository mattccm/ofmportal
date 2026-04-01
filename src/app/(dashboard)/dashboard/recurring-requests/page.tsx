import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
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

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });
}

async function getCreatorGroups(agencyId: string) {
  return db.creatorGroup.findMany({
    where: { agencyId },
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
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    return <div>Unauthorized</div>;
  }

  const [templates, creators, creatorGroups] = await Promise.all([
    getTemplates(session.user.agencyId),
    getCreators(session.user.agencyId),
    getCreatorGroups(session.user.agencyId),
  ]);

  // Transform creator groups to include memberCount
  const formattedGroups = creatorGroups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
  }));

  return (
    <RecurringRequestsList
      templates={templates}
      creators={creators}
      creatorGroups={formattedGroups}
    />
  );
}
