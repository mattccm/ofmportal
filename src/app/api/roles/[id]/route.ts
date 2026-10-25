import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { requireAccess, staffWhere } from "@/lib/access/server";
import { holdersWhere, loadRole, rowToRole, storedFields } from "@/lib/access/roles";
import { cleanInput, reservedName, roleInputSchema, withCounts } from "@/lib/access/role-input";

/**
 * One role. GET it with the people on it, PUT to save it, DELETE a custom
 * role nobody holds. Needs "roles.manage". The Owner role can't be changed;
 * built-in roles keep their names and can't be deleted.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;
    const role = await loadRole(access.agencyId, id);
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    const members = await db.user.findMany({
      where: { AND: [staffWhere(access), holdersWhere(role)] },
      select: { id: true, name: true, email: true, avatar: true },
      orderBy: { name: "asc" },
    });
    const [withCount] = await withCounts(access.agencyId, [role]);
    return NextResponse.json({ role: withCount, members }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load the role" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    const role = await loadRole(access.agencyId, id);
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.kind === "owner" || !role.dbId) {
      return NextResponse.json({ error: "The Owner role can't be changed" }, { status: 403 });
    }

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = roleInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the role details" }, { status: 400 });
    }
    const input = parsed.data;

    let name: string | undefined;
    if (input.name !== undefined && input.name.trim() !== role.name) {
      if (role.kind === "preset") {
        return NextResponse.json({ error: "Built-in roles keep their name. Duplicate it to make a renamed copy." }, { status: 400 });
      }
      name = input.name.trim();
      if (reservedName(name)) return NextResponse.json({ error: `${name} is a built-in role. Choose another name.` }, { status: 400 });
      const clash = await db.customRole.findFirst({
        where: { agencyId: access.agencyId, name: { equals: name, mode: "insensitive" }, id: { not: role.dbId } },
        select: { id: true },
      });
      if (clash) return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
    }

    const clean = await cleanInput(access.agencyId, input);
    const stored = storedFields({
      keys: clean.keys ?? role.keys,
      creatorScope: clean.creatorScope ?? role.creatorScope,
      teamScope: clean.teamScope ?? role.teamScope,
      preset: role.preset,
    });
    const row = await db.customRole.update({
      where: { id: role.dbId },
      data: {
        ...stored,
        ...(name ? { name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });

    await db.activityLog.create({
      data: {
        userId: access.userId,
        action: "role.updated",
        entityType: "CustomRole",
        entityId: row.id,
        metadata: { roleName: row.name, changes: Object.keys(input) },
      },
    });

    const [saved] = await withCounts(access.agencyId, [rowToRole(row)]);
    return NextResponse.json({ role: saved });
  } catch (error) {
    console.error("Error saving role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to save the role" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const gate = await requireAccess("roles.manage");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;

    const role = await loadRole(access.agencyId, id);
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.kind !== "custom" || !role.dbId) {
      return NextResponse.json({ error: "Built-in roles can't be deleted" }, { status: 400 });
    }
    const holders = await db.user.count({ where: { agencyId: access.agencyId, customRoleId: role.dbId, email: { not: { endsWith: ".internal" } } } });
    if (holders > 0) {
      return NextResponse.json(
        { error: `${holders} ${holders === 1 ? "person has" : "people have"} this role. Move them to another role first.` },
        { status: 400 }
      );
    }
    await db.customRole.delete({ where: { id: role.dbId } });
    await db.activityLog.create({
      data: { userId: access.userId, action: "role.deleted", entityType: "CustomRole", entityId: role.dbId, metadata: { roleName: role.name } },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to delete the role" }, { status: 500 });
  }
}
