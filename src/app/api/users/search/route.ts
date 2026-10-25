import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, staffWhere } from "@/lib/access/server";

/**
 * GET /api/users/search
 * Search for users by name or email
 *
 * Query params:
 * - q: search query (required)
 * - limit: number of results (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    // A staff picker (team chats, mentions): any signed-in staff member,
    // limited to the teammates inside their team scope
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    // Search users by name or email (case-insensitive)
    const users = await db.user.findMany({
      where: {
        AND: [
          // Exclude current user
          { id: { not: session.user.id } },
          // Same agency, no creator-comment pseudo-users, inside the team scope
          staffWhere(access),
          // Match the search query
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        lastActiveAt: true,
      },
      take: limit,
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
