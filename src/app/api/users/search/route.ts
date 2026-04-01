import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          // Match the search query
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          // Only search within same agency (if user belongs to one)
          ...(session.user.agencyId
            ? [{ agencyId: session.user.agencyId }]
            : []),
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
