import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import {
  BUILT_IN_FOR_ENUM,
  ENUM_FOR_BUILT_IN,
  PERMISSION_BY_KEY,
  PRESET_IDS,
  withImplied,
  type CreatorScope,
  type PermissionKey,
  type PresetId,
  type TeamScope,
} from "./catalogue";
import { OWNER_RECORD, loadPresetRow, loadRoles, roleIdOf, rowToRole, type RoleRecord } from "./roles";

/**
 * Server-side access: the real gate. See README.md in this folder for how to
 * guard routes, pages and queries.
 */

export interface Access {
  userId: string;
  agencyId: string;
  isOwner: boolean;
  role: Pick<RoleRecord, "id" | "name" | "kind" | "preset">;
  /** Effective keys (implications applied) */
  keys: ReadonlySet<string>;
  has(key: PermissionKey): boolean;
  hasAny(keys: PermissionKey[]): boolean;
  creatorScope: CreatorScope;
  /** "assigned": the role sees each person's assigned creators (creatorScope holds their list) */
  creatorScopeSource: "role" | "assigned";
  teamScope: TeamScope;
}

function build(userId: string, agencyId: string, role: RoleRecord, assignedCreatorIds: string[] = []): Access {
  const isOwner = role.kind === "owner";
  const keys = withImplied(role.keys);
  // "Creators assigned to them" becomes this person's own list, so every query
  // below only ever sees all / groups / creators
  const assigned = !isOwner && role.creatorScope.type === "assigned";
  return {
    userId,
    agencyId,
    isOwner,
    role: { id: role.id, name: role.name, kind: role.kind, preset: role.preset },
    keys,
    has: (k) => isOwner || keys.has(k),
    hasAny: (ks) => isOwner || ks.some((k) => keys.has(k)),
    creatorScope: isOwner ? { type: "all" } : assigned ? { type: "creators", creatorIds: assignedCreatorIds } : role.creatorScope,
    creatorScopeSource: assigned ? "assigned" : "role",
    teamScope: isOwner ? { type: "all" } : role.teamScope,
  };
}

/** Access for an already-known user row (also used by tests) */
export function accessFor(userId: string, agencyId: string, role: RoleRecord, assignedCreatorIds: string[] = []): Access {
  return build(userId, agencyId, role, assignedCreatorIds);
}

/**
 * Resolve the signed-in person's access. Reads the user's current role from
 * the database (never trusts the role in the session token, which can be
 * minutes stale). Returns null when not signed in as staff.
 */
