import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { nanoid } from "nanoid";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCollectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  coverImage: z.string().url().optional().nullable(),
  privacy: z.enum(["PRIVATE", "TEAM", "PUBLIC"]).default("PRIVATE"),
  tags: z.array(z.string()).default([]),
  color: z.string().optional().nullable(),
});

// ============================================
// GET - List all collections for agency
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const privacy = searchParams.get("privacy");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort") || "updatedAt";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "24", 10);

    // Build where clause
    const where: Record<string, unknown> = {
      agencyId: session.user.agencyId,
    };

    // Filter by privacy
    if (privacy && privacy !== "all") {
      where.privacy = privacy.toUpperCase();
    }

    // Search by name or description
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by tag
    if (tag) {
      where.tags = { array_contains: [tag] };
    }

    const skip = (page - 1) * pageSize;

    // Get collections with pagination
    const [collections, total] = await Promise.all([
      db.collection.findMany({
        where,
        include: {
          items: {
            take: 4,
            orderBy: { sortOrder: "asc" },
            include: {
              // We need to get upload info for thumbnails
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          [sort]: order,
        },
        skip,
        take: pageSize,
      }),
      db.collection.count({ where }),
    ]);

    // Fetch upload thumbnails for collection previews
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadIds = collections.flatMap((c: any) => c.items.map((i: any) => i.uploadId));
    const uploads = uploadIds.length > 0
      ? await db.upload.findMany({
          where: { id: { in: uploadIds } },
          select: {
            id: true,
            thumbnailUrl: true,
            fileName: true,
            fileType: true,
          },
        })
      : [];

    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

    // Serialize collections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedCollections = collections.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      coverImage: c.coverImage,
      privacy: c.privacy,
      tags: c.tags,
      color: c.color,
      itemCount: c._count.items,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      previewItems: c.items.map((item: any) => {
        const upload = uploadMap.get(item.uploadId);
        return {
          id: item.id,
          uploadId: item.uploadId,
          thumbnailUrl: upload?.thumbnailUrl,
          fileName: upload?.fileName,
          fileType: upload?.fileType,
        };
      }),
      shareToken: c.shareToken,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json({
      collections: serializedCollections,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new collection
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createCollectionSchema.parse(body);

    // Generate share token if public
    const shareToken = validatedData.privacy === "PUBLIC" ? nanoid(12) : null;

    const collection = await db.collection.create({
      data: {
        agencyId: session.user.agencyId,
        createdById: session.user.id,
        name: validatedData.name,
        description: validatedData.description || null,
        coverImage: validatedData.coverImage || null,
        privacy: validatedData.privacy,
        tags: validatedData.tags,
        color: validatedData.color || null,
        shareToken,
        itemCount: 0,
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
      itemCount: 0,
      previewItems: [],
      shareToken: collection.shareToken,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}
