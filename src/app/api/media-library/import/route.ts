import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { MediaType } from "@prisma/client";

// POST /api/media-library/import
// Body: { creatorId, uploadIds: string[], folderId?, tags? }
// Returns: { imported: number }
//
// Creates MediaItem rows from existing (approved) Upload records, copying their
// storage/thumbnail keys and file metadata. Scoped to the caller's agency.
const importSchema = z.object({
  creatorId: z.string().min(1),
  uploadIds: z.array(z.string()).min(1, "At least one upload is required"),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

function mimeToMediaType(mime: string): MediaType {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = importSchema.parse(body);
    const agencyId = session.user.agencyId;

    // Verify creator belongs to the caller's agency
    const creator = await db.creator.findFirst({
      where: { id: data.creatorId, agencyId },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Verify destination folder belongs to this creator/agency
    if (data.folderId) {
      const folder = await db.mediaFolder.findFirst({
        where: { id: data.folderId, agencyId, creatorId: data.creatorId },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    // Load the selected uploads, scoped to this creator + agency.
    const uploads = await db.upload.findMany({
      where: {
        id: { in: data.uploadIds },
        creatorId: data.creatorId,
        request: { agencyId },
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json({ imported: 0 });
    }

    // Skip uploads already present in this creator's library (dedupe by storageKey).
    const existing = await db.mediaItem.findMany({
      where: {
        agencyId,
        creatorId: data.creatorId,
        storageKey: { in: uploads.map((u) => u.storageKey) },
      },
      select: { storageKey: true },
    });
    const existingKeys = new Set(existing.map((e) => e.storageKey));

    const toImport = uploads.filter((u) => !existingKeys.has(u.storageKey));

    if (toImport.length === 0) {
      return NextResponse.json({ imported: 0 });
    }

    await db.mediaItem.createMany({
      data: toImport.map((u) => {
        const metadata =
          u.metadata && typeof u.metadata === "object"
            ? (u.metadata as Record<string, unknown>)
            : {};
        return {
          agencyId,
          creatorId: data.creatorId,
          name: u.originalName || u.fileName,
          fileName: u.fileName,
          fileType: u.fileType,
          fileSize: u.fileSize,
          type: mimeToMediaType(u.fileType),
          storageKey: u.storageKey,
          storageUrl: u.storageUrl,
          thumbnailKey: u.thumbnailKey,
          thumbnailUrl: u.thumbnailUrl,
          folderId: data.folderId ?? null,
          tags: data.tags,
          status: "ACTIVE" as const,
          metadata: {
            ...metadata,
            sourceUploadId: u.id,
            sourceRequestId: u.requestId,
          },
          usedInRequests: [],
        };
      }),
    });

    // Keep the destination folder's cached count in sync.
    if (data.folderId) {
      await db.mediaFolder.update({
        where: { id: data.folderId },
        data: { itemCount: { increment: toImport.length } },
      });
    }

    // Log activity (best-effort)
    await db.activityLog
      .create({
        data: {
          userId: session.user.id,
          action: "media.imported",
          entityType: "MediaItem",
          entityId: data.creatorId,
          metadata: {
            creatorId: data.creatorId,
            count: toImport.length,
          },
        },
      })
      .catch(() => {});

    return NextResponse.json({ imported: toImport.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error importing uploads to media library:", error);
    return NextResponse.json(
      { error: "Failed to import uploads" },
      { status: 500 }
    );
  }
}
