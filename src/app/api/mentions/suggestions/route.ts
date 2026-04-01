import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MentionSuggestion } from "@/types/mentions";

// ============================================
// GET /api/mentions/suggestions - Get mention suggestions
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    // Get the current user's agency to filter team members
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { agencyId: true },
    });

    if (!currentUser?.agencyId) {
      return NextResponse.json({ suggestions: [] });
    }

    // Build where clause for filtering users
    const where: Record<string, unknown> = {
      agencyId: currentUser.agencyId,
      // Exclude the current user from suggestions
      NOT: { id: session.user.id },
    };

    // Add search filter if query provided
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    // Fetch team members
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
      take: limit,
      orderBy: [
        // Prioritize name matches that start with query
        { name: "asc" },
      ],
    });

    // Get recently mentioned users for this user (for sorting)
    const recentMentions = await db.mention.findMany({
      where: {
        mentionedById: session.user.id,
      },
      select: {
        mentionedUserId: true,
      },
      distinct: ["mentionedUserId"],
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const recentMentionIds = new Set(recentMentions.map((m: { mentionedUserId: string }) => m.mentionedUserId));

    // Transform to suggestion format and sort
    const suggestions: MentionSuggestion[] = users
      .map((user: { id: string; name: string; email: string; image: string | null; role: string }) => ({
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        avatar: user.image,
        role: user.role || undefined,
        isOnline: false, // Could be determined by presence system
      }))
      .sort((a: MentionSuggestion, b: MentionSuggestion) => {
        // Sort recent mentions first
        const aIsRecent = recentMentionIds.has(a.id);
        const bIsRecent = recentMentionIds.has(b.id);

        if (aIsRecent && !bIsRecent) return -1;
        if (!aIsRecent && bIsRecent) return 1;

        // Then alphabetically by name
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Failed to fetch mention suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
