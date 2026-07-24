import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// POST /api/media-library/bulk
// Body: { itemIds: string[], action: "move" | "tag" | "archive" | "delete", folderId?, tags? }
// Returns: { success: true, updated: number }
//
// All actions are scoped to the caller's agency; items outside the agency are
// silently ignored (never touched). Folder itemCount is kept consistent on
// move and delete.
const bulkSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item is required"),
  action: z.enum(["move", "tag", "archive", "delete"]),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = bulkSchema.parse(body);

    // Load only the items that belong to the caller's agency.
    const items = await db.mediaItem.findMany({
      where: {
        id: { in: data.itemIds },
        agencyId: session.user.agencyId,
      },
      select: { id: true, folderId: true, tags: true, creatorId: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const itemIds = items.map((i) => i.id);

    // Helper: decrement cached counts for a set of source folders.
    const decrementFolders = async (folderIds: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const fid of folderIds) {
        if (fid) counts.set(fid, (counts.get(fid) ?? 0) + 1);
      }
      await Promise.all(
        Array.from(counts.entries()).map(([fid, n]) =>
          db.mediaFolder.update({
            where: { id: fid },
            data: { itemCount: { decrement: n } },
          })
        )
      );
    };

    if (data.action === "delete") {
      await decrementFolders(items.map((i) => i.folderId));
      await db.mediaItem.deleteMany({ where: { id: { in: itemIds } } });
    } else if (data.action === "archive") {
      // Status change only; folder membership (and its count) is unchanged.
      await db.mediaItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: "ARCHIVED" },
      });
    } else if (data.action === "move") {
      const targetFolderId = data.folderId ?? null;

      // Verify the destination folder belongs to the agency.
      if (targetFolderId) {
        const target = await db.mediaFolder.findFirst({
          where: { id: targetFolderId, agencyId: session.user.agencyId },
          select: { id: true },
        });
        if (!target) {
          return NextResponse.json(
            { error: "Destination folder not found" },
            { status: 404 }
          );
        }
      }

      // Only items actually changing folders affect counts.
      const moving = items.filter((i) => i.folderId !== targetFolderId);
      await decrementFolders(moving.map((i) => i.folderId));
      if (targetFolderId && moving.length > 0) {
        await db.mediaFolder.update({
          where: { id: targetFolderId },
          data: { itemCount: { increment: moving.length } },
        });
      }
      await db.mediaItem.updateMany({
        where: { id: { in: itemIds } },
        data: { folderId: targetFolderId },
      });
    } else if (data.action === "tag") {
      // Merge (union) the provided tags into each item's existing tags.
      const newTags = data.tags ?? [];
      if (newTags.length > 0) {
        await Promise.all(
          items.map((item) => {
            const existing = Array.isArray(item.tags)
              ? (item.tags as string[])
              : [];
            const merged = Array.from(new Set([...existing, ...newTags]));
            return db.mediaItem.update({
              where: { id: item.id },
              data: { tags: merged },
            });
          })
        );
      }
    }

    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error performing bulk media action:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
