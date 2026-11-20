import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { ContentSnareError, contentsFromExport, listTemplates, looksLikeToken, readTemplate, toTemplate, type SnareContents } from "@/lib/content-snare";
import { validateTemplateFields, type TemplateField } from "@/lib/templates";

/**
 * Templates > Import from Content Snare.
 * POST { action: "file", template, contents }      -> { id, name, fields, examples, notes }
 *   one template from the export script's file (lib/content-snare-export-script.ts)
 * POST { token, action: "list" }                    -> { templates: [{ id, name, description }] }
 * POST { token, action: "import", template }        -> { id, name, fields, examples, notes }
 *   with a Content Snare personal access token (plans that allow them)
 * The token (cs_pat_...) is used for this call only: never stored or logged.
 * Imported templates are switched on, ready to send (switched off, with the
 * reason, only if the template editor's own checks would refuse them).
 */

export const maxDuration = 300;

const templateRef = z.object({ id: z.string().min(1).max(100), name: z.string().max(300), description: z.string().max(5000) });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), token: z.string().max(500) }),
  z.object({ action: z.literal("import"), token: z.string().max(500), template: templateRef }),
  z.object({ action: z.literal("file"), template: templateRef, contents: z.unknown() }),
]);

export async function POST(req: NextRequest) {
  const gate = await requireAccess("templates.create");
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  const data = parsed.data;
  if (data.action !== "file" && !looksLikeToken(data.token)) {
    return NextResponse.json({ error: "That isn't a Content Snare token: it starts with cs_pat_." }, { status: 400 });
  }

  try {
    if (data.action === "list") {
      return NextResponse.json({ templates: await listTemplates(data.token) });
    }

    const t = data.template;
    const contents: SnareContents = data.action === "file" ? contentsFromExport(data.contents) : await readTemplate(data.token, t.id);
    const made = await toTemplate(gate.session.user.agencyId, t, contents);
    if (!made.fields.length) {
      return NextResponse.json(
        {
          error:
            data.action === "file" && !contents.pages.length
              ? "No pages were found for this template in the file. Send the file to whoever set up the import."
              : "This template has no fields a creator fills in.",
        },
        { status: 422 }
      );
    }
    const name = t.name.trim() || "Imported template";
    // Two fields with the same name in one section: number them, as the template editor needs unique names
    const seen = new Map<string, number>();
    for (const f of made.fields) {
      const key = f.label.trim().toLowerCase();
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > 1) f.label = `${f.label} ${n}`;
    }
    // Switched on, unless it wouldn't pass the checks a template needs to be switched on
    const problems = validateTemplateFields(made.fields as unknown as TemplateField[]);
    if (problems.length) made.notes.push(`Switched off: ${problems[0].message}. Fix it in the editor, then switch it on.`);
    const template = await db.requestTemplate.create({
      data: {
        agencyId: gate.session.user.agencyId,
        name,
        description: made.description || null,
        richContent: Prisma.DbNull,
        fields: JSON.stringify(made.fields),
        defaultDueDays: 7,
        defaultUrgency: "NORMAL",
        isActive: problems.length === 0,
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
          metadata: { source: data.action === "file" ? "content-snare-file" : "content-snare", fields: made.fields.length },
        },
      })
      .catch(() => {});
    return NextResponse.json({ id: template.id, name, fields: made.fields.length, examples: made.examples, notes: made.notes, on: problems.length === 0 });
  } catch (e) {
    // 424: Vercel would swap a 5xx for its own page
    if (e instanceof ContentSnareError) return NextResponse.json({ error: e.message }, { status: 424 });
    console.error("[content-snare] import failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The import didn't finish. Try again in a minute." }, { status: 424 });
  }
}
