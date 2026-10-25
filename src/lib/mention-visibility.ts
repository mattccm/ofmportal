import type { MentionContextType } from "@prisma/client";
import { db } from "@/lib/db";
import { requestWhere, uploadWhere, type Access } from "@/lib/access/server";
import { INBOX_KEYS, visibleConversationWhere } from "@/lib/conversation-access";

type MentionRef = { id: string; contextType: MentionContextType; contextId: string };

/**
 * Which of these mentions point at something the person's role can still
 * see: a request (or a comment on one) whose creator is inside their scope,
 * or a message in a conversation they may see. A mention of something out of
 * scope is listed without its text or title. Three queries at most.
 */
export async function visibleMentionIds(access: Access, mentions: MentionRef[]): Promise<Set<string>> {
  const ids = (t: MentionContextType) => [...new Set(mentions.filter((m) => m.contextType === t).map((m) => m.contextId))];
  const requestIds = ids("REQUEST");
  const commentIds = ids("COMMENT");
  const messageIds = ids("MESSAGE");
  const canRequests = access.has("requests.view");
  const canInbox = access.hasAny([...INBOX_KEYS]);

  const [requests, comments, messages] = await Promise.all([
    canRequests && requestIds.length
      ? db.contentRequest.findMany({ where: { AND: [requestWhere(access), { id: { in: requestIds } }] }, select: { id: true } })
      : [],
    canRequests && commentIds.length
      ? db.comment.findMany({
          where: {
            id: { in: commentIds },
            OR: [{ request: requestWhere(access) }, { upload: uploadWhere(access) }],
          },
          select: { id: true },
        })
      : [],
    canInbox && messageIds.length
      ? db.message.findMany({
          where: { id: { in: messageIds }, conversation: { agencyId: access.agencyId, AND: [visibleConversationWhere(access)] } },
          select: { id: true },
        })
      : [],
  ]);
  const ok = new Set<string>([...requests, ...comments, ...messages].map((r) => r.id));
  return new Set(
    mentions
      .filter((m) => (m.contextType === "REQUEST" || m.contextType === "COMMENT" || m.contextType === "MESSAGE" ? ok.has(m.contextId) : true))
      .map((m) => m.id)
  );
}
