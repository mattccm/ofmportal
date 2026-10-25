import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { visibleMentionIds } from "@/lib/mention-visibility";

// GET /api/mentions/[id] - Get a single mention

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    const mention = await db.mention.findUnique({
      where: { id },
    });

    if (!mention) {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 });
    }

    // Verify the user has access to this mention
    if (mention.mentionedUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the mentioned by user details
    const mentionedBy = await db.user.findUnique({
      where: { id: mention.mentionedById },
      select: { id: true, name: true, email: true, avatar: true },
    });

    // Out of the person's scopes: no text and no link
    const shown = (await visibleMentionIds(access, [mention])).has(mention.id);

    return NextResponse.json({
      ...mention,
      ...(shown ? {} : { content: "", contextUrl: null }),
      mentionedBy,
    });
  } catch (error) {
    console.error("Failed to fetch mention:", error);
    return NextResponse.json(
      { error: "Failed to fetch mention" },
      { status: 500 }
    );
  }
}

// PATCH /api/mentions/[id] - Update a mention (mark as read)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id } = await params;
    const body = await request.json();
    const { read } = body;

    // Verify the mention exists and belongs to the user
    const existingMention = await db.mention.findUnique({
      where: { id },
      select: { mentionedUserId: true },
    });

    if (!existingMention) {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 });
    }

    if (existingMention.mentionedUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update the mention
    const updateData: Record<string, unknown> = {};

    if (typeof read === "boolean") {
      updateData.read = read;
      if (read) {
        updateData.readAt = new Date();
      } else {
        updateData.readAt = null;
      }
    }

    const mention = await db.mention.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(mention);
  } catch (error) {
    console.error("Failed to update mention:", error);
    return NextResponse.json(
      { error: "Failed to update mention" },
      { status: 500 }
    );
  }
}

// DELETE /api/mentions/[id] - Delete a mention

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id } = await params;

    // Verify the mention exists and belongs to the user
    const existingMention = await db.mention.findUnique({
      where: { id },
      select: { mentionedUserId: true },
    });

    if (!existingMention) {
      return NextResponse.json({ error: "Mention not found" }, { status: 404 });
    }

    if (existingMention.mentionedUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.mention.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete mention:", error);
    return NextResponse.json(
      { error: "Failed to delete mention" },
      { status: 500 }
    );
  }
}
