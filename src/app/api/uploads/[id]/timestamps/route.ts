import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const createTimestampSchema = z.object({
  timestamp: z.number().min(0),
  content: z.string().min(1, "Comment is required"),
});

const updateTimestampSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  content: z.string().min(1).optional(),
  resolved: z.boolean().optional(),
});

// ============================================
// HELPERS
// ============================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function verifyUploadAccess(uploadId: string, agencyId: string) {
  const upload = await db.upload.findFirst({
    where: {
      id: uploadId,
      request: {
        agencyId,
      },
    },
    include: {
      request: {
        select: { id: true, agencyId: true },
      },
    },
  });

  return upload;
}

// ============================================
// GET - Fetch timestamps for an upload
// ============================================

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId } = await params;

    // Verify access
    const upload = await verifyUploadAccess(uploadId, session.user.agencyId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Fetch timestamps with replies
    const timestamps = await db.videoTimestamp.findMany({
      where: { uploadId },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Get user info for all user IDs
    const userIds = new Set<string>();
    timestamps.forEach((t) => {
      userIds.add(t.userId);
      t.replies.forEach((r) => userIds.add(r.userId));
    });

    const users = await db.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Combine data
    const timestampsWithUsers = timestamps.map((t) => ({
      ...t,
      user: userMap.get(t.userId) || { id: t.userId, name: "Unknown", avatar: null },
      replies: t.replies.map((r) => ({
        ...r,
        user: userMap.get(r.userId) || { id: r.userId, name: "Unknown", avatar: null },
      })),
    }));

    return NextResponse.json({ timestamps: timestampsWithUsers });
  } catch (error) {
    console.error("Error fetching timestamps:", error);
    return NextResponse.json(
      { error: "Failed to fetch timestamps" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new timestamp
// ============================================

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId } = await params;

    // Verify access
    const upload = await verifyUploadAccess(uploadId, session.user.agencyId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = createTimestampSchema.parse(body);

    // Create timestamp
    const timestamp = await db.videoTimestamp.create({
      data: {
        uploadId,
        userId: session.user.id,
        timestamp: validatedData.timestamp,
        content: validatedData.content,
        resolved: false,
      },
      include: {
        replies: true,
      },
    });

    // Get user info
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, avatar: true },
    });

    return NextResponse.json({
      timestamp: {
        ...timestamp,
        user: user || { id: session.user.id, name: "Unknown", avatar: null },
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating timestamp:", error);
    return NextResponse.json(
      { error: "Failed to create timestamp" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update timestamp(s)
// ============================================

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId } = await params;

    // Verify access
    const upload = await verifyUploadAccess(uploadId, session.user.agencyId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateTimestampSchema.parse(body);

    // Handle bulk update
    if (validatedData.ids && validatedData.ids.length > 0) {
      const updateData: Record<string, unknown> = {};

      if (validatedData.resolved !== undefined) {
        updateData.resolved = validatedData.resolved;
      }

      await db.videoTimestamp.updateMany({
        where: {
          id: { in: validatedData.ids },
          uploadId,
        },
        data: updateData,
      });

      return NextResponse.json({ success: true, updated: validatedData.ids.length });
    }

    // Handle single update
    if (!validatedData.id) {
      return NextResponse.json(
        { error: "id or ids is required" },
        { status: 400 }
      );
    }

    // Verify timestamp exists and belongs to upload
    const existingTimestamp = await db.videoTimestamp.findFirst({
      where: {
        id: validatedData.id,
        uploadId,
      },
    });

    if (!existingTimestamp) {
      return NextResponse.json(
        { error: "Timestamp not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.content !== undefined) {
      // Only owner can edit content
      if (existingTimestamp.userId !== session.user.id) {
        return NextResponse.json(
          { error: "You can only edit your own timestamps" },
          { status: 403 }
        );
      }
      updateData.content = validatedData.content;
    }

    if (validatedData.resolved !== undefined) {
      updateData.resolved = validatedData.resolved;
    }

    // Update timestamp
    const updatedTimestamp = await db.videoTimestamp.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Get user info
    const userIds = new Set<string>();
    userIds.add(updatedTimestamp.userId);
    updatedTimestamp.replies.forEach((r) => userIds.add(r.userId));

    const users = await db.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      timestamp: {
        ...updatedTimestamp,
        user: userMap.get(updatedTimestamp.userId) || { id: updatedTimestamp.userId, name: "Unknown", avatar: null },
        replies: updatedTimestamp.replies.map((r) => ({
          ...r,
          user: userMap.get(r.userId) || { id: r.userId, name: "Unknown", avatar: null },
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating timestamp:", error);
    return NextResponse.json(
      { error: "Failed to update timestamp" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a timestamp
// ============================================

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId } = await params;
    const { searchParams } = new URL(req.url);
    const timestampId = searchParams.get("id");

    if (!timestampId) {
      return NextResponse.json(
        { error: "Timestamp ID is required" },
        { status: 400 }
      );
    }

    // Verify access
    const upload = await verifyUploadAccess(uploadId, session.user.agencyId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Verify timestamp exists and user owns it
    const timestamp = await db.videoTimestamp.findFirst({
      where: {
        id: timestampId,
        uploadId,
      },
    });

    if (!timestamp) {
      return NextResponse.json(
        { error: "Timestamp not found" },
        { status: 404 }
      );
    }

    if (timestamp.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own timestamps" },
        { status: 403 }
      );
    }

    // Delete timestamp (replies will cascade)
    await db.videoTimestamp.delete({
      where: { id: timestampId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting timestamp:", error);
    return NextResponse.json(
      { error: "Failed to delete timestamp" },
      { status: 500 }
    );
  }
}
