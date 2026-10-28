import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { deserializeTemplate } from "@/lib/templates";
import { BRAND } from "@/lib/brand";
import { TemplatePreviewClient, type PreviewTemplate } from "./template-preview-client";

// Generic like every request page: template names can be explicit
export const metadata: Metadata = {
  title: { absolute: `Preview · ${BRAND.productName}` },
  robots: { index: false, follow: false },
};

/**
 * "Preview as creator": a template's request exactly as a creator's portal
 * shows it, fully interactive, with nothing sent or uploaded. Framed by the
 * template editor (same origin only, see next.config.ts) or opened on its own.
 * `?draft=1` waits for the editor to post its unsaved template.
 */
export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const access = await getPageAccess();
  if (!access.has("templates.view")) return <NoAccess what="templates" roleName={access.role.name} />;
  const [{ id }, { draft }] = await Promise.all([params, searchParams]);

  let saved: PreviewTemplate | null = null;
  if (id !== "new") {
    const row = await db.requestTemplate.findFirst({ where: { id, agencyId: access.agencyId } });
    if (row) {
      const t = deserializeTemplate(row);
      saved = { name: t.name, description: t.description ?? null, richContent: t.richContent ?? null, fields: t.fields, defaultDueDays: t.defaultDueDays };
    }
  }

  return <TemplatePreviewClient saved={saved} waitForDraft={draft === "1"} />;
}
