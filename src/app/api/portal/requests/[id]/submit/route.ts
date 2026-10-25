import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleCreatorResponse } from "@/lib/auto-reminder-scheduler";
import { validateCreatorSession, CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import type { Prisma, RequestStatus } from "@prisma/client";

// Only requests still awaiting the creator can be (re)submitted
const SUBMITTABLE_STATUSES: RequestStatus[] = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];

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
        status: { notIn: CREATOR_HIDDEN_STATUSES },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (!SUBMITTABLE_STATUSES.includes(request.status)) {
      return NextResponse.json(
        { error: "This request can no longer be submitted" },
        { status: 409 }
      );
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

    // Sending the request in sends every field that has unreviewed uploads,
    // so staff review (and the "ready" counts) see those fields as submitted
    const now = new Date();
    const unreviewed = await db.upload.findMany({
      where: { requestId: id, uploadStatus: "COMPLETED", status: "PENDING", fieldId: { not: null } },
      select: { fieldId: true },
      distinct: ["fieldId"],
    });
    const fieldSubmissions = { ...((request.fieldSubmissions as Record<string, Record<string, unknown>> | null) ?? {}) };
    for (const { fieldId } of unreviewed) {
      if (!fieldId || fieldSubmissions[fieldId]?.status === "APPROVED") continue;
      fieldSubmissions[fieldId] = { ...fieldSubmissions[fieldId], status: "SUBMITTED", submittedAt: now.toISOString() };
    }

    // Update request status (guarded so a concurrent status change isn't overwritten)
    const updated = await db.contentRequest.updateMany({
      where: { id, creatorId: creator.id, status: { in: SUBMITTABLE_STATUSES } },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        fieldSubmissions: fieldSubmissions as Prisma.InputJsonValue,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "This request can no longer be submitted" },
        { status: 409 }
      );
    }

    // Fire webhook for request submission (after() keeps it alive past the response)
    after(() =>
      dispatchWebhookEvent(request.agencyId, "request.submitted", {
        requestId: id,
        title: request.title,
        creatorId: creator.id,
        creatorName: creator.name,
        uploadCount,
      })
    );

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
