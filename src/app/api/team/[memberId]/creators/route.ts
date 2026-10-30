import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess, staffWhere } from "@/lib/access/server";
import { assignmentEffects, creatorsFor, setCreatorsFor } from "@/lib/assignments";

/**
 * The creators a teammate looks after. GET: the creators you can see, each
 * marked assigned or not. PUT { creatorIds }: set them ("creators.assign");
 * assignments to creators you can't see are kept.
 */

async function memberInScope(access: Parameters<typeof staffWhere>[0], memberId: string) {
  return db.user.findFirst({ where: { AND: [staffWhere(access), { id: memberId }] }, select: { id: true, name: true, role: true, customRoleId: true } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const gate = await requireAccess(["creators.assign", "team.view"]);
  if (gate.error) return gate.error;
  const { access } = gate;
  const { memberId } = await params;
  const member = await memberInScope(access, memberId);
  if (!member) return NextResponse.json({ error: "Teammate not found" }, { status: 404 });

  const [creators, assigned] = await Promise.all([
    db.creator.findMany({ where: { AND: [creatorWhere(access), { archivedAt: null }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    creatorsFor(memberId),
  ]);
  const on = new Set(assigned);
  const effect = (await assignmentEffects(access.agencyId, [member]))[member.id];
  return NextResponse.json({
    member: { id: member.id, name: member.name },
    effect: effect?.effect ?? "all",
    roleId: effect?.roleId ?? null,
    roleName: effect?.roleName ?? "",
    canManageRoles: access.has("roles.manage"),
    creators: creators.map((c) => ({ id: c.id, name: c.name, assigned: on.has(c.id) })),
    canAssign: access.has("creators.assign"),
  });
}

const putSchema = z.object({ creatorIds: z.array(z.string()).max(5000) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const gate = await requireAccess("creators.assign");
  if (gate.error) return gate.error;
  const { access, session } = gate;
  const { memberId } = await params;
  const member = await memberInScope(access, memberId);
  if (!member) return NextResponse.json({ error: "Teammate not found" }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose creators" }, { status: 400 });

  const visible = await db.creator.findMany({ where: creatorWhere(access), select: { id: true } });
  const result = await setCreatorsFor(memberId, parsed.data.creatorIds, visible.map((c) => c.id));

  await db.activityLog
    .create({
      data: {
        userId: session.user.id,
        action: "team.creators_set",
        entityType: "User",
        entityId: memberId,
        metadata: { added: result.added, removed: result.removed },
      },
    })
    .catch(() => {});
  return NextResponse.json({ ...result, assigned: await creatorsFor(memberId) });
}