export async function getAccess(session?: Session | null): Promise<Access | null> {
  const s = session === undefined ? await getServerSession(authOptions) : session;
  if (!s?.user?.id || !s.user.agencyId) return null;
  const user = await db.user.findUnique({
    where: { id: s.user.id },
    select: {
      role: true,
      agencyId: true,
      assignedCreatorIds: true,
      customRole: {
        select: {
          id: true,
          agencyId: true,
          name: true,
          description: true,
          color: true,
          permissions: true,
          creatorVisibility: true,
          teamMemberVisibility: true,
          dataFieldVisibility: true,
          isSystem: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!user?.agencyId || user.agencyId !== s.user.agencyId) return null;
  if (user.role === "OWNER") return build(s.user.id, user.agencyId, OWNER_RECORD);
  const assigned = Array.isArray(user.assignedCreatorIds) ? user.assignedCreatorIds.filter((x): x is string => typeof x === "string") : [];
  if (user.customRole && user.customRole.agencyId === user.agencyId) {
    return build(s.user.id, user.agencyId, rowToRole(user.customRole), assigned);
  }
  const preset = (PRESET_IDS as string[]).find((p) => ENUM_FOR_BUILT_IN[p as PresetId] === user.role) as PresetId | undefined;
  return build(s.user.id, user.agencyId, await loadPresetRow(user.agencyId, preset ?? "member"), assigned);
}

/** Per-render access for server components and layouts (deduplicated with React cache) */
export const getPageAccess = cache(async (): Promise<Access> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) redirect("/login");
  const access = await getAccess(session);
  if (!access) redirect("/login");
  return access;
});

/** "You don't have permission to approve uploads." */
export function forbiddenMessage(key: PermissionKey | PermissionKey[]): string {
  const k = Array.isArray(key) ? key[0] : key;
  const label = PERMISSION_BY_KEY[k]?.label;
  return label ? `You don't have permission to ${label.charAt(0).toLowerCase()}${label.slice(1)}.` : "You don't have permission to do that.";
}

export function forbidden(key: PermissionKey | PermissionKey[], message?: string) {
  return NextResponse.json({ error: message ?? forbiddenMessage(key) }, { status: 403 });
}

type Gate = { access: Access; session: Session; error?: undefined } | { error: NextResponse; access?: undefined; session?: undefined };

/**
 * Route guard. `key` may be one key, an array (any of them is enough), or
 * null (signed-in staff only).
 *
 *   const gate = await requireAccess("review.approve");
 *   if (gate.error) return gate.error;
 *   const { access, session } = gate;
 */
export async function requireAccess(key: PermissionKey | PermissionKey[] | null): Promise<Gate> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.agencyId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const access = await getAccess(session);
  if (!access) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (key !== null) {
    const ok = Array.isArray(key) ? access.hasAny(key) : access.has(key);
    if (!ok) return { error: forbidden(key) };
  }
  return { access, session };
}

// ---------- query scopes ----------

/** The creator-scope fragment alone (no agency) */
export function creatorScopeWhere(access: Pick<Access, "creatorScope">): Prisma.CreatorWhereInput {
  const s = access.creatorScope;
  if (s.type === "groups") return { groupMemberships: { some: { groupId: { in: s.groupIds } } } };
  if (s.type === "creators") return { id: { in: s.creatorIds } };
  // Resolved in build(); if it ever arrives unresolved, show nothing
  if (s.type === "assigned") return { id: { in: [] } };
  return {};
}

/**
 * Creators this person may see, in their agency. Combine with your own
 * filter through AND or by spreading next to fields other than AND:
 *   db.creator.findMany({ where: { ...creatorWhere(access), archivedAt: null } })
 *   db.creator.findFirst({ where: { AND: [creatorWhere(access), { id }] } })
 */
export function creatorWhere(access: Pick<Access, "agencyId" | "creatorScope">): Prisma.CreatorWhereInput {
  return { agencyId: access.agencyId, AND: [creatorScopeWhere(access)] };
}

/** Requests whose creator this person may see, in their agency */
export function requestWhere(access: Pick<Access, "agencyId" | "creatorScope">): Prisma.ContentRequestWhereInput {
  const scope = creatorScopeWhere(access);
  return Object.keys(scope).length
    ? { agencyId: access.agencyId, AND: [{ creator: scope }] }
    : { agencyId: access.agencyId, AND: [] };
}

/** Uploads whose creator this person may see */
export function uploadWhere(access: Pick<Access, "agencyId" | "creatorScope">): Prisma.UploadWhereInput {
  return { request: requestWhere(access) };
}

/** True when this person may see this creator */
export async function canSeeCreator(access: Access, creatorId: string): Promise<boolean> {
  const n = await db.creator.count({ where: { AND: [creatorWhere(access), { id: creatorId }] } });
  return n > 0;
}

function roleIdWhere(roleId: string): Prisma.UserWhereInput {
  if (roleId === "owner") return { role: "OWNER" };
  if ((PRESET_IDS as string[]).includes(roleId)) {
    return { role: ENUM_FOR_BUILT_IN[roleId as PresetId], customRoleId: null };
  }
  return { role: { not: "OWNER" }, customRoleId: roleId };
}

/** The team-scope fragment alone */
export function staffScopeWhere(access: Pick<Access, "userId" | "teamScope">): Prisma.UserWhereInput {
  const s = access.teamScope;
  if (s.type === "self") return { id: access.userId };
  if (s.type === "members") return { id: { in: [access.userId, ...s.memberIds] } };
  if (s.type === "roles") return { OR: [{ id: access.userId }, ...s.roleIds.map(roleIdWhere)] };
  return {};
}

/**
 * Staff this person may see: same agency, no creator pseudo-users, within
 * their team scope (they always see themselves). Use for every staff list:
 * Team page, assignee/watcher/mention pickers, chat member pickers,
 * oversight, activity feeds.
 */
export function staffWhere(access: Pick<Access, "agencyId" | "userId" | "teamScope">): Prisma.UserWhereInput {
  return { agencyId: access.agencyId, AND: [excludePseudoUsers, staffScopeWhere(access)] };
}

/** Activity-log rows by staff this person may see */
export function activityWhere(access: Pick<Access, "agencyId" | "userId" | "teamScope">): Prisma.ActivityLogWhereInput {
  return { user: staffWhere(access) };
}

// ---------- notification recipients ----------

/**
 * Of these staff, the ones who may hear about something: their role holds any
 * of `keys` (when given) and can see `creatorId` (when given). Use it before
 * creating notifications or mentions about a creator, request or message, so
 * nobody is told about a creator outside their scope. Three queries whatever
 * the number of people (users, the agency's roles, the creator's groups).
 */
export async function recipientsWhoCanSee(
  agencyId: string,
  userIds: string[],
  opts: { creatorId?: string | null; keys?: PermissionKey[] } = {}
): Promise<string[]> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return [];
  const [users, roles, creator] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids }, agencyId, AND: [excludePseudoUsers] },
      select: { id: true, role: true, customRoleId: true },
    }),
    loadRoles(agencyId),
    opts.creatorId
      ? db.creator.findFirst({
          where: { id: opts.creatorId, agencyId },
          select: { id: true, groupMemberships: { select: { groupId: true } } },
        })
      : null,
  ]);
  if (opts.creatorId && !creator) return [];
  const byId = new Map(roles.map((r) => [r.id, r]));
  const presetRowIds = Object.fromEntries(roles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
  const creatorGroups = new Set(creator?.groupMemberships.map((g) => g.groupId) ?? []);
  return users
    .filter((u) => {
      const role =
        byId.get(roleIdOf(u, presetRowIds)) ?? byId.get(BUILT_IN_FOR_ENUM[u.role] ?? "member") ?? byId.get("member");
      if (!role) return false;
      const a = build(u.id, agencyId, role);
      if (opts.keys?.length && !a.hasAny(opts.keys)) return false;
      if (!creator) return true;
      const sc = a.creatorScope;
      if (sc.type === "groups") return sc.groupIds.some((g) => creatorGroups.has(g));
      if (sc.type === "creators") return sc.creatorIds.includes(creator.id);
      return true;
    })
    .map((u) => u.id);
}

