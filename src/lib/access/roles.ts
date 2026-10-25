import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import {
  ALL_CREATORS,
  CATALOGUE_REV,
  BUILT_IN_FOR_ENUM,
  ENUM_FOR_BUILT_IN,
  EVERYONE,
  OWNER_ROLE,
  PERMISSION_KEYS,
  PRESETS,
  PRESET_IDS,
  isPermissionKey,
  upgradeKeys,
  withImplied,
  type CreatorScope,
  type PresetId,
  type TeamScope,
} from "./catalogue";

/**
 * Role storage (v2). No schema change: the existing CustomRole JSON columns
 * carry the new shape, each marked `version: 2`:
 *   permissions          { version: 2, rev, preset?: "admin"|"manager"|"member", keys: string[] }
 *                        (rev = the catalogue revision the keys were saved at; see upgradeKeys)
 *   creatorVisibility    { version: 2, type: "all" | "groups" | "creators", groupIds?, creatorIds? }
 *   teamMemberVisibility { version: 2, type: "all" | "roles" | "members" | "self", roleIds?, memberIds? }
 *   dataFieldVisibility  { version: 2 }  (creator information is now permission keys)
 * Admin, Manager and Member are CustomRole rows with isSystem: true, created
 * lazily per agency from PRESETS. Owner has no row: it is User.role = OWNER.
 * Older (v1) rows are read through a best-effort conversion and rewritten in
 * v2 the next time they are saved. User.permissionOverrides,
 * assignedCreatorIds and activityRestrictions are no longer read.
 */

export type RoleKind = "owner" | "preset" | "custom";

export interface RoleRecord {
  /** Route id: "owner" | "admin" | "manager" | "member" | a custom role's id */
  id: string;
  /** The CustomRole row id (null for owner) */
  dbId: string | null;
  kind: RoleKind;
  preset: PresetId | null;
  name: string;
  description: string | null;
  color: string | null;
  keys: string[];
  creatorScope: CreatorScope;
  teamScope: TeamScope;
  updatedAt: string | null;
}

type Row = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  permissions: Prisma.JsonValue;
  creatorVisibility: Prisma.JsonValue;
  teamMemberVisibility: Prisma.JsonValue;
  dataFieldVisibility: Prisma.JsonValue;
  isSystem: boolean;
  updatedAt: Date;
};

const rowSelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  permissions: true,
  creatorVisibility: true,
  teamMemberVisibility: true,
  dataFieldVisibility: true,
  isSystem: true,
  updatedAt: true,
} as const;

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function isV2(row: Pick<Row, "permissions">): boolean {
  return obj(row.permissions)?.version === 2;
}

// ---------- parsing ----------

export function parseCreatorScope(v: unknown): CreatorScope {
  const o = obj(v);
  if (!o) return ALL_CREATORS;
  if (o.type === "groups") return { type: "groups", groupIds: strings(o.groupIds) };
  if (o.type === "creators" || o.type === "specific") return { type: "creators", creatorIds: strings(o.creatorIds) };
  return ALL_CREATORS; // "all", and legacy "assigned" (never enforced)
}

export function parseTeamScope(v: unknown): TeamScope {
  const o = obj(v);
  if (!o) return EVERYONE;
  if (o.version === 2) {
    if (o.type === "self") return { type: "self" };
    if (o.type === "roles") return { type: "roles", roleIds: strings(o.roleIds) };
    if (o.type === "members") return { type: "members", memberIds: strings(o.memberIds) };
    return EVERYONE;
  }
  // v1: { canSeeOtherMembers, visibleMemberIds }
  if (o.canSeeOtherMembers === false) {
    const ids = strings(o.visibleMemberIds);
    return ids.length ? { type: "members", memberIds: ids } : { type: "self" };
  }
  return EVERYONE;
}

const LEGACY: Record<string, Record<string, string[]>> = {
  creators: { view: ["creators.view"], create: ["creators.invite"], edit: ["creators.edit"], delete: ["creators.delete"], export: ["exports.data"], assign: ["creators.groups"] },
  requests: { view: ["requests.view", "requests.comment"], create: ["requests.create"], edit: ["requests.edit", "requests.archive"], delete: ["requests.delete"], approve: ["review.approve"], export: ["requests.export"] },
  uploads: { view: ["review.view", "review.reveal"], approve: ["review.approve"], reject: ["review.requestChanges"], download: ["review.download"] },
  templates: { view: ["templates.view"], create: ["templates.create"], edit: ["templates.edit"], delete: ["templates.delete"] },
  reports: { view: ["reports.view"], export: ["reports.export"] },
  analytics: { view: ["analytics.view"], export: ["reports.export"] },
  settings: { edit: ["settings.branding", "settings.emailTemplates", "settings.notifications", "settings.announcements"] },
  team: { view: ["team.view"], invite: ["team.invite"], edit: ["team.changeRoles"], remove: ["team.remove"] },
  integrations: { edit: ["settings.integrations"] },
  audit_log: { view: ["settings.auditLog"] },
};

