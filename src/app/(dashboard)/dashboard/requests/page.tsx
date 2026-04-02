import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { RequestsList } from "@/components/requests/requests-list";

async function getRequests(agencyId: string) {
  return db.contentRequest.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
      template: {
        select: { id: true, name: true },
      },
      _count: {
        select: { uploads: true, comments: true },
      },
    },
  });
}

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: { agencyId },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

async function getTeamMembers(agencyId: string) {
  return db.user.findMany({
    where: { agencyId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export default async function RequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  let requests, creators, teamMembers;
  try {
    [requests, creators, teamMembers] = await Promise.all([
      getRequests(session.user.agencyId),
      getCreators(session.user.agencyId),
      getTeamMembers(session.user.agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch requests data:", error);
    requests = [];
    creators = [];
    teamMembers = [];
  }

  // Convert dates to strings for serialization
  const serializedRequests = requests.map((request) => ({
    ...request,
    dueDate: request.dueDate?.toISOString() || null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    submittedAt: request.submittedAt?.toISOString() || null,
    reviewedAt: request.reviewedAt?.toISOString() || null,
  }));

  return (
    <RequestsList
      initialRequests={serializedRequests}
      creators={creators}
      currentUserId={session.user.id}
      teamMembers={teamMembers}
    />
  );
}
