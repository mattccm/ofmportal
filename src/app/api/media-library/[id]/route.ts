import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// PATCH /api/media-library/[id]
// Path-param form of the media-item update used by drag-to-folder (sends
// `{ folderId }`) and inline edits. Mirrors the ?id= PATCH in the base route.
const updateSchema = z.object({
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  name: z.string().optional(),
  // `title` is the client-facing alias for `name`
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Load existing item scoped to the caller's agency.
    const existingItem = await db.mediaItem.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Handle folder change (adjust cached counts on both sides).
    if (data.folderId !== undefined && data.folderId !== existingItem.folderId) {
      if (data.folderId) {
        const folder = await db.mediaFolder.findFirst({
          where: {
            id: data.folderId,
            agencyId: session.user.agencyId,
            creatorId: existingItem.creatorId,
          },
          select: { id: true },
        });

        if (!folder) {
          return NextResponse.json(
            { error: "Folder not found" },
            { status: 404 }
          );
        }
      }

      if (existingItem.folderId) {
        await db.mediaFolder.update({
          where: { id: existingItem.folderId },
          data: { itemCount: { decrement: 1 } },
        });
      }

      if (data.folderId) {
        await db.mediaFolder.update({
          where: { id: data.folderId },
          data: { itemCount: { increment: 1 } },
        });
      }
    }

    // Merge description into the metadata JSON blob (no dedicated column).
    const nextMetadata =
      data.description !== undefined
        ? {
            ...((existingItem.metadata as Record<string, unknown> | null) ?? {}),
            description: data.description,
          }
        : undefined;

    const updatedItem = await db.mediaItem.update({
      where: { id },
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
