import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendRevisionRequestEmail } from "@/lib/email";
import { sendRevisionRequestSms } from "@/lib/sms";

const rejectSchema = z.object({
  uploadIds: z.array(z.string()).min(1),
  requestId: z.string(),
  reason: z.string().min(1, "Rejection reason is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { uploadIds, requestId, reason } = rejectSchema.parse(body);

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
        status: "REJECTED",
      },
    });

    // Add comment with rejection reason
    await db.comment.create({
      data: {
        requestId,
        userId: session.user.id,
        message: `Uploads rejected: ${reason}`,
        isInternal: false,
      },
    });

    // Update request status
    await db.contentRequest.update({
      where: { id: requestId },
      data: {
        status: "NEEDS_REVISION",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      },
    });

    // Notify creator
    const portalLink = `${process.env.APP_URL}/portal/${request.creator.id}/requests/${requestId}`;

    try {
      await sendRevisionRequestEmail({
        to: request.creator.email,
        creatorName: request.creator.name,
        requestTitle: request.title,
        feedback: reason,
        portalLink,
      });

      if (
        request.creator.phone &&
        (request.creator.preferredContact === "SMS" ||
          request.creator.preferredContact === "BOTH")
      ) {
        await sendRevisionRequestSms({
          to: request.creator.phone,
          creatorName: request.creator.name,
          requestTitle: request.title,
          portalLink,
        });
      }
    } catch (error) {
      console.error("Failed to send rejection notification:", error);
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "upload.rejected",
        entityType: "Upload",
        entityId: uploadIds.join(","),
        metadata: {
          count: uploadIds.length,
          requestId,
          reason,
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

    console.error("Error rejecting uploads:", error);
    return NextResponse.json(
      { error: "Failed to reject uploads" },
      { status: 500 }
    );
  }
}
