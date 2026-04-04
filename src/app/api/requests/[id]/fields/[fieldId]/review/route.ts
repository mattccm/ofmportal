import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  feedback?: string;
}

/**
 * POST /api/requests/[id]/fields/[fieldId]/review
 * Team member approves or requests changes on a field
 * Body: { action: "approve" | "request_changes", feedback?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { id, fieldId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, feedback } = body;

    if (!action || !["approve", "request_changes"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'request_changes'" },
        { status: 400 }
      );
    }

    if (action === "request_changes" && !feedback?.trim()) {
      return NextResponse.json(
        { error: "Feedback is required when requesting changes" },
        { status: 400 }
      );
    }

    // Find the request
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Get current field submissions
    const fieldSubmissions = (request.fieldSubmissions as unknown as Record<string, FieldSubmission>) || {};
    const existingSubmission = fieldSubmissions[fieldId];

    if (!existingSubmission || existingSubmission.status === "PENDING") {
      return NextResponse.json(
        { error: "Field has not been submitted for review" },
        { status: 400 }
      );
    }

    if (existingSubmission.status === "APPROVED" && action === "approve") {
      return NextResponse.json(
        { error: "Field is already approved" },
        { status: 400 }
      );
    }

    // Update field status
    const now = new Date().toISOString();
    if (action === "approve") {
      fieldSubmissions[fieldId] = {
        ...existingSubmission,
        status: "APPROVED",
        reviewedAt: now,
        reviewedBy: session.user.id,
      };

      // Also approve all uploads in this field
      await db.upload.updateMany({
        where: {
          requestId: id,
          fieldId,
          uploadStatus: "COMPLETED",
        },
        data: {
          status: "APPROVED",
        },
      });
    } else {
      fieldSubmissions[fieldId] = {
        ...existingSubmission,
        status: "NEEDS_REVISION",
        reviewedAt: now,
        reviewedBy: session.user.id,
        feedback: feedback?.trim(),
      };

      // Mark uploads as needing revision (rejected)
      await db.upload.updateMany({
        where: {
          requestId: id,
          fieldId,
          uploadStatus: "COMPLETED",
        },
        data: {
          status: "REJECTED",
        },
      });
    }

    // Check if all file fields are approved to update request status
    const fields = request.fields as Array<{ id: string; type: string }> || [];
    const fileFields = fields.filter(f => f.type === "file");
    const allFieldsApproved = fileFields.every(f =>
      fieldSubmissions[f.id]?.status === "APPROVED"
    );
    const anyNeedsRevision = fileFields.some(f =>
      fieldSubmissions[f.id]?.status === "NEEDS_REVISION"
    );

    let newStatus = request.status;
    if (allFieldsApproved && fileFields.length > 0) {
      newStatus = "APPROVED";
    } else if (anyNeedsRevision) {
      newStatus = "NEEDS_REVISION";
    } else if (request.status === "SUBMITTED" || request.status === "UNDER_REVIEW") {
      newStatus = "UNDER_REVIEW";
    }

    // Update request
    await db.contentRequest.update({
      where: { id },
      data: {
        fieldSubmissions: fieldSubmissions as unknown as Prisma.InputJsonValue,
        status: newStatus,
        reviewedAt: action === "approve" ? new Date() : request.reviewedAt,
        reviewedBy: action === "approve" ? session.user.id : request.reviewedBy,
      },
    });

    return NextResponse.json({
      success: true,
      fieldSubmission: fieldSubmissions[fieldId],
      requestStatus: newStatus,
    });
  } catch (error) {
    console.error("Error reviewing field:", error);
    return NextResponse.json(
      { error: "Failed to review field" },
      { status: 500 }
    );
  }
}
