import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { nanoid } from "nanoid";

// ============================================
// VALIDATION SCHEMA
// ============================================

const updateCollectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  privacy: z.enum(["PRIVATE", "TEAM", "PUBLIC"]).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================
// GET - Get single collection with items
// ============================================

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    // Check for share token access (public collections)
    const { searchParams } = new URL(req.url);
    const shareToken = searchParams.get("token");

    let collection;

    if (shareToken) {
      // Public access via share token
      collection = await db.collection.findFirst({
        where: {
          id,
          shareToken,
          privacy: "PUBLIC",
        },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
          _count: {
            select: { items: true },
          },
        },
      });
    } else {
      // Authenticated access
      if (!session?.user?.agencyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      collection = await db.collection.findFirst({
        where: {
          id,
          agencyId: session.user.agencyId,
        },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
          _count: {
            select: { items: true },
          },
        },
      });
    }

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Fetch full upload info for items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadIds = collection.items.map((i: any) => i.uploadId);
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

    // Serialize items with full upload info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = collection.items.map((item: any) => {
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

    return NextResponse.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      privacy: collection.privacy,
      tags: collection.tags,
      color: collection.color,
      itemCount: collection._count.items,
      shareToken: collection.shareToken,
      items,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update collection
// ============================================

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const existing = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateCollectionSchema.parse(body);

    // Handle share token for privacy changes
    let shareToken = existing.shareToken;
    if (validatedData.privacy) {
      if (validatedData.privacy === "PUBLIC" && !shareToken) {
        shareToken = nanoid(12);
      } else if (validatedData.privacy !== "PUBLIC") {
        shareToken = null;
      }
    }

    const collection = await db.collection.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.coverImage !== undefined && { coverImage: validatedData.coverImage }),
        ...(validatedData.privacy && { privacy: validatedData.privacy }),
        ...(validatedData.tags && { tags: validatedData.tags }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        shareToken,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      privacy: collection.privacy,
      tags: collection.tags,
      color: collection.color,
      itemCount: collection._count.items,
      shareToken: collection.shareToken,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating collection:", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete collection
// ============================================

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check collection exists and belongs to agency
    const existing = await db.collection.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Delete collection (items will cascade delete)
    await db.collection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
