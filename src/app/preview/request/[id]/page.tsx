import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getPageAccess, requestWhere } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { BRAND } from "@/lib/brand";
import { CREATOR_UPLOAD_SELECT, serializeCreatorComment, serializeCreatorUpload } from "@/lib/creator-request-payload";
import type { CreatorRequestData } from "@/components/portal/creator-request-view";
import { RequestPreviewClient, type SavedRequestPreview } from "./request-preview-client";

// Generic like every request page: request titles can be explicit
export const metadata: Metadata = {
  title: { absolute: `Preview · ${BRAND.productName}` },
  robots: { index: false, follow: false },
};

/**
 * "Preview as creator" for a request: the creator's request page as it is now,
 * with what they've uploaded and the comments they see, fully interactive and
 * with nothing sent or uploaded. Staff use it to see (and explain) where
 * things are. `new?draft=1` waits for the new-request screen to post the
 * request it's writing. Framed same origin only (see next.config.ts).
 */
export default async function RequestPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const access = await getPageAccess();
  if (!access.has("requests.view")) return <NoAccess what="requests" roleName={access.role.name} />;
  const [{ id }, { draft }] = await Promise.all([params, searchParams]);
  if (id === "new") return <RequestPreviewClient saved={null} waitForDraft={draft === "1"} />;

  const row = await db.contentRequest.findFirst({
    where: { AND: [requestWhere(access), { id }] },
    include: { creator: { select: { name: true } } },
  });
  if (!row) return <RequestPreviewClient saved={null} waitForDraft={false} />;

  // The same uploads and comments the creator's page loads (api/portal/requests/[id])
  const [uploads, comments] = await Promise.all([
    db.upload.findMany({
      where: { requestId: id, uploadStatus: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: CREATOR_UPLOAD_SELECT,
    }),
    db.comment.findMany({
      where: { requestId: id, isInternal: false },
      include: { user: { select: { name: true, avatar: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  const { creator, ...request } = row;
  const saved: SavedRequestPreview = {
    // As JSON, the way the creator's page receives it
    request: JSON.parse(JSON.stringify(request, (_k, v) => (typeof v === "bigint" ? Number(v) : v))) as CreatorRequestData,
    uploads: (await Promise.all(uploads.map(serializeCreatorUpload))).map((u) => ({ ...u, thumbnailUrl: u.thumbnailUrl ?? undefined })),
    comments: comments.map((c) => serializeCreatorComment(c, creator.name)),
    creatorName: creator.name,
  };
  return <RequestPreviewClient saved={saved} waitForDraft={false} />;
}
