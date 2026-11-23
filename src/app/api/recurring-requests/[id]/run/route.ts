import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { targetsInScope } from "../../scope";
import { executeRecurringRequest, scheduleCreators } from "@/app/api/recurring-requests/execute";
import { resolveTemplateIds } from "@/app/api/recurring-requests/template-ids";

/**
 * Run a recurring request now.
 * GET  -> { creators: [{ id, name, avatar }], templateCount, nextRunAt }
 *   who it would send to, for picking
 * POST { creatorIds? } -> the run's result
 *   without creatorIds: everyone on the schedule (and the schedule moves on);
 *   with some of them: a one-off for those creators, the schedule unchanged
 */

async function loadSchedule(id: string) {
  const gate = await requireAccess("recurring.edit");
  if (gate.error) return { error: gate.error } as const;
  const { session, access } = gate;
  // Out-of-scope schedules answer as missing
  const row = await db.recurringRequest.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: { creatorIds: true, creatorGroupIds: true, templateId: true, templateIds: true, nextRunAt: true, isActive: true },
  });
  if (!row || !(await targetsInScope(access, row))) {
    return { error: NextResponse.json({ error: "Recurring request not found" }, { status: 404 }) } as const;
  }
  return { session, row } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSchedule(id);
  if ("error" in loaded) return loaded.error;
  const creators = await scheduleCreators(loaded.row, loaded.session.user.agencyId);
  return NextResponse.json({
    creators: creators.map((c) => ({ id: c.id, name: c.name, avatar: c.avatar })),
    templateCount: resolveTemplateIds(loaded.row).length,
    nextRunAt: loaded.row.isActive ? loaded.row.nextRunAt : null,
  });
}

const runSchema = z
  .object({ creatorIds: z.array(z.string().min(1).max(100)).min(1, "Pick at least one creator").max(1000).optional() })
  .nullable();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const loaded = await loadSchedule(id);
    if ("error" in loaded) return loaded.error;
    const { session } = loaded;

    // No body (older callers): everyone
    const text = await req.text();
    let raw: unknown = null;
    if (text.trim()) {
      try {
        raw = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
      }
    }
    const parsed = runSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Something was missing. Try again." }, { status: 400 });
    }

    const result = await executeRecurringRequest(id, session.user.agencyId, {
      actorUserId: session.user.id,
      agencyName: session.user.agencyName,
      onlyCreatorIds: parsed.data?.creatorIds,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Error executing recurring request:", error);
    // 424: Vercel would swap a 5xx for its own page
    return NextResponse.json({ error: "Failed to execute recurring request" }, { status: 424 });
  }
}
