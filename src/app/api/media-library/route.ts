import { NextRequest, NextResponse } from "next/server";
import { creatorWhere, forbidden, requireAccess } from "@/lib/access/server";
import { mediaScope } from "@/app/api/media-library/_scope";
import { db } from "@/lib/db";
import { deleteUnreferencedStorageObjects } from "@/lib/media-refs";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Map the client-facing lowercase media type to the Prisma MediaType enum.
const MEDIA_TYPE_MAP = {
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
  document: "DOCUMENT",
} as const;

// Validation schema for creating a media item.
//
// Two callers finalize through this route with slightly different field names:
//   - server-side callers may send `name` + `type` (uppercase enum) + `fileType` (MIME)
//   - the uploader (media-uploader.tsx) sends `title` + `mediaType` (lowercase) + `mimeType`
// The schema accepts both shapes and normalizes them below.
const createMediaItemSchema = z.object({
  creatorId: z.string(),
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  fileName: z.string().min(1),
  originalName: z.string().optional(),
  fileType: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().positive(),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().optional(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
  mediaType: z.enum(["image", "video", "audio", "document"]).optional(),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  fingerprint: z.string().optional(),
});

const updateMediaItemSchema = z.object({
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  name: z.string().optional(),
  // `title` is the client-facing alias for `name`
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
});

const queryParamsSchema = z.object({
  creatorId: z.string(),
  folderId: z.string().optional().nullable(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
  tags: z.string().optional(), // Comma-separated tags
  search: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "fileSize"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().positive().optional().default(1),
  limit: z.coerce.number().positive().max(100).optional().default(50),
});

// GET - List media items with filters
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const { searchParams } = new URL(req.url);
    const params = queryParamsSchema.parse(Object.fromEntries(searchParams));

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id: params.creatorId }] },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      creatorId: params.creatorId,
      agencyId: access.agencyId,
    };

    if (params.folderId !== undefined) {
      where.folderId = params.folderId;
    }

    if (params.type) {
      where.type = params.type;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.tags) {
      const tagList = params.tags.split(",").map((t) => t.trim());
      where.tags = { hasSome: tagList };
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { fileName: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await db.mediaItem.count({ where });

    // Get items with pagination
    const items = await db.mediaItem.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortOrder },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });

    // Get folders for this creator
    const folders = await db.mediaFolder.findMany({
      where: { creatorId: params.creatorId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        fileSize: Number(item.fileSize),
        // Aliases the media-library UI reads (mediaType/mimeType/title/originalName/usageCount)
        mediaType: item.type.toLowerCase(),
        mimeType: item.fileType,
        title: item.name,
        originalName: item.fileName,
        usageCount: Array.isArray(item.usedInRequests) ? item.usedInRequests.length : 0,
      })),
      folders: folders.map((folder) => ({
        ...folder,
        itemCount: Number(folder.itemCount),
      })),
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error fetching media items:", error);
    return NextResponse.json(
      { error: "Failed to fetch media items" },
      { status: 500 }
    );
  }
}

