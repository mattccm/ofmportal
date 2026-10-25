import { NextRequest, NextResponse } from "next/server";
import { getMessages, sendMessage, markMessagesAsRead, type Attachment } from "@/lib/chat";
import { requireAccess, forbidden } from "@/lib/access/server";
import { findStaffConversation, INBOX_KEYS } from "@/lib/conversation-access";

const notFound = () => NextResponse.json({ error: "Conversation not found" }, { status: 404 });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]/messages
 * Fetch messages for a conversation with pagination
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - cursor: string (message ID for pagination)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const gate = await requireAccess([...INBOX_KEYS]);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const cursor = searchParams.get("cursor") || undefined;

    // A participant, in this agency, and a thread this role may see
    if (!(await findStaffConversation(conversationId, session.user.id, access.agencyId, access))) {
      return notFound();
    }

    const result = await getMessages(conversationId, limit, cursor);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Send a new message in a conversation
 *
 * Body:
 * - content: string (message text)
 * - attachments?: Attachment[] (optional file attachments)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const gate = await requireAccess([...INBOX_KEYS]);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id: conversationId } = await params;
    const convo = await findStaffConversation(conversationId, session.user.id, access.agencyId, access);
    if (!convo) return notFound();
    // Writing to a creator needs "Message creators"
    if (convo.type === "CREATOR" && !access.has("messages.reply")) return forbidden("messages.reply");

    const body = await request.json();
    const { content, attachments } = body;

    // Validate input
    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: "Message must have content or attachments" },
        { status: 400 }
      );
    }

    // Validate attachments if provided
    if (attachments && !Array.isArray(attachments)) {
      return NextResponse.json(
        { error: "Attachments must be an array" },
        { status: 400 }
      );
    }

    // Validate attachment structure
    const validatedAttachments: Attachment[] = [];
    if (attachments) {
      for (const attachment of attachments) {
        if (
          !attachment.id ||
          !attachment.name ||
          !attachment.url ||
          !attachment.type ||
          typeof attachment.size !== "number"
        ) {
          return NextResponse.json(
            { error: "Invalid attachment structure" },
            { status: 400 }
          );
        }
        validatedAttachments.push({
          id: attachment.id,
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
          size: attachment.size,
        });
      }
    }

    const message = await sendMessage(
      conversationId,
      session.user.id,
      content || "",
      validatedAttachments.length > 0 ? validatedAttachments : undefined
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);

    if (error instanceof Error) {
      if (error.message === "User is not a participant of this conversation") {
        return NextResponse.json(
          { error: "You are not a participant of this conversation" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]/messages
 * Mark all messages in the conversation as read
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const gate = await requireAccess([...INBOX_KEYS]);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { id: conversationId } = await params;

    if (!(await findStaffConversation(conversationId, session.user.id, access.agencyId, access))) {
      return notFound();
    }

    const result = await markMessagesAsRead(conversationId, session.user.id);

    return NextResponse.json({ success: true, markedCount: result.count });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
