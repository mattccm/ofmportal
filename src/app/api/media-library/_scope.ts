import { db } from "@/lib/db";
import { creatorWhere, type Access } from "@/lib/access/server";

/**
 * Media items and folders this person may see: their agency's, and only for
 * creators inside their creator scope (media rows carry a creatorId but no
 * relation, so the scope is resolved to ids here).
 */
export async function mediaScope(access: Access): Promise<{ agencyId: string; creatorId?: { in: string[] } }> {
  if (access.creatorScope.type === "all") return { agencyId: access.agencyId };
  const ids = await db.creator.findMany({ where: creatorWhere(access), select: { id: true } });
  return { agencyId: access.agencyId, creatorId: { in: ids.map((c) => c.id) } };
}
