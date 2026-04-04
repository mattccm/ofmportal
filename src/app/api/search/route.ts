import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Types
interface SearchResult {
  id: string;
  type: "creator" | "request" | "upload" | "template" | "message";
  title: string;
  subtitle?: string;
  highlight?: string;
  href: string;
  metadata?: Record<string, string>;
}

// Fuzzy match helper - simple implementation
function fuzzyMatch(text: string, pattern: string): { matches: boolean; score: number } {
  if (!text || !pattern) return { matches: false, score: 0 };

  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match
  if (textLower === patternLower) {
    return { matches: true, score: 100 };
  }

  // Contains match
  if (textLower.includes(patternLower)) {
    const position = textLower.indexOf(patternLower);
    // Higher score for matches at the start
    const positionBonus = position === 0 ? 20 : 0;
    return { matches: true, score: 80 + positionBonus };
  }

  // Word starts with pattern
  const words = textLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(patternLower)) {
      return { matches: true, score: 70 };
    }
  }

  // Fuzzy character match (all characters in pattern appear in order in text)
  let patternIndex = 0;
  let matchedChars = 0;
  let consecutiveBonus = 0;
  let lastMatchIndex = -2;

  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      matchedChars++;
      if (i === lastMatchIndex + 1) {
        consecutiveBonus += 5;
      }
      lastMatchIndex = i;
      patternIndex++;
    }
  }

  if (patternIndex === patternLower.length) {
    const baseScore = (matchedChars / text.length) * 50;
    return { matches: true, score: baseScore + consecutiveBonus };
  }

  return { matches: false, score: 0 };
}

// Highlight matched terms in text
function highlightMatch(text: string, query: string): string {
  if (!text || !query) return text;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Find the position of the match
  const index = textLower.indexOf(queryLower);
  if (index === -1) {
    // Try highlighting individual words
    const words = query.split(/\s+/);
    let result = text;
    for (const word of words) {
      if (word.length < 2) continue;
      const wordIndex = result.toLowerCase().indexOf(word.toLowerCase());
      if (wordIndex !== -1) {
        const matchedText = result.substring(wordIndex, wordIndex + word.length);
        result =
          result.substring(0, wordIndex) +
          `<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">${matchedText}</mark>` +
          result.substring(wordIndex + word.length);
      }
    }
    return result;
  }

  const matchedText = text.substring(index, index + query.length);
  return (
    text.substring(0, index) +
    `<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">${matchedText}</mark>` +
    text.substring(index + query.length)
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const type = searchParams.get("type") as
      | "creators"
      | "requests"
      | "uploads"
      | "templates"
      | "messages"
      | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!query) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const agencyId = session.user.agencyId;
    const results: SearchResult[] = [];

    // Search Creators
    if (!type || type === "creators") {
      const creators = await db.creator.findMany({
        where: {
          agencyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          inviteStatus: true,
          _count: {
            select: { requests: true },
          },
        },
      });

      for (const creator of creators) {
        const matchResult = fuzzyMatch(creator.name + " " + creator.email, query);
        if (matchResult.matches) {
          results.push({
            id: creator.id,
            type: "creator",
            title: creator.name,
            subtitle: creator.email,
            highlight: highlightMatch(creator.name, query),
            href: `/dashboard/creators/${creator.id}`,
            metadata: {
              status: creator.inviteStatus,
              requests: creator._count.requests.toString(),
            },
          });
        }
      }
    }

    // Search Requests
    if (!type || type === "requests") {
      const requests = await db.contentRequest.findMany({
        where: {
          agencyId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          creator: {
            select: { name: true },
          },
        },
      });

      for (const request of requests) {
        const matchResult = fuzzyMatch(
          request.title + " " + (request.description || ""),
          query
        );
        if (matchResult.matches) {
          results.push({
            id: request.id,
            type: "request",
            title: request.title,
            subtitle: `Creator: ${request.creator.name} - Status: ${request.status}`,
            highlight: highlightMatch(request.title, query),
            href: `/dashboard/requests/${request.id}`,
            metadata: {
              status: request.status,
              creator: request.creator.name,
            },
          });
        }
      }
    }

    // Search Uploads
    if (!type || type === "uploads") {
      const uploads = await db.upload.findMany({
        where: {
          request: { agencyId },
          OR: [
            { originalName: { contains: query, mode: "insensitive" } },
            { fileName: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalName: true,
          fileType: true,
          status: true,
          request: {
            select: { id: true, title: true },
          },
          creator: {
            select: { name: true },
          },
        },
      });

      for (const upload of uploads) {
        const matchResult = fuzzyMatch(upload.originalName, query);
        if (matchResult.matches) {
          results.push({
            id: upload.id,
            type: "upload",
            title: upload.originalName,
            subtitle: `Request: ${upload.request.title} - ${upload.creator.name}`,
            highlight: highlightMatch(upload.originalName, query),
            href: `/dashboard/requests/${upload.request.id}?upload=${upload.id}`,
            metadata: {
              status: upload.status,
              fileType: upload.fileType,
            },
          });
        }
      }
    }

    // Search Templates
    if (!type || type === "templates") {
      const templates = await db.requestTemplate.findMany({
        where: {
          agencyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          _count: {
            select: { requests: true },
          },
        },
      });

      for (const template of templates) {
        const matchResult = fuzzyMatch(
          template.name + " " + (template.description || ""),
          query
        );
        if (matchResult.matches) {
          results.push({
            id: template.id,
            type: "template",
            title: template.name,
            subtitle: template.description || "No description",
            highlight: highlightMatch(template.name, query),
            href: `/dashboard/templates/${template.id}`,
            metadata: {
              active: template.isActive ? "Active" : "Inactive",
              usedCount: template._count.requests.toString(),
            },
          });
        }
      }
    }

    // Search Messages (conversations)
    if (!type || type === "messages") {
      const messages = await db.message.findMany({
        where: {
          conversation: {
            participants: {
              some: {
                userId: session.user.id,
              },
            },
          },
          content: { contains: query, mode: "insensitive" },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          conversationId: true,
          sender: {
            select: { name: true },
          },
          conversation: {
            select: {
              name: true,
              request: {
                select: { title: true },
              },
            },
          },
        },
      });

      for (const message of messages) {
        const matchResult = fuzzyMatch(message.content, query);
        if (matchResult.matches) {
          const conversationTitle =
            message.conversation.name ||
            message.conversation.request?.title ||
            "Direct Message";

          // Truncate content for preview
          let preview = message.content;
          if (preview.length > 80) {
            preview = preview.substring(0, 80) + "...";
          }

          results.push({
            id: message.id,
            type: "message",
            title: preview,
            subtitle: `${message.sender?.name || "Unknown"} in ${conversationTitle}`,
            highlight: highlightMatch(preview, query),
            href: `/dashboard/messages?conversation=${message.conversationId}`,
            metadata: {
              from: message.sender?.name || "Unknown",
              conversation: conversationTitle,
            },
          });
        }
      }
    }

    // Sort all results by relevance (fuzzy match score)
    results.sort((a, b) => {
      const scoreA = fuzzyMatch(a.title + " " + (a.subtitle || ""), query).score;
      const scoreB = fuzzyMatch(b.title + " " + (b.subtitle || ""), query).score;
      return scoreB - scoreA;
    });

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return NextResponse.json({
      results: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [], total: 0 },
      { status: 500 }
    );
  }
}
