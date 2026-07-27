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

// A request "needs review" when it has at least one completed upload still
// awaiting an approval decision. A single groupBy keeps this O(1) queries
// instead of counting uploads per request (N+1).
async function getPendingReviewCounts(agencyId: string) {
  const grouped = await db.upload.groupBy({
    by: ["requestId"],
    where: {
      request: { agencyId },
      status: "PENDING",
      uploadStatus: "COMPLETED",
    },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.requestId, g._count._all]));
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

  let requests: Awaited<ReturnType<typeof getRequests>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let teamMembers: Awaited<ReturnType<typeof getTeamMembers>>;
  let pendingReviewCounts: Awaited<ReturnType<typeof getPendingReviewCounts>>;
  let loadError = false;
  try {
    [requests, creators, teamMembers, pendingReviewCounts] = await Promise.all([
      getRequests(session.user.agencyId),
      getCreators(session.user.agencyId),
      getTeamMembers(session.user.agencyId),
      getPendingReviewCounts(session.user.agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch requests data:", error);
    requests = [];
    creators = [];
    teamMembers = [];
    pendingReviewCounts = new Map();
    // Signal the client so it renders an error + retry instead of a false
    // "No requests yet" empty state when the server-side fetch failed.
    loadError = true;
  }

  // Convert dates to strings for serialization
  const serializedRequests = requests.map((request) => ({
    ...request,
    dueDate: request.dueDate?.toISOString() || null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    submittedAt: request.submittedAt?.toISOString() || null,
    reviewedAt: request.reviewedAt?.toISOString() || null,
    pendingReviewCount: pendingReviewCounts.get(request.id) ?? 0,
  }));

  return (
    <RequestsList
      initialRequests={serializedRequests}
      creators={creators}
      currentUserId={session.user.id}
      teamMembers={teamMembers}
      initialError={loadError}
    />
  );
}