// ---------- redaction ----------

/** Creator fields each creatorInfo key unlocks */
export const CREATOR_FIELDS: Record<string, string[]> = {
  "creatorInfo.email": ["email"],
  "creatorInfo.phone": ["phone"],
  "creatorInfo.notes": ["notes", "personalNotes"],
  "creatorInfo.location": ["timezone", "location"],
  "creatorInfo.preferences": ["contentPreferences", "preferredContact", "communicationPreferences"],
  "creatorInfo.content": ["uploads", "mediaItems"],
  "creatorInfo.activity": ["lastLoginAt", "lastActiveAt", "lastSeenAt"],
  "creatorInfo.invite": ["inviteToken", "inviteStatus", "inviteSentAt", "inviteLink", "inviteUrl", "inviteExpiresAt", "invite"],
};

/** Never sent to the browser, whoever is asking */
const ALWAYS_STRIPPED = ["portalPassword", "sessionToken", "sessionExpiry"];

export function hiddenCreatorFields(access: Pick<Access, "has">): string[] {
  const out = [...ALWAYS_STRIPPED];
  for (const [key, fields] of Object.entries(CREATOR_FIELDS)) if (!access.has(key)) out.push(...fields);
  return out;
}

const NESTED_CREATOR_KEYS = new Set(["creator", "creators"]);

// Each object's redacted copy, per context (as a creator or not). An object
// that appears twice reuses its copy; returning the original instead would
// send the second occurrence unredacted.
type RedactMemo = WeakMap<object, { creator?: unknown; other?: unknown }>;
const IN_PROGRESS = Symbol("in-progress");

function walk(value: unknown, hidden: Set<string>, isCreator: boolean, memo: RedactMemo): unknown {
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const obj = value as object;
  const slot = isCreator ? "creator" : "other";
  const entry = memo.get(obj) ?? {};
  // a cycle back into an object still being copied is dropped, never leaked
  if (entry[slot] === IN_PROGRESS) return undefined;
  if (slot in entry) return entry[slot];
  entry[slot] = IN_PROGRESS;
  memo.set(obj, entry);
  let out: unknown;
  if (Array.isArray(value)) {
    out = value.map((v) => walk(v, hidden, isCreator, memo));
  } else {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isCreator && hidden.has(k)) continue;
      copy[k] = walk(v, hidden, NESTED_CREATOR_KEYS.has(k), memo);
    }
    out = copy;
  }
  entry[slot] = out;
  return out;
}

/**
 * Remove the creator fields this person may not see. `value` is a creator,
 * an array of creators, or (with { root: false }) any payload whose creators
 * sit under `creator` / `creators` keys at any depth (a request, a list of
 * conversations). Returns a copy; never mutates.
 */
export function redactCreator<T>(access: Pick<Access, "has">, value: T, opts: { root?: boolean } = {}): T {
  const hidden = new Set(hiddenCreatorFields(access));
  return walk(value, hidden, opts.root !== false, new WeakMap()) as T;
}

/** redactCreator for a payload that holds creators under creator/creators keys */
export function redactCreatorsIn<T>(access: Pick<Access, "has">, value: T): T {
  return redactCreator(access, value, { root: false });
}

// ---------- client payload ----------

export interface ClientAccess {
  userId: string;
  isOwner: boolean;
  roleId: string;
  roleName: string;
  keys: string[];
  creatorScope: CreatorScope["type"];
  teamScope: TeamScope["type"];
}

export function toClientAccess(access: Access): ClientAccess {
  return {
    userId: access.userId,
    isOwner: access.isOwner,
    roleId: access.role.id,
    roleName: access.role.name,
    keys: access.isOwner ? Object.keys(PERMISSION_BY_KEY) : [...access.keys],
    creatorScope: access.creatorScopeSource === "assigned" ? "assigned" : access.creatorScope.type,
    teamScope: access.teamScope.type,
  };
}
