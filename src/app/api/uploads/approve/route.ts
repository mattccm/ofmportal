import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContentApprovedEmail } from "@/lib/email";
import { sendContentApprovedSms } from "@/lib/sms";

const approveSchema = z.object({
  uploadIds: z.array(z.string()).min(1),
  requestId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uploadIds, requestId } = approveSchema.parse(body);

    // Verify request belongs to agency
    const request = await db.contentRequest.findFirst({
      where: {
        id: requestId,
        agencyId: session.user.agencyId,
      },
      include: {
        creator: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Update uploads
    await db.upload.updateMany({
      where: {
        id: { in: uploadIds },
        requestId,
      },
      data: {
        status: "APPROVED",
      },
    });

    // Check if all uploads are now approved
    const pendingUploads = await db.upload.count({
      where: {
        requestId,
        status: { not: "APPROVED" },
      },
    });

    if (pendingUploads === 0) {
      // All approved - update request status
      await db.contentRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        },
      });

      // Notify creator
      try {
        await sendContentApprovedEmail({
          to: request.creator.email,
          creatorName: request.creator.name,
          requestTitle: request.title,
        });

        if (
          request.creator.phone &&
          (request.creator.preferredContact === "SMS" ||
            request.creator.preferredContact === "BOTH")
        ) {
          await sendContentApprovedSms({
            to: request.creator.phone,
            creatorName: request.creator.name,
            requestTitle: request.title,
          });
        }
      } catch (error) {
        console.error("Failed to send approval notification:", error);
      }
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.approved",
        entityType: "Upload",
        entityId: uploadIds.join(","),
        metadata: {
          count: uploadIds.length,
          requestId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error approving uploads:", error);
    return NextResponse.json(
      { error: "Failed to approve uploads" },
      { status: 500 }
    );
  }
}
