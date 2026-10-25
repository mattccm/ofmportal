import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access/server";
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
  oversightScope,
  type OversightKeyword,
} from "@/lib/oversight";

// Oversight is a management feature: the "Oversight" permission, limited to
// the creators and teammates inside the viewer's role scopes.

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAccess("settings.oversight");
    if (gate.error) return gate.error;
    const { access } = gate;

    const agencyId = access.agencyId;
    const scope = oversightScope(access);
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "summary";

    switch (type) {
      case "summary": {
        // Compose everything the overview dashboard needs in one call.
        const keywords = await getOversightKeywords(agencyId);
        const [stats, activity, keywordAlerts, conversations, staff] =
          await Promise.all([
            getOversightStats(scope, keywords),
            getRecentActivity(scope),
            getKeywordAlerts(scope, keywords),
            getMessageOversight(scope, keywords),
            getStaffMetrics(scope),
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
        const activity = await getRecentActivity(scope);
        return NextResponse.json({ activity });
      }

      case "staff": {
        const staff = await getStaffMetrics(scope);
        return NextResponse.json({ staff });
      }

      case "creators": {
        const creators = await getCreatorCommunications(scope);
        return NextResponse.json({ creators });
      }

      case "messages": {
        const keywords = await getOversightKeywords(agencyId);
        const conversations = await getMessageOversight(scope, keywords);
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
        const thread = await getConversationThread(scope, conversationId);
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
        const alerts = await getKeywordAlerts(scope, keywords);
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
    // Changing what is monitored has its own key (admins by default)
    const gate = await requireAccess("settings.oversightKeywords");
    if (gate.error) return gate.error;
    const { access } = gate;

    const body = await request.json();
    const keywords = body?.keywords;
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Missing keywords array" },
        { status: 400 }
      );
    }

    const saved = await saveOversightKeywords(
      access.agencyId,
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
