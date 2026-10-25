import type { PermissionKey } from "@/lib/access/catalogue";
import { creatorScopeWhere, redactCreator, type Access } from "@/lib/access/server";

/**
 * Keys that let someone pick creators by name somewhere in the app (request
 * forms, message composer, email composer, group editor, recurring and bundle
 * editors, exports). The creator list API answers any of them, always within
 * the person's creator scope and with creator information redacted.
 */
export const CREATOR_PICKER_KEYS: PermissionKey[] = [
  "creators.view",
  "requests.view",
  "requests.create",
  "messages.creators",
  "messages.email",
  "recurring.view",
  "bundles.view",
  "reminders.view",
  "exports.data",
  "settings.data",
];

type Has = { has(key: PermissionKey): boolean };

/**
 * contentPreferences can hold a copy of the creator's contact details and time
 * zone (communicationPreferences.contactDetails / .timezone) and the team's
 * private notes (internalNotes). redactCreator
 * removes the whole object without creatorInfo.preferences; when preferences
 * are visible, this removes the copies of fields the person still can't see.
 */
export function scrubPreferences<T>(access: Has, prefs: T): T {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return prefs;
  const out: Record<string, unknown> = { ...(prefs as Record<string, unknown>) };
  // Private notes are also kept inside contentPreferences
  if (!access.has("creatorInfo.notes")) delete out.internalNotes;
  const comm = out.communicationPreferences;
  if (comm && typeof comm === "object" && !Array.isArray(comm)) {
    out.communicationPreferences = scrubCommunication(access, comm as Record<string, unknown>);
  }
  return out as T;
}

/** The same scrub for a communicationPreferences object on its own */
export function scrubCommunication(access: Has, comm: Record<string, unknown>): Record<string, unknown> {
  const c: Record<string, unknown> = { ...comm };
  const details = c.contactDetails;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const d: Record<string, unknown> = { ...(details as Record<string, unknown>) };
    if (!access.has("creatorInfo.email")) delete d.email;
    if (!access.has("creatorInfo.phone")) {
      delete d.phone;
      delete d.whatsapp;
    }
    c.contactDetails = d;
  }
  if (!access.has("creatorInfo.location")) delete c.timezone;
  return c;
}

// ---------- creator groups ----------

type ScopeAccess = Pick<Access, "agencyId" | "creatorScope" | "has">;

/**
 * Prisma include for a group: only members inside the person's creator
 * scope, and a member count that counts only those.
 */
export function groupInclude(access: ScopeAccess) {
  const inScope = { creator: creatorScopeWhere(access) };
  return {
    members: {
      where: inScope,
      orderBy: { sortOrder: "asc" as const },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true, inviteStatus: true },
        },
      },
    },
    _count: { select: { members: { where: inScope } } },
  };
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: {
    sortOrder: number;
    creator: { id: string; name: string; email: string; avatar: string | null; inviteStatus: string };
  }[];
  _count: { members: number };
}

/** The group shape the UI reads, with member details redacted */
export function shapeGroup(access: ScopeAccess, group: GroupRow) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    memberCount: group._count.members,
    members: redactCreator(
      access,
      group.members.map((m) => ({
        id: m.creator.id,
        name: m.creator.name,
        email: m.creator.email,
        avatar: m.creator.avatar,
        inviteStatus: m.creator.inviteStatus,
        sortOrder: m.sortOrder,
      }))
    ),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
