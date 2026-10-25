import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { requireAccess } from "@/lib/access/server";
import { ALL_CREATORS, EVERYONE } from "@/lib/access/catalogue";
import { loadRoles, rowToRole, storedFields } from "@/lib/access/roles";
import { cleanInput, reservedName, roleInputSchema, withCounts } from "@/lib/access/role-input";

/**
 * Roles (Settings > Roles and permissions). Everything here needs
 * "roles.manage". Owner, Admin, Manager and Member always exist; custom roles
 * are created here. One role is edited at /api/roles/[id].
 */

export async function GET() {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const roles = await loadRoles(gate.access.agencyId);
    return NextResponse.json({ roles: await withCounts(gate.access.agencyId, roles) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error fetching roles:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = roleInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the role details" }, { status: 400 });
    }
    const name = parsed.data.name?.trim();
    if (!name) return NextResponse.json({ error: "Give the role a name" }, { status: 400 });
    if (reservedName(name)) {
      return NextResponse.json({ error: `${name} is a built-in role. Choose another name.` }, { status: 400 });
    }
    const clash = await db.customRole.findFirst({
      where: { agencyId: access.agencyId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });

    const clean = await cleanInput(access.agencyId, parsed.data);
    const row = await db.customRole.create({
      data: {
        agencyId: access.agencyId,
        name,
        description: parsed.data.description || null,
        color: parsed.data.color ?? null,
        isSystem: false,
        ...storedFields({
          keys: clean.keys ?? [],
          creatorScope: clean.creatorScope ?? ALL_CREATORS,
          teamScope: clean.teamScope ?? EVERYONE,
        }),
      },
    });

    await db.activityLog.create({
      data: { userId: access.userId, action: "role.created", entityType: "CustomRole", entityId: row.id, metadata: { roleName: name } },
    });

    const [role] = await withCounts(access.agencyId, [rowToRole(row)]);
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to create the role" }, { status: 500 });
  }
}
