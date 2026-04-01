import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { WhitelistedContent } from "@/types/content-fingerprint";

const whitelistCategorySchema = z.enum(["branding", "stock", "template", "other"]);

/**
 * GET /api/duplicate-attempts/whitelist
 *
 * List all whitelisted content for the agency.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and owners can view whitelist
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view the whitelist" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // Build where clause
    const whereClause: Record<string, unknown> = { agencyId };

    if (category && category !== "all") {
      const parsed = whitelistCategorySchema.safeParse(category);
      if (parsed.success) {
        whereClause.category = parsed.data;
      }
    }

    // Fetch whitelisted content
    const items = await db.whitelistedContent.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Format response
    const formattedItems: WhitelistedContent[] = items.map((item) => ({
      id: item.id,
      agencyId: item.agencyId,
      fileHash: item.fileHash,
      perceptualHash: item.perceptualHash || undefined,
      name: item.name,
      description: item.description || undefined,
      category: item.category as WhitelistedContent["category"],
      fileName: item.fileName,
      fileSize: Number(item.fileSize),
      mimeType: item.mimeType,
      thumbnailUrl: item.thumbnailUrl || undefined,
      createdById: item.createdById,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Get stats by category
    const stats = await db.whitelistedContent.groupBy({
      by: ["category"],
      where: { agencyId },
      _count: { category: true },
    });

    const statsByCategory = stats.reduce((acc, item) => {
      acc[item.category] = item._count.category;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      items: formattedItems,
      stats: {
        total: formattedItems.length,
        branding: statsByCategory["branding"] || 0,
        stock: statsByCategory["stock"] || 0,
        template: statsByCategory["template"] || 0,
        other: statsByCategory["other"] || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching whitelist:", error);
    return NextResponse.json(
      { error: "Failed to fetch whitelist" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/duplicate-attempts/whitelist
 *
 * Add content to the whitelist.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and owners can add to whitelist
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify the whitelist" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;
    const formData = await req.formData();

    // Parse form data
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const file = formData.get("file") as File | null;

    // Validate
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const parsedCategory = whitelistCategorySchema.safeParse(category);
    if (!parsedCategory.success) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // Generate file hash
    const buffer = await file.arrayBuffer();
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256");
    hash.update(Buffer.from(buffer));
    const fileHash = hash.digest("hex");

    // Check if already whitelisted
    const existing = await db.whitelistedContent.findFirst({
      where: {
        agencyId,
        fileHash,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This content is already whitelisted" },
        { status: 400 }
      );
    }

    // In production, you would upload the file to storage and generate a thumbnail
    // For now, we'll just store the metadata
    const thumbnailUrl = null; // Would be generated in production

    // Create whitelist entry
    const whitelistedItem = await db.whitelistedContent.create({
      data: {
        agencyId,
        name: name.trim(),
        description: description?.trim() || null,
        category: parsedCategory.data,
        fileHash,
        perceptualHash: null, // Would be generated for images
        fileName: file.name,
        fileSize: BigInt(file.size),
        mimeType: file.type,
        thumbnailUrl,
        createdById: session.user.id,
      },
    });

    const formattedItem: WhitelistedContent = {
      id: whitelistedItem.id,
      agencyId: whitelistedItem.agencyId,
      fileHash: whitelistedItem.fileHash,
      perceptualHash: whitelistedItem.perceptualHash || undefined,
      name: whitelistedItem.name,
      description: whitelistedItem.description || undefined,
      category: whitelistedItem.category as WhitelistedContent["category"],
      fileName: whitelistedItem.fileName,
      fileSize: Number(whitelistedItem.fileSize),
      mimeType: whitelistedItem.mimeType,
      thumbnailUrl: whitelistedItem.thumbnailUrl || undefined,
      createdById: whitelistedItem.createdById,
      createdAt: whitelistedItem.createdAt,
      updatedAt: whitelistedItem.updatedAt,
    };

    return NextResponse.json(formattedItem, { status: 201 });
  } catch (error) {
    console.error("Error adding to whitelist:", error);
    return NextResponse.json(
      { error: "Failed to add to whitelist" },
      { status: 500 }
    );
  }
}
