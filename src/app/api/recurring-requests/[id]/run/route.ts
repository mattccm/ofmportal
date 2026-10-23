import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeRecurringRequest } from "@/app/api/recurring-requests/execute";

// POST - Execute recurring request manually

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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
