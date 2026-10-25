import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";

/**
 * Staff access to an inbox conversation: the conversation must belong to the
 * caller's agency (or be a legacy row with no agency) AND the caller must be a
 * participant. Anything else reads as "not found", so a removed group member
 * cannot even confirm the thread still exists.
 */
export async function findStaffConversation(conversationId: string, userId: string, agencyId: string) {
  return db.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ agencyId }, { agencyId: null }],
      participants: { some: { userId } },
    },
    select: { id: true, type: true, name: true, agencyId: true, creatorId: true },
  });
}

/**
 * Keep only ids that are real staff of this agency. Creator pseudo-users
 * (emails ending in ".internal") are never valid chat members.
 */
export async function staffIdsInAgency(ids: string[], agencyId: string): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
  if (unique.length === 0) return [];
  const users = await db.user.findMany({
    where: { AND: [{ id: { in: unique } }, { agencyId }, excludePseudoUsers] },
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
