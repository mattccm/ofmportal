import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const createReplySchema = z.object({
  content: z.string().min(1, "Reply is required"),
});

// ============================================
// HELPERS
// ============================================

interface RouteParams {
  params: Promise<{ id: string; timestampId: string }>;
}

async function verifyTimestampAccess(uploadId: string, timestampId: string, agencyId: string) {
  const upload = await db.upload.findFirst({
    where: {
      id: uploadId,
      request: {
        agencyId,
      },
    },
  });

  if (!upload) return null;

  const timestamp = await db.videoTimestamp.findFirst({
    where: {
      id: timestampId,
      uploadId,
    },
  });

  return timestamp;
}

// ============================================
// GET - Fetch replies for a timestamp
// ============================================

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId, timestampId } = await params;

    // Verify access
    const timestamp = await verifyTimestampAccess(uploadId, timestampId, session.user.agencyId);
    if (!timestamp) {
      return NextResponse.json({ error: "Timestamp not found" }, { status: 404 });
    }

    // Fetch replies
    const replies = await db.videoTimestampReply.findMany({
      where: { timestampId },
      orderBy: { createdAt: "asc" },
    });

    // Get user info
    const userIds = new Set<string>();
    replies.forEach((r) => userIds.add(r.userId));

    const users = await db.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const repliesWithUsers = replies.map((r) => ({
      ...r,
      user: userMap.get(r.userId) || { id: r.userId, name: "Unknown", avatar: null },
    }));

    return NextResponse.json({ replies: repliesWithUsers });
  } catch (error) {
    console.error("Error fetching replies:", error);
    return NextResponse.json(
      { error: "Failed to fetch replies" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a reply
// ============================================

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId, timestampId } = await params;

    // Verify access
    const timestamp = await verifyTimestampAccess(uploadId, timestampId, session.user.agencyId);
    if (!timestamp) {
      return NextResponse.json({ error: "Timestamp not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = createReplySchema.parse(body);

    // Create reply
    const reply = await db.videoTimestampReply.create({
      data: {
        timestampId,
        userId: session.user.id,
        content: validatedData.content,
      },
    });

    // Get user info
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, avatar: true },
    });

    return NextResponse.json({
      reply: {
        ...reply,
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

    console.error("Error creating reply:", error);
    return NextResponse.json(
      { error: "Failed to create reply" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update a reply
// ============================================

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId, timestampId } = await params;
    const { searchParams } = new URL(req.url);
    const replyId = searchParams.get("replyId");

    if (!replyId) {
      return NextResponse.json(
        { error: "Reply ID is required" },
        { status: 400 }
      );
    }

    // Verify access
    const timestamp = await verifyTimestampAccess(uploadId, timestampId, session.user.agencyId);
    if (!timestamp) {
      return NextResponse.json({ error: "Timestamp not found" }, { status: 404 });
    }

    // Verify reply exists and user owns it
    const existingReply = await db.videoTimestampReply.findFirst({
      where: {
        id: replyId,
        timestampId,
      },
    });

    if (!existingReply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404 }
      );
    }

    if (existingReply.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own replies" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createReplySchema.parse(body);

    // Update reply
    const reply = await db.videoTimestampReply.update({
      where: { id: replyId },
      data: {
        content: validatedData.content,
      },
    });

    // Get user info
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, avatar: true },
    });

    return NextResponse.json({
      reply: {
        ...reply,
        user: user || { id: session.user.id, name: "Unknown", avatar: null },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating reply:", error);
    return NextResponse.json(
      { error: "Failed to update reply" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a reply
// ============================================

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId, timestampId } = await params;
    const { searchParams } = new URL(req.url);
    const replyId = searchParams.get("replyId");

    if (!replyId) {
      return NextResponse.json(
        { error: "Reply ID is required" },
        { status: 400 }
      );
    }

    // Verify access
    const timestamp = await verifyTimestampAccess(uploadId, timestampId, session.user.agencyId);
    if (!timestamp) {
      return NextResponse.json({ error: "Timestamp not found" }, { status: 404 });
    }

    // Verify reply exists and user owns it
    const reply = await db.videoTimestampReply.findFirst({
      where: {
        id: replyId,
        timestampId,
      },
    });

    if (!reply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404 }
      );
    }

    if (reply.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own replies" },
        { status: 403 }
      );
    }

    // Delete reply
    await db.videoTimestampReply.delete({
      where: { id: replyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return NextResponse.json(
      { error: "Failed to delete reply" },
      { status: 500 }
    );
  }
}
