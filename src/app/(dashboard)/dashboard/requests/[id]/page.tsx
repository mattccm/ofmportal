import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { getPageAccess, requestWhere, creatorWhere, staffWhere, redactCreator, redactCreatorsIn, type Access } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { RequestDetailClient } from "@/components/requests/request-detail-client";
import { type Note } from "@/lib/notes-utils";

async function getRequest(requestId: string, access: Access) {
  return db.contentRequest.findFirst({
    where: { AND: [requestWhere(access), { id: requestId }] },
    include: {
      creator: true,
      template: true,
      uploads: {
        orderBy: { createdAt: "desc" },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      },
      // Sent reminders feed the page's History (read only)
      reminders: {
        where: { sentAt: { not: null }, isTestReminder: false },
        select: { id: true, type: true, channel: true, sentAt: true },
        orderBy: { sentAt: "desc" },
        take: 20,
      },
      watchers: {
        where: { user: staffWhere(access) },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function getCreators(access: Access) {
  return db.creator.findMany({
    where: creatorWhere(access),
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
    orderBy: { name: "asc" },
  });
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getPageAccess();
  if (!access.has("requests.view")) return <NoAccess what="requests" roleName={access.role.name} />;
  const session = await getServerSession(authOptions);

  let request, creators;
  try {
    [request, creators] = await Promise.all([
      getRequest(id, access),
      getCreators(access),
    ]);
  } catch (error) {
    console.error("Failed to fetch request data:", error);
    notFound();
  }

  if (!request) {
    notFound();
  }

  // Serialize BigInt values for uploads
  const serializedUploads = request.uploads.map(upload => ({
    ...upload,
    fileSize: upload.fileSize.toString(),
  }));

  // Serialize watchers
  const serializedWatchers = request.watchers.map(watcher => ({
    ...watcher,
    createdAt: watcher.createdAt.toISOString(),
  }));

  // Extract internal notes from requirements JSON
  const requirements = (request.requirements as Record<string, unknown>) || {};
  const internalNotes = (requirements.internalNotes as Note[]) || [];

  // Type assertion for the request with serialized data
  const serializedRequest = {
    ...request,
    uploads: serializedUploads,
    watchers: serializedWatchers,
  };

  return (
    <RequestDetailClient
      request={redactCreatorsIn(access, serializedRequest) as unknown as Parameters<typeof RequestDetailClient>[0]['request']}
      creators={redactCreator(access, creators)}
      initialNotes={internalNotes}
      currentUserId={access.userId}
      currentUser={{
        id: access.userId,
        name: session?.user?.name || "Unknown",
        role: session?.user?.role ?? "MEMBER",
      }}
    />
  );
}
