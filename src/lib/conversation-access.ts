import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import { creatorScopeWhere, staffWhere, type Access } from "@/lib/access/server";

/** Conversation types between staff only */
export const TEAM_CONVERSATION_TYPES = ["DIRECT", "GROUP", "REQUEST_THREAD"] as const;

/** Either messages key opens the inbox */
export const INBOX_KEYS = ["messages.creators", "messages.team"] as const;

/**
 * Conversations this person's role lets them see (on top of being a
 * participant): creator threads need `messages.creators` and a creator inside
 * their creator scope; team threads need `messages.team` (a request thread
 * also needs its request's creator in scope).
 */
export function visibleConversationWhere(
  access: Pick<Access, "has" | "creatorScope">
): Prisma.ConversationWhereInput {
  const scope = creatorScopeWhere(access);
  const scoped = Object.keys(scope).length > 0;
  const ors: Prisma.ConversationWhereInput[] = [];
  if (access.has("messages.creators")) {
    ors.push(scoped ? { type: "CREATOR", creator: scope } : { type: "CREATOR" });
  }
  if (access.has("messages.team")) {
    ors.push(
      scoped
        ? {
            type: { in: [...TEAM_CONVERSATION_TYPES] },
            OR: [{ requestId: null }, { request: { creator: scope } }],
          }
        : { type: { in: [...TEAM_CONVERSATION_TYPES] } }
    );
  }
  // Neither key: nothing is visible
  return ors.length ? { OR: ors } : { id: { in: [] } };
}

/**
 * Staff access to an inbox conversation: the conversation must belong to the
 * caller's agency (or be a legacy row with no agency) AND the caller must be a
 * participant AND (with `access`) their role must let them see it. Anything
 * else reads as "not found", so a removed group member cannot even confirm the
 * thread still exists.
 */
export async function findStaffConversation(
  conversationId: string,
  userId: string,
  agencyId: string,
  access?: Pick<Access, "has" | "creatorScope">
) {
  return db.conversation.findFirst({
    where: {
      AND: [
        { id: conversationId },
        { OR: [{ agencyId }, { agencyId: null }] },
        { participants: { some: { userId } } },
        ...(access ? [visibleConversationWhere(access)] : []),
      ],
    },
    select: { id: true, type: true, name: true, agencyId: true, creatorId: true },
  });
}

/**
 * Keep only ids that are real staff of this agency. Creator pseudo-users
 * (emails ending in ".internal") are never valid chat members. With `access`,
 * only staff inside the caller's team scope count (for pickers and adds).
 */
export async function staffIdsInAgency(
  ids: string[],
  agencyId: string,
  access?: Pick<Access, "agencyId" | "userId" | "teamScope">
): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
  if (unique.length === 0) return [];
  const users = await db.user.findMany({
    where: {
      AND: [{ id: { in: unique } }, { agencyId }, excludePseudoUsers, ...(access ? [staffWhere(access)] : [])],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export const GROUP_NAME_MAX = 60;

/** Trimmed, single-line group name, or null when it is empty. */
export function cleanGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, GROUP_NAME_MAX);
  return name || null;
}
