import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// POST /api/media-library/folders
// Body: { creatorId, name, parentId?, description?, color?, icon? }
// Returns: the created folder
const createFolderSchema = z.object({
  creatorId: z.string().min(1),
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createFolderSchema.parse(body);

    // Verify creator belongs to the caller's agency
    const creator = await db.creator.findFirst({
      where: {
        id: data.creatorId,
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // If a parent folder is provided, verify it belongs to this creator/agency
    if (data.parentId) {
      const parent = await db.mediaFolder.findFirst({
        where: {
          id: data.parentId,
          agencyId: session.user.agencyId,
          creatorId: data.creatorId,
        },
        select: { id: true },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }
    }

    try {
      const folder = await db.mediaFolder.create({
        data: {
          agencyId: session.user.agencyId,
          creatorId: data.creatorId,
          name: data.name,
          parentId: data.parentId ?? null,
          description: data.description,
          color: data.color,
          icon: data.icon,
        },
      });

      return NextResponse.json(
        { ...folder, itemCount: Number(folder.itemCount) },
        { status: 201 }
      );
    } catch (error) {
      // @@unique([agencyId, creatorId, name, parentId])
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A folder with this name already exists here" },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating media folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
