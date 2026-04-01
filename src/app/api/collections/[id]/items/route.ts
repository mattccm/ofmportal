import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const addItemsSchema = z.object({
  uploadIds: z.array(z.string()).min(1, "At least one upload ID is required"),
});

const removeItemsSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
});

const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    sortOrder: z.number().int().min(0),
  })),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================
// GET - Get items in collection
// ============================================

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const collection = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const items = await db.collectionItem.findMany({
      where: { collectionId: id },
      orderBy: { sortOrder: "asc" },
    });

    // Fetch full upload info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadIds = items.map((i: any) => i.uploadId);
    const uploads = uploadIds.length > 0
      ? await db.upload.findMany({
          where: { id: { in: uploadIds } },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
            request: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : [];

    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedItems = items.map((item: any) => {
      const upload = uploadMap.get(item.uploadId);
      return {
        id: item.id,
        uploadId: item.uploadId,
        sortOrder: item.sortOrder,
        notes: item.notes,
        addedAt: item.addedAt,
        upload: upload ? {
          id: upload.id,
          fileName: upload.fileName,
          originalName: upload.originalName,
          fileType: upload.fileType,
          fileSize: Number(upload.fileSize),
          thumbnailUrl: upload.thumbnailUrl,
          storageUrl: upload.storageUrl,
          status: upload.status,
          rating: upload.rating,
          uploadedAt: upload.uploadedAt,
          creator: upload.creator,
          request: upload.request,
        } : null,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((item: any) => item.upload !== null);

    return NextResponse.json({ items: serializedItems });
  } catch (error) {
    console.error("Error fetching collection items:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection items" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add items to collection
// ============================================

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const collection = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = addItemsSchema.parse(body);

    // Verify uploads exist and belong to agency
    const uploads = await db.upload.findMany({
      where: {
        id: { in: validatedData.uploadIds },
        request: {
          agencyId: session.user.agencyId,
        },
      },
      select: { id: true },
    });

    const validUploadIds = uploads.map((u) => u.id);

    if (validUploadIds.length === 0) {
      return NextResponse.json(
        { error: "No valid uploads found" },
        { status: 400 }
      );
    }

    // Get current max sort order
    const maxOrderResult = await db.collectionItem.findFirst({
      where: { collectionId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    let currentOrder = (maxOrderResult?.sortOrder ?? -1) + 1;

    // Check for existing items to avoid duplicates
    const existingItems = await db.collectionItem.findMany({
      where: {
        collectionId: id,
        uploadId: { in: validUploadIds },
      },
      select: { uploadId: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUploadIds = new Set(existingItems.map((i: any) => i.uploadId));
    const newUploadIds = validUploadIds.filter((id) => !existingUploadIds.has(id));

    if (newUploadIds.length === 0) {
      return NextResponse.json(
        { error: "All uploads already in collection", added: 0 },
        { status: 200 }
      );
    }

    // Add new items
    const newItems = await db.$transaction(
      newUploadIds.map((uploadId) =>
        db.collectionItem.create({
          data: {
            collectionId: id,
            uploadId,
            sortOrder: currentOrder++,
          },
        })
      )
    );

    // Update item count
    await db.collection.update({
      where: { id },
      data: {
        itemCount: { increment: newItems.length },
      },
    });

    return NextResponse.json({
      added: newItems.length,
      skipped: validUploadIds.length - newItems.length,
      items: newItems,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error adding items to collection:", error);
    return NextResponse.json(
      { error: "Failed to add items to collection" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Reorder items in collection
// ============================================

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const collection = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = reorderItemsSchema.parse(body);

    // Update sort orders in transaction
    await db.$transaction(
      validatedData.items.map((item) =>
        db.collectionItem.updateMany({
          where: {
            id: item.id,
            collectionId: id,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error reordering collection items:", error);
    return NextResponse.json(
      { error: "Failed to reorder collection items" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove items from collection
// ============================================

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const collection = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = removeItemsSchema.parse(body);

    // Delete items
    const result = await db.collectionItem.deleteMany({
      where: {
        id: { in: validatedData.itemIds },
        collectionId: id,
      },
    });

    // Update item count
    if (result.count > 0) {
      await db.collection.update({
        where: { id },
        data: {
          itemCount: { decrement: result.count },
        },
      });
    }

    return NextResponse.json({
      removed: result.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error removing items from collection:", error);
    return NextResponse.json(
      { error: "Failed to remove items from collection" },
      { status: 500 }
    );
  }
}
