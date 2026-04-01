import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getShareAnalytics } from "@/lib/share";

// GET - Get share link details and analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const analytics = await getShareAnalytics(id);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch share link" },
      { status: 500 }
    );
  }
}

// PATCH - Update share link settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;
    const userId = session.user.id;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    // Only the creator can update the share link
    if (shareLink.createdById !== userId) {
      return NextResponse.json(
        { error: "Only the creator can update this share link" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { isActive, expiresAt } = body as {
      isActive?: boolean;
      expiresAt?: string | null;
    };

    const updateData: Record<string, unknown> = {};

    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updatedLink = await db.shareLink.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updatedLink.id,
      isActive: updatedLink.isActive,
      expiresAt: updatedLink.expiresAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to update share link" },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agencyId = session.user.agencyId;
    const userId = session.user.id;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    // Only the creator or admin can deactivate
    if (shareLink.createdById !== userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || !["OWNER", "ADMIN"].includes(user.role)) {
        return NextResponse.json(
          { error: "Not authorized to deactivate this share link" },
          { status: 403 }
        );
      }
    }

    // Deactivate (soft delete) instead of hard delete
    await db.shareLink.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to deactivate share link" },
      { status: 500 }
    );
  }
}
