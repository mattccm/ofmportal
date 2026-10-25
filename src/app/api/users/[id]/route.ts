import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, staffWhere } from "@/lib/access/server";

/**
 * GET /api/users/[id]
 * Fetch a single user's public details (name, email, avatar, role),
 * scoped to the caller's agency.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access } = gate;

    const { id } = await params;

    const user = await db.user.findFirst({
      // Only teammates in the caller's agency and team scope
      where: { AND: [staffWhere(access), { id }] },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
