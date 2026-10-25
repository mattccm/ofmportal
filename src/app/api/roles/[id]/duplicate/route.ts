import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { loadRole, rowToRole, storedFields } from "@/lib/access/roles";
import { withCounts } from "@/lib/access/role-input";

/** POST: copy any role (Owner included) into a new custom role named "Copy of …". Needs "roles.manage". */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    const source = await loadRole(access.agencyId, id);
    if (!source) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    const taken = new Set(
      (await db.customRole.findMany({ where: { agencyId: access.agencyId }, select: { name: true } })).map((r) => r.name.toLowerCase())
    );
    let name = `Copy of ${source.name}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `Copy of ${source.name} (${n})`;

    const row = await db.customRole.create({
      data: {
        agencyId: access.agencyId,
        name,
        description: source.description,
        color: source.color,
        isSystem: false,
        ...storedFields({ keys: source.keys, creatorScope: source.creatorScope, teamScope: source.teamScope }),
      },
    });
    await db.activityLog.create({
      data: {
        userId: access.userId,
        action: "role.created",
        entityType: "CustomRole",
        entityId: row.id,
        metadata: { roleName: name, duplicatedFrom: source.name },
      },
    });
    const [role] = await withCounts(access.agencyId, [rowToRole(row)]);
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to duplicate the role" }, { status: 500 });
  }
}
