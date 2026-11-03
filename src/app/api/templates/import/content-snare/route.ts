import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { ContentSnareError, listTemplates, looksLikeToken, readTemplate, toTemplate } from "@/lib/content-snare";

/**
 * Templates > Import from Content Snare.
 * POST { token, action: "list" }                    -> { templates: [{ id, name, description }] }
 * POST { token, action: "import", template }        -> { id, name, fields, examples, notes }
 * The token (cs_pat_...) is used for this call only: never stored or logged.
 * Imported templates start switched off, to look over before use.
 */

export const maxDuration = 300;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), token: z.string().max(500) }),
  z.object({
    action: z.literal("import"),
    token: z.string().max(500),
    template: z.object({ id: z.string().min(1).max(100), name: z.string().max(300), description: z.string().max(5000) }),
  }),
]);

export async function POST(req: NextRequest) {
  const gate = await requireAccess("templates.create");
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  const { token } = parsed.data;
  if (!looksLikeToken(token)) return NextResponse.json({ error: "That isn't a Content Snare token: it starts with cs_pat_." }, { status: 400 });

  try {
    if (parsed.data.action === "list") {
      return NextResponse.json({ templates: await listTemplates(token) });
    }

    const t = parsed.data.template;
    const contents = await readTemplate(token, t.id);
    const made = await toTemplate(gate.session.user.agencyId, t, contents);
    if (!made.fields.length) return NextResponse.json({ error: "This template has no fields a creator fills in." }, { status: 422 });
    const name = t.name.trim() || "Imported template";
    const template = await db.requestTemplate.create({
      data: {
        agencyId: gate.session.user.agencyId,
        name,
        description: made.description || null,
        richContent: Prisma.DbNull,
        fields: JSON.stringify(made.fields),
        defaultDueDays: 7,
        defaultUrgency: "NORMAL",
        isActive: false,
        messaging: Prisma.DbNull,
      },
      select: { id: true },
    });
    await db.activityLog
      .create({
        data: {
          userId: gate.session.user.id,
          action: "template.imported",
          entityType: "RequestTemplate",
          entityId: template.id,
          metadata: { source: "content-snare", fields: made.fields.length },
        },
      })
      .catch(() => {});
    return NextResponse.json({ id: template.id, name, fields: made.fields.length, examples: made.examples, notes: made.notes });
  } catch (e) {
    // 424: Vercel would swap a 5xx for its own page
    if (e instanceof ContentSnareError) return NextResponse.json({ error: e.message }, { status: 424 });
    console.error("[content-snare] import failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The import didn't finish. Try again in a minute." }, { status: 424 });
  }
}
