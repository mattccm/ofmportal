import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api";
import { requireAccess, toClientAccess } from "@/lib/access/server";
import { changeMemberRole } from "@/lib/access/assign";

/**
 * GET: the signed-in person's own access (any staff member).
 * PUT { userId, roleId }: move a teammate to a role; needs "team.changeRoles".
 * Same rules as PATCH /api/team/[memberId]. Per-person overrides and activity
 * restrictions are gone: give someone a different role instead.
 */

export async function GET() {
  try {
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    return NextResponse.json({ access: toClientAccess(gate.access) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error fetching own access:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load your permissions" }, { status: 500 });
  }
}

const schema = z.object({ userId: z.string().min(1), roleId: z.string().min(1) });

export async function PUT(req: NextRequest) {
  try {
    const gate = await requireAccess("team.changeRoles");
    if (gate.error) return gate.error;
    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "Choose a teammate and a role" }, { status: 400 });
    const result = await changeMemberRole(gate.access, parsed.data.userId, parsed.data.roleId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, member: result.member, role: { id: result.next.id, name: result.next.name } });
  } catch (error) {
    console.error("Error changing role:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to change the role" }, { status: 500 });
  }
}
