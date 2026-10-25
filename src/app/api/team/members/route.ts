import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, staffWhere } from "@/lib/access/server";

/**
 * GET - List all team members for the current agency
 * Simplified endpoint for watchers and quick team member lookups.
 * Any staff member; only teammates inside their team scope are listed.
 */
export async function GET() {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;

    const members = await db.user.findMany({
      where: staffWhere(gate.access),
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
      orderBy: [
        { role: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
