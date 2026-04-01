import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Validation schemas
const createMediaItemSchema = z.object({
  creatorId: z.string(),
  name: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().positive(),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().optional(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = queryParamsSchema.parse(Object.fromEntries(searchParams));

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: params.creatorId,
        agencyId: session.user.agencyId,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      creatorId: params.creatorId,
      agencyId: session.user.agencyId,
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createMediaItemSchema.parse(body);

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id: data.creatorId,
        agencyId: session.user.agencyId,
      },
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
        agencyId: session.user.agencyId,
        creatorId: data.creatorId,
        name: data.name,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: BigInt(data.fileSize),
        storageKey: data.storageKey,
        thumbnailKey: data.thumbnailKey,
        type: data.type,
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
        userId: session.user.id,
        action: "media.created",
        entityType: "MediaItem",
        entityId: mediaItem.id,
        metadata: {
          creatorId: data.creatorId,
          fileName: data.fileName,
          type: data.type,
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        agencyId: session.user.agencyId,
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

    // Update item
    const updatedItem = await db.mediaItem.update({
      where: { id: itemId },
      data: {
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.tags && { tags: data.tags }),
        ...(data.name !== undefined && { name: data.name }),
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
    }

    // Get existing item and verify access
    const existingItem = await db.mediaItem.findFirst({
      where: {
        id: itemId,
        agencyId: session.user.agencyId,
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

    // Delete the item (storage cleanup would happen via background job)
    await db.mediaItem.delete({
      where: { id: itemId },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
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
