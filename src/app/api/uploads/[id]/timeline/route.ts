import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, redactCreatorsIn } from "@/lib/access/server";
import { db } from "@/lib/db";
import { getUploadTimeline } from "@/lib/upload-review";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("review.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const { id } = await params;

    // Verify upload belongs to agency
    const upload = await db.upload.findFirst({
      where: {
        id,
        request: requestWhere(access),
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const timeline = await getUploadTimeline(id);

    return NextResponse.json({ timeline: redactCreatorsIn(access, timeline) });
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
