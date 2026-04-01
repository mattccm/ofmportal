import { NextRequest, NextResponse } from "next/server";
import { invalidateCreatorSession, validateCreatorSession } from "@/lib/portal-auth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);

    if (authResult.success) {
      // Invalidate the session in the database
      await invalidateCreatorSession(authResult.creator.id);
    }

    // Return success even if session was already invalid
    // (user might be logging out with an expired session)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging out:", error);
    return NextResponse.json(
      { error: "Failed to log out" },
      { status: 500 }
    );
  }
}
