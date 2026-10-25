import { NextRequest, NextResponse } from "next/server";
import { requireAccess, forbidden, requestWhere } from "@/lib/access/server";
import { db } from "@/lib/db";
import { createConversation, getConversations, getOrCreateDirectConversation } from "@/lib/chat";
import { ConversationType } from "@prisma/client";
import { INBOX_KEYS, staffIdsInAgency, visibleConversationWhere } from "@/lib/conversation-access";

/**
 * GET /api/conversations
 * List all conversations for the current user
 */
export async function GET(_request: NextRequest) {
  try {
    const gate = await requireAccess([...INBOX_KEYS]);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const all = await getConversations(session.user.id);
    // Only threads this role may see (creator scope, team chats key)
    const visible = new Set(
      (
        await db.conversation.findMany({
          where: { AND: [{ id: { in: all.map((c) => c.id) } }, visibleConversationWhere(access)] },
          select: { id: true },
        })
      ).map((c) => c.id)
    );
    const conversations = all.filter((c) => visible.has(c.id));

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 *
 * Body:
 * - type: ConversationType ("DIRECT" | "GROUP" | "REQUEST_THREAD")
 * - participantIds: string[] (user IDs to include)
 * - name?: string (optional, for group conversations)
 * - requestId?: string (optional, for request thread conversations)
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireAccess("messages.team");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body = await request.json();
    const { type, participantIds, name, requestId } = body;
    if (type === "GROUP" && !access.has("messages.groups")) return forbidden("messages.groups");
    // A request thread only for a request whose creator this person can see
    if (requestId) {
      const seen = await db.contentRequest.count({
        where: { AND: [requestWhere(access), { id: String(requestId) }] },
      });
      if (!seen) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Validate input
    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json(
        { error: "Missing required fields: type and participantIds" },
        { status: 400 }
      );
    }

    // Validate conversation type
    if (!["DIRECT", "GROUP", "REQUEST_THREAD"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid conversation type" },
        { status: 400 }
      );
    }

    // Everyone in a team thread must be real staff of the caller's agency
    // (no creator pseudo-users, no other agency's users), inside the caller's team scope
    const requestedIds = Array.from(
      new Set(participantIds.filter((id: unknown): id is string => typeof id === "string" && !!id))
    );
    const validIds = await staffIdsInAgency(requestedIds, access.agencyId, access);
    if (validIds.length !== requestedIds.length || requestedIds.length !== participantIds.length) {
      return NextResponse.json(
        { error: "Only people on your team can be added" },
        { status: 400 }
      );
    }

    // For direct conversations, ensure exactly 2 participants
    if (type === "DIRECT") {
      if (participantIds.length !== 2) {
        return NextResponse.json(
          { error: "Direct conversations must have exactly 2 participants" },
          { status: 400 }
        );
      }

      // Check if current user is one of the participants
      if (!participantIds.includes(session.user.id)) {
        return NextResponse.json(
          { error: "You must be a participant in the conversation" },
          { status: 400 }
        );
      }

      // Get or create the direct conversation
      const otherUserId = participantIds.find((id: string) => id !== session.user.id)!;
      const conversation = await getOrCreateDirectConversation(
        session.user.id,
        otherUserId
      );

      return NextResponse.json({ conversation }, { status: 201 });
    }

    // For group conversations, ensure at least 2 participants
    if (type === "GROUP" && participantIds.length < 2) {
      return NextResponse.json(
        { error: "Group conversations must have at least 2 participants" },
        { status: 400 }
      );
    }

    // Ensure current user is included in participants
    const allParticipantIds = participantIds.includes(session.user.id)
      ? participantIds
      : [...participantIds, session.user.id];

    // Create the conversation
    const conversation = await createConversation(
      type as ConversationType,
      allParticipantIds,
      name,
      requestId
    );

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);

    if (error instanceof Error) {
      if (error.message === "One or more participants not found") {
        return NextResponse.json(
          { error: "One or more participants not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
