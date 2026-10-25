import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import { RequestsList } from "@/components/requests/requests-list";
import { fileFieldsOf, mapFields, type MapSubmission } from "@/components/requests/title-wall-map";

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
      // Minimal upload rows for the field strip and "approve ready" targets.
      uploads: {
        select: { id: true, fieldId: true, status: true, uploadStatus: true },
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
    where: { agencyId, ...excludePseudoUsers },
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
  const now = new Date();
  const serializedRequests = requests.map(({ uploads, fields, fieldSubmissions, ...request }) => {
    const subs = (fieldSubmissions ?? {}) as unknown as Record<string, MapSubmission>;
    const strip = mapFields({ fields, fieldSubmissions, uploads, status: request.status, dueDate: request.dueDate, now });
    const hasFileFields = fileFieldsOf(fields).length > 0;
    // What "Approve ready" acts on: each ready field, approved through the
    // field review route when the creator submitted it, else its pending uploads.
    const readyTargets = strip
      .filter((f) => f.state === "ready")
      .map((f) => ({
        fieldId: hasFileFields ? (f.id as string) : null,
        submitted: hasFileFields && !!subs[f.id as string] && subs[f.id as string].status !== "PENDING",
        uploadIds: uploads
          .filter((u) => u.status === "PENDING" && u.uploadStatus === "COMPLETED" && (!hasFileFields || u.fieldId === f.id))
          .map((u) => u.id),
      }));
    return {
    ...request,
    strip,
    readyTargets,
    dueDate: request.dueDate?.toISOString() || null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    submittedAt: request.submittedAt?.toISOString() || null,
    reviewedAt: request.reviewedAt?.toISOString() || null,
    pendingReviewCount: pendingReviewCounts.get(request.id) ?? 0,
    };
  });

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
