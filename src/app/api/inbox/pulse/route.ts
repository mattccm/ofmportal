import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requestWhere, requireAccess } from "@/lib/access/server";
import { INBOX_KEYS, visibleConversationWhere } from "@/lib/conversation-access";
import { isCreatorPseudoEmail, staffFirstName } from "@/lib/portal-auth";

/**
 * GET /api/inbox/pulse?since=<the "now" from the last answer>
 * -> { now, messages: [...], comments: [...] }
 *
 * What arrived since the last check, for whoever is signed in: messages in
 * conversations they're in and allowed to see (not their own), and creator
 * comments on requests in their scope. Every staff screen asks every few
 * seconds while it's open (components/inbox/inbox-pulse.tsx), so the Messages
 * badge, a pop-up and an open conversation update without a refresh.
 * Two small indexed queries; the first call (no since) only returns `now`.
 */

const MAX_LOOKBACK_MS = 10 * 60 * 1000;
const preview = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
};

export async function GET(req: NextRequest) {
  const gate = await requireAccess([...INBOX_KEYS, "requests.view"]);
  if (gate.error) return gate.error;
  const { access, session } = gate;
  const userId = session.user.id;
  const now = new Date();

  const raw = req.nextUrl.searchParams.get("since");
  const asked = raw ? new Date(raw) : null;
  if (!asked || Number.isNaN(asked.getTime())) {
    return NextResponse.json({ now: now.toISOString(), messages: [], comments: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const since = new Date(Math.max(asked.getTime(), now.getTime() - MAX_LOOKBACK_MS));

  const [messages, comments] = await Promise.all([
    access.hasAny([...INBOX_KEYS])
      ? db.message.findMany({
          where: {
            createdAt: { gt: since, lte: now },
            // Not the ones I sent (a creator's message has no staff sender)
            OR: [{ senderId: null }, { senderId: { not: userId } }],
            conversation: {
              participants: { some: { userId } },
              OR: [{ agencyId: access.agencyId }, { agencyId: null }],
              AND: [visibleConversationWhere(access)],
            },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: {
            id: true,
            conversationId: true,
            content: true,
            createdAt: true,
            creator: { select: { name: true } },
            sender: { select: { name: true, email: true } },
            conversation: { select: { type: true, name: true } },
          },
        })
      : [],
    access.has("requests.view")
      ? db.comment.findMany({
          where: {
            createdAt: { gt: since, lte: now },
            isInternal: false,
            request: requestWhere(access),
            // Creator comments are written by per-creator pseudo-users
            user: { email: { endsWith: `@${access.agencyId}.internal` } },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { id: true, requestId: true, createdAt: true, request: { select: { creator: { select: { name: true } } } } },
        })
      : [],
  ]);

  return NextResponse.json(
    {
      now: now.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        from: m.creator?.name ?? (m.sender && !isCreatorPseudoEmail(m.sender.email) ? staffFirstName(m.sender.name) : "A creator"),
        group: m.conversation.type === "GROUP" ? m.conversation.name : null,
        preview: preview(m.content),
        createdAt: m.createdAt.toISOString(),
      })),
      comments: comments.map((c) => ({
        id: c.id,
        requestId: c.requestId,
        from: c.request?.creator?.name ?? "A creator",
        createdAt: c.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