// POST - Create new media item
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const body = await req.json();
    const data = createMediaItemSchema.parse(body);

    // Normalize the two accepted payload shapes into canonical DB fields.
    const resolvedName = data.name ?? data.title ?? data.fileName;
    const resolvedMime = data.mimeType ?? data.fileType ?? "application/octet-stream";
    const resolvedType =
      data.type ?? (data.mediaType ? MEDIA_TYPE_MAP[data.mediaType] : undefined);

    if (!resolvedType) {
      return NextResponse.json(
        { error: "Media type is required (type or mediaType)" },
        { status: 400 }
      );
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id: data.creatorId }] },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Verify folder exists if provided
    if (data.folderId) {
      const folder = await db.mediaFolder.findFirst({
        where: {
          id: data.folderId,
          creatorId: data.creatorId,
        },
      });

      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    // Create media item
    const mediaItem = await db.mediaItem.create({
      data: {
        id: uuidv4(),
        agencyId: access.agencyId,
        creatorId: data.creatorId,
        name: resolvedName,
        fileName: data.fileName,
        fileType: resolvedMime,
        fileSize: BigInt(data.fileSize),
        storageKey: data.storageKey,
        thumbnailKey: data.thumbnailKey,
        type: resolvedType,
        status: "ACTIVE",
        folderId: data.folderId || null,
        tags: data.tags,
        width: data.width,
        height: data.height,
        duration: data.duration,
        metadata: (data.metadata ?? {}) as object,
        fingerprint: data.fingerprint,
        usedInRequests: [],
      },
    });

    // Update folder item count if applicable
    if (data.folderId) {
      await db.mediaFolder.update({
        where: { id: data.folderId },
        data: { itemCount: { increment: 1 } },
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: access.userId,
        action: "media.created",
        entityType: "MediaItem",
        entityId: mediaItem.id,
        metadata: {
          creatorId: data.creatorId,
          fileName: data.fileName,
          type: resolvedType,
        },
      },
    });

    return NextResponse.json(
      {
        ...mediaItem,
        fileSize: Number(mediaItem.fileSize),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating media item:", error);
    return NextResponse.json(
      { error: "Failed to create media item" },
      { status: 500 }
    );
  }
}

// PATCH - Update media item
export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
    }

    const body = await req.json();
    const data = updateMediaItemSchema.parse(body);

    // Get existing item and verify access
    const existingItem = await db.mediaItem.findFirst({
      where: {
        id: itemId,
        ...(await mediaScope(access)),
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Handle folder change
    if (data.folderId !== undefined && data.folderId !== existingItem.folderId) {
      // Verify new folder exists
      if (data.folderId) {
        const folder = await db.mediaFolder.findFirst({
          where: {
            id: data.folderId,
            creatorId: existingItem.creatorId,
          },
        });

        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }
      }

      // Update old folder count
      if (existingItem.folderId) {
        await db.mediaFolder.update({
          where: { id: existingItem.folderId },
          data: { itemCount: { decrement: 1 } },
        });
      }

      // Update new folder count
      if (data.folderId) {
        await db.mediaFolder.update({
          where: { id: data.folderId },
          data: { itemCount: { increment: 1 } },
        });
      }
    }

    // Merge description into the metadata JSON blob (no dedicated column)
    const nextMetadata =
      data.description !== undefined
        ? {
            ...((existingItem.metadata as Record<string, unknown> | null) ?? {}),
            description: data.description,
          }
        : undefined;

    // Update item
    const updatedItem = await db.mediaItem.update({
      where: { id: itemId },
      data: {
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.tags && { tags: data.tags }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.title !== undefined && { name: data.title }),
        ...(nextMetadata !== undefined && { metadata: nextMetadata }),
        ...(data.status && { status: data.status }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updatedItem,
      fileSize: Number(updatedItem.fileSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating media item:", error);
    return NextResponse.json(
      { error: "Failed to update media item" },
      { status: 500 }
    );
  }
}

// DELETE - Delete media item
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
    }

    // Get existing item and verify access
    const existingItem = await db.mediaItem.findFirst({
      where: {
        id: itemId,
        ...(await mediaScope(access)),
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Update folder count if applicable
    if (existingItem.folderId) {
      await db.mediaFolder.update({
        where: { id: existingItem.folderId },
        data: { itemCount: { decrement: 1 } },
      });
    }

    // Delete the item
    await db.mediaItem.delete({
      where: { id: itemId },
    });

    // Best-effort storage cleanup, skipping objects another MediaItem or an
    // Upload (e.g. the upload this item was imported from) still references
    await deleteUnreferencedStorageObjects([existingItem.storageKey, existingItem.thumbnailKey]);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: access.userId,
        action: "media.deleted",
        entityType: "MediaItem",
        entityId: itemId,
        metadata: {
          creatorId: existingItem.creatorId,
          fileName: existingItem.fileName,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media item:", error);
    return NextResponse.json(
      { error: "Failed to delete media item" },
      { status: 500 }
    );
  }
}
