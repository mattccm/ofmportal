import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { RequestDetailClient } from "@/components/requests/request-detail-client";
import { type Note } from "@/lib/notes-utils";

async function getRequest(requestId: string, agencyId: string) {
  return db.contentRequest.findFirst({
    where: {
      id: requestId,
      agencyId,
    },
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
            select: { id: true, name: true },
          },
        },
      },
      watchers: {
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

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: {
      agencyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const [request, creators] = await Promise.all([
    getRequest(id, session.user.agencyId),
    getCreators(session.user.agencyId),
  ]);

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
      request={serializedRequest as unknown as Parameters<typeof RequestDetailClient>[0]['request']}
      creators={creators}
      initialNotes={internalNotes}
      currentUserId={session.user.id}
      currentUser={{
        id: session.user.id,
        name: session.user.name || "Unknown",
        role: session.user.role,
      }}
    />
  );
}
