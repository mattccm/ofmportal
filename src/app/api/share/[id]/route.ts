import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, requestWhere, uploadWhere, type Access } from "@/lib/access/server";

/** The shared resource is inside this person's creator scope */
async function resourceVisible(access: Access, link: { resourceType: string; resourceId: string }) {
  if (link.resourceType === "UPLOAD") {
    return (await db.upload.count({ where: { AND: [uploadWhere(access), { id: link.resourceId }] } })) > 0;
  }
  if (link.resourceType === "REQUEST") {
    return (await db.contentRequest.count({ where: { AND: [requestWhere(access), { id: link.resourceId }] } })) > 0;
  }
  return true;
}
import { getShareAnalytics } from "@/lib/share";

// GET - Get share link details and analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("review.share");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id } = await params;
    const agencyId = session.user.agencyId;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink || !(await resourceVisible(access, shareLink))) {
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
    const gate = await requireAccess("review.share");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id } = await params;
    const agencyId = session.user.agencyId;
    const userId = session.user.id;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink || !(await resourceVisible(access, shareLink))) {
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
    const gate = await requireAccess("review.share");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id } = await params;
    const agencyId = session.user.agencyId;
    const userId = session.user.id;

    const shareLink = await db.shareLink.findFirst({
      where: {
        id,
        agencyId,
      },
    });

    if (!shareLink || !(await resourceVisible(access, shareLink))) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    // Only the creator or admin can deactivate
    if (shareLink.createdById !== userId) {
      // Turning off someone else's link has its own key (admins by default)
      if (!access.has("review.shareManage")) {
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
