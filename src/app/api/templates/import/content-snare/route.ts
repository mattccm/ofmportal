import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access/server";
import { ContentSnareError, contentsFromExport, listTemplates, looksLikeToken, readTemplate, toTemplate, type SnareContents } from "@/lib/content-snare";

/**
 * Templates > Import from Content Snare.
 * POST { action: "file", template, contents }      -> { id, name, fields, examples, notes }
 *   one template from the export script's file (lib/content-snare-export-script.ts)
 * POST { token, action: "list" }                    -> { templates: [{ id, name, description }] }
 * POST { token, action: "import", template }        -> { id, name, fields, examples, notes }
 *   with a Content Snare personal access token (plans that allow them)
 * The token (cs_pat_...) is used for this call only: never stored or logged.
 * Imported templates start switched off, to look over before use.
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
          metadata: { source: data.action === "file" ? "content-snare-file" : "content-snare", fields: made.fields.length },
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
