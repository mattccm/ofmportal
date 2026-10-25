import { z } from "zod";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import { BUILT_IN_ROLE_IDS, OWNER_ROLE, PRESETS, PRESET_IDS, isPermissionKey, type CreatorScope, type TeamScope } from "./catalogue";
import { roleMemberCounts, type RoleRecord } from "./roles";

/** Request body for creating or saving a role */
export const roleInputSchema = z.object({
  name: z.string().trim().min(1, "Give the role a name").max(60, "Keep the name under 60 characters").optional(),
  description: z.string().trim().max(240, "Keep the description under 240 characters").nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour")
    .nullable()
    .optional(),
  keys: z.array(z.string()).max(500).optional(),
  creatorScope: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("all") }),
      z.object({ type: z.literal("groups"), groupIds: z.array(z.string()).max(500) }),
      z.object({ type: z.literal("creators"), creatorIds: z.array(z.string()).max(5000) }),
    ])
    .optional(),
  teamScope: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("all") }),
      z.object({ type: z.literal("self") }),
      z.object({ type: z.literal("roles"), roleIds: z.array(z.string()).max(200) }),
      z.object({ type: z.literal("members"), memberIds: z.array(z.string()).max(1000) }),
    ])
    .optional(),
});

export type RoleInput = z.infer<typeof roleInputSchema>;

const RESERVED = [OWNER_ROLE.name, ...PRESET_IDS.map((id) => PRESETS[id].name)].map((n) => n.toLowerCase());

export function reservedName(name: string): boolean {
  return RESERVED.includes(name.trim().toLowerCase());
}

/** Drop unknown keys, and ids that are not in this agency */
export async function cleanInput(agencyId: string, input: RoleInput) {
  const keys = input.keys?.filter(isPermissionKey);

  let creatorScope: CreatorScope | undefined = input.creatorScope;
  if (creatorScope?.type === "groups") {
    const found = await db.creatorGroup.findMany({ where: { agencyId, id: { in: creatorScope.groupIds } }, select: { id: true } });
    creatorScope = { type: "groups", groupIds: found.map((g) => g.id) };
  } else if (creatorScope?.type === "creators") {
    const found = await db.creator.findMany({ where: { agencyId, id: { in: creatorScope.creatorIds } }, select: { id: true } });
    creatorScope = { type: "creators", creatorIds: found.map((c) => c.id) };
  }

  let teamScope: TeamScope | undefined = input.teamScope;
  if (teamScope?.type === "members") {
    const found = await db.user.findMany({ where: { agencyId, id: { in: teamScope.memberIds }, ...excludePseudoUsers }, select: { id: true } });
    teamScope = { type: "members", memberIds: found.map((u) => u.id) };
  } else if (teamScope?.type === "roles") {
    const custom = teamScope.roleIds.filter((id) => !(BUILT_IN_ROLE_IDS as readonly string[]).includes(id));
    const found = custom.length
      ? await db.customRole.findMany({ where: { agencyId, id: { in: custom }, isSystem: false }, select: { id: true } })
      : [];
    const ok = new Set([...BUILT_IN_ROLE_IDS, ...found.map((r) => r.id)]);
    teamScope = { type: "roles", roleIds: teamScope.roleIds.filter((id) => ok.has(id)) };
  }

  return { keys, creatorScope, teamScope };
}

export interface RoleSummaryJson extends RoleRecord {
  memberCount: number;
}

export async function withCounts(agencyId: string, roles: RoleRecord[]): Promise<RoleSummaryJson[]> {
  const counts = await roleMemberCounts(agencyId, roles);
  return roles.map((r) => ({ ...r, memberCount: counts[r.id] ?? 0 }));
}
