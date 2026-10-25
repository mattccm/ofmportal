import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { validateCreatorSession, CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";
import { fieldKey, isCreatorTextField, type CreatorFieldDef } from "@/lib/creator-field-states";

const EDITABLE_STATUSES = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];
const MAX_LENGTH = 5000;

/**
 * PUT /api/portal/requests/[id]/fields/[fieldId]/value
 * The creator saves a written answer (captions, notes) for a text field CCM
 * left empty. Text fields CCM filled in are instructions and can't be changed.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { id, fieldId } = await params;
    const auth = await validateCreatorSession(req);
    if (!auth.success) return auth.error;
    const creator = auth.creator;

    const body = await parseJsonBody<{ value?: unknown }>(req);
    if (!body.ok) return body.response;
    const raw = body.data.value;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Write your answer as text" }, { status: 400 });
    }
    const value = raw.slice(0, MAX_LENGTH);

    const request = await db.contentRequest.findFirst({
      where: { id, creatorId: creator.id, status: { notIn: CREATOR_HIDDEN_STATUSES } },
      select: { id: true, status: true, fields: true },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (!EDITABLE_STATUSES.includes(request.status)) {
      return NextResponse.json(
        { error: "This request is in review, so answers can't be changed now" },
        { status: 409 }
      );
    }

    const fields = (request.fields as unknown as CreatorFieldDef[]) || [];
    const index = fields.findIndex((f) => fieldKey(f) === fieldId);
    if (index === -1) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }
    if (!isCreatorTextField(fields[index])) {
      return NextResponse.json({ error: "This field can't be answered here" }, { status: 400 });
    }

    const next = fields.map((f, i) => (i === index ? { ...f, value, filledByCreator: true } : f));
    await db.contentRequest.update({
      where: { id },
      data: {
        fields: next as unknown as Prisma.InputJsonValue,
        status: request.status === "PENDING" ? "IN_PROGRESS" : request.status,
      },
    });

    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error("Error saving field answer:", error);
    return NextResponse.json({ error: "Failed to save your answer" }, { status: 500 });
  }
}
