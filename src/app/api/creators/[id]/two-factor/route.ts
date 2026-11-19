import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess } from "@/lib/access/server";

/**
 * DELETE: turn off a creator's two-step sign-in (they lost their phone and
 * their backup codes). They sign in with their password again and can turn
 * it back on in their Settings. Needs "reset access" for that creator.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAccess("creators.resetAccess");
  if (gate.error) return gate.error;
  const { id } = await params;
  const creator = await db.creator.findFirst({ where: { AND: [creatorWhere(gate.access), { id }] }, select: { id: true, twoFactorEnabled: true } });
  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  if (creator.twoFactorEnabled) {
    await db.creator.update({ where: { id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] } });
    await db.activityLog
      .create({ data: { userId: gate.session.user.id, action: "creator.two_factor_off", entityType: "Creator", entityId: id, metadata: {} } })
      .catch(() => {});
  }
  return NextResponse.json({ enabled: false });
}
