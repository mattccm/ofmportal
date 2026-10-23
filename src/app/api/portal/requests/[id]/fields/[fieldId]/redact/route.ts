import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession, CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";
import type { Prisma } from "@prisma/client";

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  feedback?: string;
}

/**
 * POST /api/portal/requests/[id]/fields/[fieldId]/redact
 * Creator redacts/withdraws a field submission (only if not yet approved)
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
        status: { notIn: CREATOR_HIDDEN_STATUSES },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Get current field submissions
    const fieldSubmissions = (request.fieldSubmissions as unknown as Record<string, FieldSubmission>) || {};
    const existingSubmission = fieldSubmissions[fieldId];

    if (!existingSubmission) {
      return NextResponse.json(
        { error: "Field has not been submitted" },
        { status: 400 }
      );
    }

    // Can only redact a SUBMITTED field awaiting review (redacting NEEDS_REVISION would erase staff feedback)
    if (existingSubmission.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Only submitted fields awaiting review can be redacted" },
        { status: 400 }
      );
    }

    // Reset to PENDING
    fieldSubmissions[fieldId] = {
      status: "PENDING",
    };

    // Update request
    await db.contentRequest.update({
      where: { id },
      data: {
        fieldSubmissions: fieldSubmissions as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      fieldSubmission: fieldSubmissions[fieldId],
    });
  } catch (error) {
    console.error("Error redacting field:", error);
    return NextResponse.json(
      { error: "Failed to redact field" },
      { status: 500 }
    );
  }
}