/** Best-effort reading of a v1 role (resources × actions + field visibility) */
function legacyKeys(row: Row): string[] {
  const keys = new Set<string>(["overview.view", "calendar.view", "messages.creators", "messages.reply", "messages.team"]);
  const perms = Array.isArray(row.permissions) ? row.permissions : [];
  for (const p of perms) {
    const o = obj(p);
    const map = o && typeof o.resource === "string" ? LEGACY[o.resource] : undefined;
    if (!map) continue;
    for (const a of strings(o!.actions)) for (const k of map[a] ?? []) keys.add(k);
  }
  const fields = obj(obj(row.dataFieldVisibility)?.creatorFields);
  const sees = (f: string) => {
    const v = fields?.[f];
    if (v === undefined) return true;
    return typeof v === "boolean" ? v : obj(v)?.view !== false;
  };
  if (sees("email")) keys.add("creatorInfo.email");
  if (sees("phone")) keys.add("creatorInfo.phone");
  if (sees("personalNotes")) keys.add("creatorInfo.notes");
  for (const k of ["creatorInfo.location", "creatorInfo.preferences", "creatorInfo.content", "creatorInfo.activity", "creatorInfo.invite"]) keys.add(k);
  return [...keys];
}

function presetOf(row: Row): PresetId | null {
  if (!row.isSystem) return null;
  const p = obj(row.permissions)?.preset;
  if (typeof p === "string" && (PRESET_IDS as string[]).includes(p)) return p as PresetId;
  const byName = PRESET_IDS.find((id) => PRESETS[id].name.toLowerCase() === row.name.toLowerCase());
  return byName ?? null;
}

