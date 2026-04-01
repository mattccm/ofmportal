import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { WhitelistedContent } from "@/types/content-fingerprint";

const whitelistCategorySchema = z.enum(["branding", "stock", "template", "other"]);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: whitelistCategorySchema.optional(),
});

/**
 * GET /api/duplicate-attempts/whitelist/[id]
 *
 * Get a specific whitelisted item.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this item" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;

    const item = await db.whitelistedContent.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Whitelisted item not found" },
        { status: 404 }
      );
    }

    const formattedItem: WhitelistedContent = {
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
    };

    return NextResponse.json(formattedItem);
  } catch (error) {
    console.error("Error fetching whitelisted item:", error);
    return NextResponse.json(
      { error: "Failed to fetch whitelisted item" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/duplicate-attempts/whitelist/[id]
 *
 * Update a whitelisted item.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify the whitelist" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;
    const body = await req.json();
    const updates = updateSchema.parse(body);

    // Verify the item exists and belongs to this agency
    const existing = await db.whitelistedContent.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Whitelisted item not found" },
        { status: 404 }
      );
    }

    // Update the item
    const updated = await db.whitelistedContent.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description || null }),
        ...(updates.category && { category: updates.category }),
        updatedAt: new Date(),
      },
    });

    const formattedItem: WhitelistedContent = {
      id: updated.id,
      agencyId: updated.agencyId,
      fileHash: updated.fileHash,
      perceptualHash: updated.perceptualHash || undefined,
      name: updated.name,
      description: updated.description || undefined,
      category: updated.category as WhitelistedContent["category"],
      fileName: updated.fileName,
      fileSize: Number(updated.fileSize),
      mimeType: updated.mimeType,
      thumbnailUrl: updated.thumbnailUrl || undefined,
      createdById: updated.createdById,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    return NextResponse.json(formattedItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating whitelisted item:", error);
    return NextResponse.json(
      { error: "Failed to update whitelisted item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/duplicate-attempts/whitelist/[id]
 *
 * Remove an item from the whitelist.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify the whitelist" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;

    // Verify the item exists and belongs to this agency
    const existing = await db.whitelistedContent.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Whitelisted item not found" },
        { status: 404 }
      );
    }

    // Delete the item
    await db.whitelistedContent.delete({
      where: { id },
    });

    // In production, you would also delete the file from storage

    return NextResponse.json({
      success: true,
      message: "Item removed from whitelist",
    });
  } catch (error) {
    console.error("Error deleting whitelisted item:", error);
    return NextResponse.json(
      { error: "Failed to remove from whitelist" },
      { status: 500 }
    );
  }
}
