import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canSeeCreator, requireAccess, staffWhere } from "@/lib/access/server";
import { assignmentEffects, setTeammatesFor, teammatesFor } from "@/lib/assignments";

/**
 * Who looks after a creator. GET: the teammates you can see, each marked
 * assigned or not. PUT { userIds }: set them ("creators.assign"); teammates
 * you can't see keep what they had.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAccess("creators.view");
  if (gate.error) return gate.error;
  const { access } = gate;
  const { id } = await params;
  if (!(await canSeeCreator(access, id))) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const [staff, assigned] = await Promise.all([
    db.user.findMany({ where: staffWhere(access), select: { id: true, name: true, avatar: true, role: true, customRoleId: true }, orderBy: { name: "asc" } }),
    teammatesFor(access.agencyId, id),
  ]);
  const on = new Set(assigned);
  const effects = await assignmentEffects(access.agencyId, staff);
  return NextResponse.json({
    teammates: staff.map((u) => ({
      id: u.id,
      name: u.name || "Teammate",
      avatar: u.avatar,
      assigned: on.has(u.id),
      // "hidden": their role is limited to chosen creators or groups, so this alone won't show the creator to them
      effect: effects[u.id]?.effect ?? "all",
      roleName: effects[u.id]?.roleName ?? "",
    })),
    canAssign: access.has("creators.assign"),
  });
}

const putSchema = z.object({ userIds: z.array(z.string()).max(500) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAccess("creators.assign");
  if (gate.error) return gate.error;
  const { access, session } = gate;
  const { id } = await params;
  if (!(await canSeeCreator(access, id))) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose teammates" }, { status: 400 });

  const visible = await db.user.findMany({ where: staffWhere(access), select: { id: true } });
  await setTeammatesFor(access.agencyId, id, parsed.data.userIds, visible.map((u) => u.id));
  const now = await teammatesFor(access.agencyId, id);

  await db.activityLog
    .create({
      data: {
        userId: session.user.id,
        action: "creator.teammates_set",
        entityType: "Creator",
        entityId: id,
        metadata: { teammateIds: now },
      },
    })
    .catch(() => {});
  return NextResponse.json({ assigned: now });
}
