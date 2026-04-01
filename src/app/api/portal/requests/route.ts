import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";

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
        status: { not: "CANCELLED" },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { uploads: true },
        },
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching creator requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
