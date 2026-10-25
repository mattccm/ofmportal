import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { PRESETS } from "@/lib/access/catalogue";
import { loadRole, rowToRole, storedFields } from "@/lib/access/roles";
import { withCounts } from "@/lib/access/role-input";

/** POST: put a built-in role (Admin, Manager, Member) back to its defaults. Needs "roles.manage". */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    const role = await loadRole(access.agencyId, id);
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.kind !== "preset" || !role.preset || !role.dbId) {
      return NextResponse.json({ error: "Only built-in roles have defaults to go back to" }, { status: 400 });
    }
    const p = PRESETS[role.preset];
    const row = await db.customRole.update({
      where: { id: role.dbId },
      data: {
        description: p.description,
        color: p.color,
        ...storedFields({ keys: p.keys, creatorScope: p.creatorScope, teamScope: p.teamScope, preset: p.id }),
      },
    });
    await db.activityLog.create({
      data: { userId: access.userId, action: "role.updated", entityType: "CustomRole", entityId: row.id, metadata: { roleName: row.name, reset: true } },
    });
    const [saved] = await withCounts(access.agencyId, [rowToRole(row)]);
    return NextResponse.json({ role: saved });
  } catch (error) {
    console.error("Error resetting role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to reset the role" }, { status: 500 });
  }
}
