import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import type { Prisma } from "@prisma/client";

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  feedback?: string;
}

/**
 * POST /api/portal/requests/[id]/fields/[fieldId]/submit
 * Creator submits a field for review
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { id, fieldId } = await params;
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }
    const creator = authResult.creator;

    // Find the request
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        creatorId: creator.id,
      },
      include: {
        uploads: {
          where: {
            fieldId,
            uploadStatus: "COMPLETED",
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check request status allows submission
    const allowedStatuses = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];
    if (!allowedStatuses.includes(request.status)) {
      return NextResponse.json(
        { error: "Cannot submit fields in current request status" },
        { status: 400 }
      );
    }

    // Check there are uploads for this field
    if (request.uploads.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded for this field" },
        { status: 400 }
      );
    }

    // Update field submission status
    const fieldSubmissions = (request.fieldSubmissions as unknown as Record<string, FieldSubmission>) || {};
    const existingSubmission = fieldSubmissions[fieldId];

    // Can only submit if PENDING or NEEDS_REVISION (for resubmission)
    if (existingSubmission?.status === "SUBMITTED") {
      return NextResponse.json(
        { error: "Field is already submitted" },
        { status: 400 }
      );
    }

    if (existingSubmission?.status === "APPROVED") {
      return NextResponse.json(
        { error: "Field is already approved" },
        { status: 400 }
      );
    }

    fieldSubmissions[fieldId] = {
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
    };

    // Update request
    await db.contentRequest.update({
      where: { id },
      data: {
        fieldSubmissions: fieldSubmissions as unknown as Prisma.InputJsonValue,
        // Update request status to IN_PROGRESS if it was PENDING
        status: request.status === "PENDING" ? "IN_PROGRESS" : request.status,
      },
    });

    return NextResponse.json({
      success: true,
      fieldSubmission: fieldSubmissions[fieldId],
    });
  } catch (error) {
    console.error("Error submitting field:", error);
    return NextResponse.json(
      { error: "Failed to submit field" },
      { status: 500 }
    );
  }
}
