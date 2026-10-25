import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, staffWhere } from "@/lib/access/server";
import type { MentionSuggestion } from "@/types/mentions";

// GET /api/mentions/suggestions - Get mention suggestions

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    // Team members this person may see (staffWhere also drops creator
    // pseudo-users), minus themselves
    const where: Record<string, unknown> = {
      ...staffWhere(access),
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
        avatar: true,
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
      .map((user: { id: string; name: string; email: string; avatar: string | null; role: string }) => ({
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        avatar: user.avatar,
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
