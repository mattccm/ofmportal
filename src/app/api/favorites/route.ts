import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const favoriteSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  itemType: z.enum(["CREATOR", "REQUEST", "TEMPLATE", "UPLOAD"]),
  note: z.string().max(500).optional(),
});

// ============================================
// GET - List all favorites for user
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: session.user.id,
      agencyId: session.user.agencyId,
    };

    if (type && type !== "all") {
      where.itemType = type.toUpperCase();
    }

    const skip = (page - 1) * pageSize;

    // Get favorites with pagination
    const [favorites, total] = await Promise.all([
      db.favorite.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.favorite.count({ where }),
    ]);

    // Group favorites by type and fetch related items
    const creatorIds = favorites
      .filter((f) => f.itemType === "CREATOR" && f.creatorId)
      .map((f) => f.creatorId!);
    const requestIds = favorites
      .filter((f) => f.itemType === "REQUEST" && f.requestId)
      .map((f) => f.requestId!);
    const templateIds = favorites
      .filter((f) => f.itemType === "TEMPLATE" && f.templateId)
      .map((f) => f.templateId!);
    const uploadIds = favorites
      .filter((f) => f.itemType === "UPLOAD" && f.uploadId)
      .map((f) => f.uploadId!);

    // Fetch related items in parallel
    const [creators, requests, templates, uploads] = await Promise.all([
      creatorIds.length > 0
        ? db.creator.findMany({
            where: { id: { in: creatorIds } },
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              inviteStatus: true,
              _count: {
                select: { requests: true, uploads: true },
              },
            },
          })
        : [],
      requestIds.length > 0
        ? db.contentRequest.findMany({
            where: { id: { in: requestIds } },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              dueDate: true,
              creatorId: true,
              creator: {
                select: { name: true },
              },
              _count: {
                select: { uploads: true },
              },
            },
          })
        : [],
      templateIds.length > 0
        ? db.requestTemplate.findMany({
            where: { id: { in: templateIds } },
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
              fields: true,
              _count: {
                select: { requests: true },
              },
            },
          })
        : [],
      uploadIds.length > 0
        ? db.upload.findMany({
            where: { id: { in: uploadIds } },
            select: {
              id: true,
              fileName: true,
              originalName: true,
              fileType: true,
              fileSize: true,
              thumbnailUrl: true,
              status: true,
              rating: true,
              creator: {
                select: { id: true, name: true },
              },
              request: {
                select: { id: true, title: true },
              },
            },
          })
        : [],
    ]);

    // Create lookup maps
    const creatorMap = new Map(creators.map((c) => [c.id, c]));
    const requestMap = new Map(requests.map((r) => [r.id, r]));
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

    // Enrich favorites with item data
    const enrichedFavorites = favorites.map((fav) => {
      let item = null;

      switch (fav.itemType) {
        case "CREATOR":
          item = fav.creatorId ? creatorMap.get(fav.creatorId) : null;
          break;
        case "REQUEST":
          item = fav.requestId ? requestMap.get(fav.requestId) : null;
          break;
        case "TEMPLATE":
          item = fav.templateId ? templateMap.get(fav.templateId) : null;
          break;
        case "UPLOAD":
          const upload = fav.uploadId ? uploadMap.get(fav.uploadId) : null;
          if (upload) {
            item = {
              ...upload,
              fileSize: Number(upload.fileSize),
            };
          }
          break;
      }

      return {
        id: fav.id,
        itemType: fav.itemType,
        itemId:
          fav.creatorId || fav.requestId || fav.templateId || fav.uploadId,
        note: fav.note,
        createdAt: fav.createdAt,
        item,
      };
    });

    // Filter out any favorites where the item no longer exists
    const validFavorites = enrichedFavorites.filter((f) => f.item !== null);

    // Group by type for the response
    const grouped = {
      creators: validFavorites.filter((f) => f.itemType === "CREATOR"),
      requests: validFavorites.filter((f) => f.itemType === "REQUEST"),
      templates: validFavorites.filter((f) => f.itemType === "TEMPLATE"),
      uploads: validFavorites.filter((f) => f.itemType === "UPLOAD"),
    };

    return NextResponse.json({
      favorites: validFavorites,
      grouped,
      counts: {
        creators: grouped.creators.length,
        requests: grouped.requests.length,
        templates: grouped.templates.length,
        uploads: grouped.uploads.length,
        total: validFavorites.length,
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add item to favorites
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = favoriteSchema.parse(body);

    // Check if item exists based on type
    let itemExists = false;
    switch (validatedData.itemType) {
      case "CREATOR":
        const creator = await db.creator.findFirst({
          where: {
            id: validatedData.itemId,
            agencyId: session.user.agencyId,
          },
        });
        itemExists = !!creator;
        break;
      case "REQUEST":
        const request = await db.contentRequest.findFirst({
          where: {
            id: validatedData.itemId,
            agencyId: session.user.agencyId,
          },
        });
        itemExists = !!request;
        break;
      case "TEMPLATE":
        const template = await db.requestTemplate.findFirst({
          where: {
            id: validatedData.itemId,
            agencyId: session.user.agencyId,
          },
        });
        itemExists = !!template;
        break;
      case "UPLOAD":
        const upload = await db.upload.findFirst({
          where: {
            id: validatedData.itemId,
            creator: {
              agencyId: session.user.agencyId,
            },
          },
        });
        itemExists = !!upload;
        break;
    }

    if (!itemExists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Build the favorite data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const favoriteData: any = {
      userId: session.user.id,
      agencyId: session.user.agencyId,
      itemType: validatedData.itemType,
      note: validatedData.note || null,
    };

    // Set the appropriate ID field based on type
    switch (validatedData.itemType) {
      case "CREATOR":
        favoriteData.creatorId = validatedData.itemId;
        break;
      case "REQUEST":
        favoriteData.requestId = validatedData.itemId;
        break;
      case "TEMPLATE":
        favoriteData.templateId = validatedData.itemId;
        break;
      case "UPLOAD":
        favoriteData.uploadId = validatedData.itemId;
        break;
    }

    // Create favorite (will fail if already exists due to unique constraint)
    const favorite = await db.favorite.create({
      data: favoriteData,
    });

    return NextResponse.json(
      {
        id: favorite.id,
        itemType: favorite.itemType,
        itemId: validatedData.itemId,
        note: favorite.note,
        createdAt: favorite.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    // Check for unique constraint violation (already favorited)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Item already in favorites" },
        { status: 409 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error adding favorite:", error);
    return NextResponse.json(
      { error: "Failed to add favorite" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove item from favorites
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = favoriteSchema.parse(body);

    // Build the where clause based on type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: session.user.id,
      itemType: validatedData.itemType,
    };

    switch (validatedData.itemType) {
      case "CREATOR":
        where.creatorId = validatedData.itemId;
        break;
      case "REQUEST":
        where.requestId = validatedData.itemId;
        break;
      case "TEMPLATE":
        where.templateId = validatedData.itemId;
        break;
      case "UPLOAD":
        where.uploadId = validatedData.itemId;
        break;
    }

    // Find and delete the favorite
    const favorite = await db.favorite.findFirst({ where });

    if (!favorite) {
      return NextResponse.json(
        { error: "Favorite not found" },
        { status: 404 }
      );
    }

    await db.favorite.delete({
      where: { id: favorite.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error removing favorite:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    );
  }
}
