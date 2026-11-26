import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { canSeeCreator, creatorWhere, requireAccess } from "@/lib/access/server";
import { ContentSnareError } from "@/lib/content-snare";
import { IMPORT_ACTION, copyFile, planRequest, type PlannedCopy } from "@/lib/content-snare-requests";
import { parseDueInput } from "@/lib/due";
import { staffTimeZone } from "@/lib/due-server";
import { invalidateCache } from "@/lib/cache";

/**
 * Requests > Import from Content Snare (the requests export file, made by the
 * script in lib/content-snare-export-script.ts).
 * POST { action: "match", emails, ids }   -> { creators: [{ id, name }], matches: { email: creatorId }, imported: { snareId: requestId } }
 *   which creators the file's clients are, and which requests came over before
 * POST { action: "request", creatorId, entry } -> { id, title, fields, copies, notes }
 *   makes the request (no message to the creator, no reminders); its files come next
 * POST { action: "file", requestId, copy }     -> { bytes }
 *   copies one file over (a large video can take a while)
 */

export const maxDuration = 300;

const copySchema = z.object({
  kind: z.enum(["example", "upload"]),
  fieldId: z.string().min(1).max(200),
  url: z.string().url().max(4000),
  name: z.string().max(500),
  contentType: z.string().max(200),
  size: z.number().nonnegative(),
  review: z.enum(["approved", "sent", "sentBack", "notSent"]).optional(),
  uploadedAt: z.string().max(100).optional(),
  feedback: z.string().max(5000).optional(),
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("match"), emails: z.array(z.string().max(320)).max(500), ids: z.array(z.string().max(50)).max(5000) }),
  z.object({ action: z.literal("request"), creatorId: z.string().min(1).max(100), entry: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("file"), requestId: z.string().min(1).max(100), copy: copySchema }),
]);

export async function POST(req: NextRequest) {
  const gate = await requireAccess("requests.create");
  if (gate.error) return gate.error;
  const { access, session } = gate;
  const agencyId = session.user.agencyId;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  const data = parsed.data;

  try {
    if (data.action === "match") {
      const creators = await db.creator.findMany({
        where: { ...creatorWhere(access), archivedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      const byEmail = new Map(creators.map((c) => [c.email.trim().toLowerCase(), c.id]));
      const matches: Record<string, string> = {};
      for (const e of data.emails) {
        const id = byEmail.get(e.trim().toLowerCase());
        if (id) matches[e] = id;
      }
      // Requests brought over before (and still there)
      const logs = data.ids.length
        ? await db.activityLog.findMany({
            where: { action: IMPORT_ACTION, entityType: "ContentRequest", user: { agencyId }, OR: data.ids.map((id) => ({ metadata: { path: ["contentSnareId"], equals: id } })) },
            select: { entityId: true, metadata: true },
          })
        : [];
      const alive = new Set(
        (await db.contentRequest.findMany({ where: { agencyId, id: { in: logs.map((l) => l.entityId) } }, select: { id: true } })).map((r) => r.id)
      );
      const imported: Record<string, string> = {};
      for (const l of logs) {
        const snareId = String((l.metadata as Record<string, unknown>)?.contentSnareId ?? "");
        if (snareId && alive.has(l.entityId)) imported[snareId] = l.entityId;
      }
      return NextResponse.json({ creators: creators.map((c) => ({ id: c.id, name: c.name })), matches, imported });
    }

    if (data.action === "request") {
      if (!(await canSeeCreator(access, data.creatorId))) return NextResponse.json({ error: "You can't make requests for that creator." }, { status: 403 });
      const creator = await db.creator.findFirst({ where: { id: data.creatorId, agencyId, archivedAt: null }, select: { id: true, timezone: true } });
      if (!creator) return NextResponse.json({ error: "That creator isn't in CCM any more." }, { status: 404 });
      const plan = await planRequest(agencyId, data.entry);
      if (!plan.fields.length) return NextResponse.json({ error: "This request has no questions a creator answers." }, { status: 422 });
      const due = plan.due ? parseDueInput(plan.due, creator.timezone, await staffTimeZone(session.user.id)) : null;
      const made = await db.contentRequest.create({
        data: {
          agencyId,
          creatorId: creator.id,
          title: plan.title,
          description: plan.description || null,
          fields: plan.fields as unknown as Prisma.InputJsonValue,
          dueOn: due?.dueOn ?? null,
          dueDate: due?.dueDate ?? null,
          urgency: "NORMAL",
          status: plan.status,
          messaging: Prisma.DbNull,
          ...(plan.sentAt ? { createdAt: new Date(plan.sentAt) } : {}),
        },
        select: { id: true },
      });
      await db.activityLog
        .create({
          data: {
            userId: session.user.id,
            action: IMPORT_ACTION,
            entityType: "ContentRequest",
            entityId: made.id,
            metadata: { source: "content-snare", contentSnareId: plan.contentSnareId, files: plan.copies.length },
          },
        })
        .catch(() => {});
      invalidateCache.request(made.id, agencyId);
      return NextResponse.json({ id: made.id, title: plan.title, fields: plan.fields.length, copies: plan.copies, notes: plan.notes });
    }

    // One file
    const request = await db.contentRequest.findFirst({ where: { id: data.requestId, agencyId }, select: { creatorId: true } });
    if (!request || !(await canSeeCreator(access, request.creatorId))) return NextResponse.json({ error: "That request isn't there." }, { status: 404 });
    const bytes = await copyFile({ agencyId, requestId: data.requestId, copy: data.copy as PlannedCopy, canReview: access.has("review.approve") });
    invalidateCache.request(data.requestId, agencyId);
    return NextResponse.json({ bytes });
  } catch (e) {
    // 424: Vercel would swap a 5xx for its own page
    if (e instanceof ContentSnareError) return NextResponse.json({ error: e.message }, { status: 424 });
    console.error("[content-snare] request import failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "That didn't come over. Try again in a minute." }, { status: 424 });
  }
}
