import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ============================================
// GET - Check if an item is favorited
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const itemType = searchParams.get("itemType");

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: "itemId and itemType are required" },
        { status: 400 }
      );
    }

    const validTypes = ["CREATOR", "REQUEST", "TEMPLATE", "UPLOAD"];
    if (!validTypes.includes(itemType.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid itemType" },
        { status: 400 }
      );
    }

    // Build the where clause based on type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: session.user.id,
      itemType: itemType.toUpperCase(),
    };

    switch (itemType.toUpperCase()) {
      case "CREATOR":
        where.creatorId = itemId;
        break;
      case "REQUEST":
        where.requestId = itemId;
        break;
      case "TEMPLATE":
        where.templateId = itemId;
        break;
      case "UPLOAD":
        where.uploadId = itemId;
        break;
    }

    const favorite = await db.favorite.findFirst({
      where,
      select: { id: true, createdAt: true, note: true },
    });

    return NextResponse.json({
      isFavorited: !!favorite,
      favoriteId: favorite?.id || null,
      note: favorite?.note || null,
      favoritedAt: favorite?.createdAt || null,
    });
  } catch (error) {
    console.error("Error checking favorite status:", error);
    return NextResponse.json(
      { error: "Failed to check favorite status" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Batch check multiple items
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    // Limit batch size
    if (items.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 items per batch" },
        { status: 400 }
      );
    }

    // Get all favorites for the user
    const favorites = await db.favorite.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        itemType: true,
        creatorId: true,
        requestId: true,
        templateId: true,
        uploadId: true,
      },
    });

    // Create a lookup map
    const favoriteMap = new Map<string, string>();
    favorites.forEach((fav) => {
      const itemId =
        fav.creatorId || fav.requestId || fav.templateId || fav.uploadId;
      if (itemId) {
        const key = `${fav.itemType}:${itemId}`;
        favoriteMap.set(key, fav.id);
      }
    });

    // Check each item
    const results: Record<string, { isFavorited: boolean; favoriteId: string | null }> = {};
    items.forEach((item: { itemId: string; itemType: string }) => {
      const key = `${item.itemType.toUpperCase()}:${item.itemId}`;
      const favoriteId = favoriteMap.get(key);
      results[item.itemId] = {
        isFavorited: !!favoriteId,
        favoriteId: favoriteId || null,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error batch checking favorites:", error);
    return NextResponse.json(
      { error: "Failed to check favorites" },
      { status: 500 }
    );
  }
}
