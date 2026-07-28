import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";

interface RequestField {
  id: string;
  type: string;
  required?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }
    const creator = authResult.creator;

    // Get requests for this creator
    const requests = await db.contentRequest.findMany({
      where: {
        creatorId: creator.id,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { uploads: true },
        },
        uploads: {
          select: { fieldId: true, status: true },
        },
      },
    });

    // Completion counts mirror the staff request sidebar: upload slots are the
    // required file fields (or all file fields when none are flagged required);
    // ad-hoc requests with no file fields fall back to raw upload counts.
    const withCompletion = requests.map(({ uploads, ...request }) => {
      const fields = (request.fields as unknown as RequestField[]) || [];
      const fileFields = fields.filter((f) => f.type === "file");
      const requiredFileFields = fileFields.filter((f) => f.required);
      const slotFields =
        requiredFileFields.length > 0 ? requiredFileFields : fileFields;

      let totalSlots: number;
      let uploadedSlots: number;
      let approvedSlots: number;
      if (slotFields.length > 0) {
        totalSlots = slotFields.length;
        uploadedSlots = slotFields.filter((f) =>
          uploads.some((u) => u.fieldId === f.id)
        ).length;
        approvedSlots = slotFields.filter((f) =>
          uploads.some((u) => u.fieldId === f.id && u.status === "APPROVED")
        ).length;
      } else {
        totalSlots = uploads.length;
        uploadedSlots = uploads.length;
        approvedSlots = uploads.filter((u) => u.status === "APPROVED").length;
      }

      return {
        ...request,
        completion: { totalSlots, uploadedSlots, approvedSlots },
      };
    });

    return NextResponse.json(withCompletion);
  } catch (error) {
    console.error("Error fetching creator requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
