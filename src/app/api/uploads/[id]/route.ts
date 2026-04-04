import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/uploads/[id]
 * Delete an upload - only allowed if:
 * - Creator owns the request AND upload is not yet submitted/approved
 * - Team member with agency access
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try creator auth first
    const creatorAuth = await validateCreatorSession(req);
    if (creatorAuth.success) {
      const creator = creatorAuth.creator;

      // Find the upload and verify ownership
      const upload = await db.upload.findFirst({
        where: { id },
        include: {
          request: {
            select: {
              id: true,
              creatorId: true,
              status: true,
            },
          },
        },
      });

      if (!upload) {
        return NextResponse.json({ error: "Upload not found" }, { status: 404 });
      }

      // Verify creator owns this request
      if (upload.request.creatorId !== creator.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Only allow deletion if request is not yet submitted/approved
      const allowedStatuses = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION", "DRAFT"];
      if (!allowedStatuses.includes(upload.request.status)) {
        return NextResponse.json(
          { error: "Cannot delete uploads after submission" },
          { status: 400 }
        );
      }

      // Also check individual upload status - can't delete approved uploads
      if (upload.status === "APPROVED") {
        return NextResponse.json(
          { error: "Cannot delete approved uploads" },
          { status: 400 }
        );
      }

      // Delete from storage
      try {
        await deleteFile(upload.storageKey);
        if (upload.thumbnailKey) {
          await deleteFile(upload.thumbnailKey);
        }
      } catch (storageError) {
        console.error("Failed to delete file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      await db.upload.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    }

    // Fall back to team member auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the upload and verify agency access
    const upload = await db.upload.findFirst({
      where: {
        id,
        request: {
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Delete from storage
    try {
      await deleteFile(upload.storageKey);
      if (upload.thumbnailKey) {
        await deleteFile(upload.thumbnailKey);
      }
    } catch (storageError) {
      console.error("Failed to delete file from storage:", storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await db.upload.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 }
    );
  }
}
