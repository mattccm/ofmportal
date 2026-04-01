import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleCreatorResponse } from "@/lib/auto-reminder-scheduler";
import { validateCreatorSession } from "@/lib/portal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }
    const creator = authResult.creator;

    // Get request
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        creatorId: creator.id,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check if there are uploads
    const uploadCount = await db.upload.count({
      where: {
        requestId: id,
        uploadStatus: "COMPLETED",
      },
    });

    if (uploadCount === 0) {
      return NextResponse.json(
        { error: "Please upload at least one file before submitting" },
        { status: 400 }
      );
    }

    // Update request status
    await db.contentRequest.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    // Auto-cancel pending reminders when creator submits
    await handleCreatorResponse(id, "submitted").catch((err) => {
      console.error("Error cancelling reminders on submit:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting request:", error);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }
}
