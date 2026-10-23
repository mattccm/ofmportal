import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession, CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";

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
        // Drafts are staff-only until sent
        status: { notIn: CREATOR_HIDDEN_STATUSES },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        // Only completed uploads fill slots (matches the detail and submit routes)
        _count: {
          select: { uploads: { where: { uploadStatus: "COMPLETED" } } },
        },
        uploads: {
          where: { uploadStatus: "COMPLETED" },
          select: { fieldId: true, status: true },
        },
        comments: {
          where: { isInternal: false },
          select: {
            createdAt: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    // Completion counts mirror the staff request sidebar: upload slots are the
    // required file fields (or all file fields when none are flagged required);
    // ad-hoc requests with no file fields fall back to raw upload counts.
    const withCompletion = requests.map(({ uploads, comments, ...request }) => {
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

      // Unread staff feedback: non-internal comments from real staff (not the
      // .internal creator pseudo-users) posted since the creator last viewed.
      const lastViewed = request.lastViewedAt
        ? new Date(request.lastViewedAt).getTime()
        : 0;
      const unreadFeedbackCount = comments.filter(
        (c) =>
          !(c.user?.email ?? "").endsWith(".internal") &&
          c.createdAt.getTime() > lastViewed
      ).length;

      // Time estimate: the agency's set value, else a rough derivation from the
      // number of deliverables so the creator always sees a ballpark.
      const estimatedMinutes =
        request.estimatedMinutes ??
        (fileFields.length > 0 ? fileFields.length * 15 : 15);

      return {
        ...request,
        completion: { totalSlots, uploadedSlots, approvedSlots },
        unreadFeedbackCount,
        estimatedMinutes,
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