export function rowToRole(row: Row): RoleRecord {
  const preset = presetOf(row);
  const stored = isV2(row) ? strings(obj(row.permissions)!.keys).filter(isPermissionKey) : legacyKeys(row);
  const rev = isV2(row) ? Number(obj(row.permissions)!.rev ?? 1) || 1 : 1;
  const keys = upgradeKeys([...withImplied(stored)], rev, preset ? PRESETS[preset].keys : undefined);
  return {
    id: preset ?? row.id,
    dbId: row.id,
    kind: preset ? "preset" : "custom",
    preset,
    name: preset ? PRESETS[preset].name : row.name,
    description: row.description,
    color: row.color,
    keys: [...withImplied(keys)],
    creatorScope: parseCreatorScope(row.creatorVisibility),
    teamScope: parseTeamScope(row.teamMemberVisibility),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const OWNER_RECORD: RoleRecord = {
  id: "owner",
  dbId: null,
  kind: "owner",
  preset: null,
  name: OWNER_ROLE.name,
  description: OWNER_ROLE.description,
  color: OWNER_ROLE.color,
  keys: [...PERMISSION_KEYS],
  creatorScope: ALL_CREATORS,
  teamScope: EVERYONE,
  updatedAt: null,
};

// ---------- writing ----------

export function storedFields(input: {
  keys: string[];
  creatorScope: CreatorScope;
  teamScope: TeamScope;
  preset?: PresetId | null;
}) {
  return {
    permissions: {
      version: 2,
      rev: CATALOGUE_REV,
      ...(input.preset ? { preset: input.preset } : {}),
      keys: [...withImplied(input.keys)],
    } as Prisma.InputJsonValue,
    creatorVisibility: { version: 2, ...input.creatorScope } as Prisma.InputJsonValue,
    teamMemberVisibility: { version: 2, ...input.teamScope } as Prisma.InputJsonValue,
    dataFieldVisibility: { version: 2 } as Prisma.InputJsonValue,
  };
}

function presetData(id: PresetId) {
  const p = PRESETS[id];
  return storedFields({ keys: p.keys, creatorScope: p.creatorScope, teamScope: p.teamScope, preset: id });
}

const ensured = new Set<string>();

/**
 * Make sure the agency has its Admin / Manager / Member rows (v2). Cheap after
 * the first call per process. A v1 system row with a preset's name is reset to
 * that preset's defaults; a non-system role that holds a preset's name is
 * renamed out of the way.
 */
export async function ensurePresets(agencyId: string): Promise<void> {
  if (ensured.has(agencyId)) return;
  const rows = await db.customRole.findMany({ where: { agencyId }, select: rowSelect });
  for (const id of PRESET_IDS) {
    const name = PRESETS[id].name;
    const existing = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.isSystem) {
      if (!isV2(existing)) {
        await db.customRole.update({ where: { id: existing.id }, data: { ...presetData(id), name } });
      }
      continue;
    }
    if (existing) {
      await db.customRole.update({ where: { id: existing.id }, data: { name: `${existing.name} (custom)` } });
    }
    await db.customRole
      .create({
        data: {
          agencyId,
          name,
          isSystem: true,
          description: PRESETS[id].description,
          color: PRESETS[id].color,
          ...presetData(id),
        },
      })
      .catch((e: unknown) => {
        // Another request created it at the same moment
        if ((e as { code?: string })?.code !== "P2002") throw e;
      });
  }
  // Old system rows that are not presets (Editor, Viewer, Owner) become ordinary roles
  const stray = rows.filter((r) => r.isSystem && !PRESET_IDS.some((id) => PRESETS[id].name.toLowerCase() === r.name.toLowerCase()));
  if (stray.length) {
    await db.customRole.updateMany({ where: { id: { in: stray.map((r) => r.id) } }, data: { isSystem: false } });
  }
  ensured.add(agencyId);
}

/** Forget the cache (tests, or after a preset row was deleted by hand) */
export function forgetPresets(agencyId?: string) {
  if (agencyId) ensured.delete(agencyId);
  else ensured.clear();
}

// ---------- reading ----------

export async function loadPresetRow(agencyId: string, preset: PresetId): Promise<RoleRecord> {
  await ensurePresets(agencyId);
  const row = await db.customRole.findFirst({
    where: { agencyId, isSystem: true, name: { equals: PRESETS[preset].name, mode: "insensitive" } },
    select: rowSelect,
  });
  if (!row) {
    forgetPresets(agencyId);
    const p = PRESETS[preset];
    return { ...OWNER_RECORD, id: preset, kind: "preset", preset, name: p.name, description: p.description, color: p.color, keys: p.keys, creatorScope: p.creatorScope, teamScope: p.teamScope };
  }
  return rowToRole(row);
}

const ORDER: Record<string, number> = { owner: 0, admin: 1, manager: 2, member: 3 };

/** Every role in the agency: Owner, the three presets, then custom roles by name */
export async function loadRoles(agencyId: string): Promise<RoleRecord[]> {
  await ensurePresets(agencyId);
  const rows = await db.customRole.findMany({ where: { agencyId }, select: rowSelect, orderBy: { name: "asc" } });
  const roles = rows.map(rowToRole);
  return [OWNER_RECORD, ...roles].sort((a, b) => (ORDER[a.id] ?? 9) - (ORDER[b.id] ?? 9) || a.name.localeCompare(b.name));
}

/** One role by route id ("owner", "admin", ... or a custom role id). Preset row ids resolve too. */
export async function loadRole(agencyId: string, id: string): Promise<RoleRecord | null> {
  if (id === "owner") return OWNER_RECORD;
  if ((PRESET_IDS as string[]).includes(id)) return loadPresetRow(agencyId, id as PresetId);
  const row = await db.customRole.findFirst({ where: { id, agencyId }, select: rowSelect });
  return row ? rowToRole(row) : null;
}

/** The role id a user holds: owner, a custom role id, or their preset */
export function roleIdOf(user: { role: UserRole | string; customRoleId: string | null }, presetRowIds?: Record<string, PresetId>): string {
  if (user.role === "OWNER") return "owner";
  if (user.customRoleId) return presetRowIds?.[user.customRoleId] ?? user.customRoleId;
  return BUILT_IN_FOR_ENUM[user.role] ?? "member";
}

/** Prisma filter for "users who hold this role" */
export function holdersWhere(role: RoleRecord): Prisma.UserWhereInput {
  if (role.kind === "owner") return { role: "OWNER" };
  if (role.kind === "preset") {
    return {
      role: { not: "OWNER" },
      OR: [{ customRoleId: null, role: ENUM_FOR_BUILT_IN[role.preset!] }, ...(role.dbId ? [{ customRoleId: role.dbId }] : [])],
    };
  }
  return { role: { not: "OWNER" }, customRoleId: role.dbId };
}

/** How many real staff hold each role (by route id) */
export async function roleMemberCounts(agencyId: string, roles: RoleRecord[]): Promise<Record<string, number>> {
  const users = await db.user.findMany({
    where: { agencyId, ...excludePseudoUsers },
    select: { role: true, customRoleId: true },
  });
  const presetRowIds = Object.fromEntries(roles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
  const counts: Record<string, number> = Object.fromEntries(roles.map((r) => [r.id, 0]));
  for (const u of users) {
    const id = roleIdOf(u, presetRowIds);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** The User columns that put someone on this role */
export function assignmentData(role: RoleRecord): { role: UserRole; customRoleId: string | null } {
  if (role.kind === "owner") return { role: "OWNER", customRoleId: null };
  if (role.kind === "preset") return { role: ENUM_FOR_BUILT_IN[role.preset!], customRoleId: null };
  // A custom role rides on the MEMBER base role
  return { role: "MEMBER", customRoleId: role.dbId };
}
