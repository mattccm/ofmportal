import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { targetsInScope } from "../../scope";
import { executeRecurringRequest } from "@/app/api/recurring-requests/execute";

// POST - Execute recurring request manually

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("recurring.edit");
    if (gate.error) return gate.error;
    const { session, access } = gate;

    const { id } = await params;

    // Out-of-scope schedules answer as missing
    const row = await db.recurringRequest.findFirst({
      where: { id, agencyId: session.user.agencyId },
      select: { creatorIds: true, creatorGroupIds: true },
    });
    if (!row || !(await targetsInScope(access, row))) {
      return NextResponse.json({ error: "Recurring request not found" }, { status: 404 });
    }

    const result = await executeRecurringRequest(id, session.user.agencyId, {
      actorUserId: session.user.id,
      agencyName: session.user.agencyName,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Error executing recurring request:", error);
    return NextResponse.json(
      { error: "Failed to execute recurring request" },
      { status: 500 }
    );
  }
}
