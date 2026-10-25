import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { requireAccess, staffWhere } from "@/lib/access/server";
import { canGrant, changeMemberRole } from "@/lib/access/assign";
import { BUILT_IN_FOR_ENUM } from "@/lib/access/catalogue";
import { loadRoles, roleIdOf } from "@/lib/access/roles";

/**
 * One teammate.
 *   PATCH { roleId }  move them to a role ("owner", "admin", "manager",
 *                     "member" or a custom role id); { role: "ADMIN" } still
 *                     works. Needs "team.changeRoles"; see lib/access/assign.ts.
 *   DELETE            remove them. Needs "team.remove".
 */

const patchSchema = z
  .object({ roleId: z.string().min(1).optional(), role: z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER"]).optional() })
  .refine((d) => d.roleId || d.role, { message: "Choose a role" });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const gate = await requireAccess("team.changeRoles");
    if (gate.error) return gate.error;
    const { memberId } = await params;

    const body = await parseJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Choose a role" }, { status: 400 });
    const roleId = parsed.data.roleId ?? BUILT_IN_FOR_ENUM[parsed.data.role!];

    const result = await changeMemberRole(gate.access, memberId, roleId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, member: result.member, role: { id: result.next.id, name: result.next.name } });
  } catch (error) {
    console.error("Error updating team member:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const gate = await requireAccess("team.remove");
    if (gate.error) return gate.error;
    const { access, session } = gate;
    const { memberId } = await params;

    const member = await db.user.findFirst({
      where: { AND: [staffWhere(access), { id: memberId }] },
      select: { id: true, role: true, customRoleId: true, name: true, email: true },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (member.id === access.userId) {
      return NextResponse.json({ error: "You cannot remove yourself from the team" }, { status: 400 });
    }
    if (member.role === "OWNER") {
      if (!access.isOwner) return NextResponse.json({ error: "Only an owner can remove an owner" }, { status: 403 });
      const owners = await db.user.count({ where: { agencyId: access.agencyId, role: "OWNER" } });
      if (owners <= 1) return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
    }
    if (!access.isOwner) {
      const roles = await loadRoles(access.agencyId);
      const presetRowIds = Object.fromEntries(roles.filter((r) => r.kind === "preset" && r.dbId).map((r) => [r.dbId!, r.preset!]));
      const current = roles.find((r) => r.id === roleIdOf(member, presetRowIds));
      if (current?.keys.includes("roles.manage")) {
        return NextResponse.json({ error: "Only an owner can remove someone who manages roles" }, { status: 403 });
      }
      if (current && !canGrant(access, current)) {
        return NextResponse.json({ error: `${member.name} has more access than you, so you can't remove them` }, { status: 403 });
      }
    }

    await db.user.delete({ where: { id: memberId } });

    await db.activityLog.create({
      data: {
        userId: access.userId,
        action: "team.member_removed",
        entityType: "User",
        entityId: memberId,
        metadata: {
          removedMemberName: member.name,
          removedMemberEmail: member.email,
          removedMemberRole: member.role,
          removedBy: session.user.name,
        },
      },
    });

    return NextResponse.json({ success: true, message: "Team member removed successfully" });
  } catch (error) {
    console.error("Error removing team member:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
  }
}
