import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOversightStats,
  getRecentActivity,
  getStaffMetrics,
  getCreatorCommunications,
  getMessageOversight,
  getConversationThread,
  getKeywordAlerts,
  getOversightKeywords,
  saveOversightKeywords,
  type OversightKeyword,
} from "@/lib/oversight";

// Oversight is a management feature - restricted to elevated roles.
const OVERSIGHT_ROLES = ["OWNER", "ADMIN", "MANAGER"];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!OVERSIGHT_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden: oversight access required" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "summary";

    switch (type) {
      case "summary": {
        // Compose everything the overview dashboard needs in one call.
        const keywords = await getOversightKeywords(agencyId);
        const [stats, activity, keywordAlerts, conversations, staff] =
          await Promise.all([
            getOversightStats(agencyId, keywords),
            getRecentActivity(agencyId),
            getKeywordAlerts(agencyId, keywords),
            getMessageOversight(agencyId, keywords),
            getStaffMetrics(agencyId),
          ]);
        return NextResponse.json({
          stats,
          activity,
          keywordAlerts,
          flaggedConversations: conversations.filter((c) => c.flagged),
          staff: staff.slice(0, 8),
        });
      }

      case "activity": {
        const activity = await getRecentActivity(agencyId);
        return NextResponse.json({ activity });
      }

      case "staff": {
        const staff = await getStaffMetrics(agencyId);
        return NextResponse.json({ staff });
      }

      case "creators": {
        const creators = await getCreatorCommunications(agencyId);
        return NextResponse.json({ creators });
      }

      case "messages": {
        const keywords = await getOversightKeywords(agencyId);
        const conversations = await getMessageOversight(agencyId, keywords);
        return NextResponse.json({ conversations });
      }

      case "thread": {
        const conversationId = searchParams.get("conversationId");
        if (!conversationId) {
          return NextResponse.json(
            { error: "Missing conversationId" },
            { status: 400 }
          );
        }
        const thread = await getConversationThread(agencyId, conversationId);
        if (!thread) {
          return NextResponse.json(
            { error: "Conversation not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ thread });
      }

      case "keywords": {
        const keywords = await getOversightKeywords(agencyId);
        const alerts = await getKeywordAlerts(agencyId, keywords);
        return NextResponse.json({ keywords, alerts });
      }

      default:
        return NextResponse.json(
          { error: "Invalid oversight type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Oversight API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch oversight data" },
      { status: 500 }
    );
  }
}

// Update the monitored-keyword configuration (Agency.settings.oversight.keywords).
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Only OWNER/ADMIN can change monitoring configuration.
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const keywords = body?.keywords;
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Missing keywords array" },
        { status: 400 }
      );
    }

    const saved = await saveOversightKeywords(
      session.user.agencyId,
      keywords as OversightKeyword[]
    );
    return NextResponse.json({ keywords: saved });
  } catch (error) {
    console.error("Oversight keyword update error:", error);
    return NextResponse.json(
      { error: "Failed to update keywords" },
      { status: 500 }
    );
  }
}
