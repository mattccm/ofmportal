/**
 * A recurring request can send several templates on each run. They are stored
 * as `templateIds` (ordered JSON array); `templateId` stays the first one so
 * older rows and readers keep working. An empty `templateIds` means
 * `[templateId]`.
 */
export function resolveTemplateIds(row: { templateId: string; templateIds?: unknown }): string[] {
  let list: unknown = row.templateIds;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  const ids = Array.isArray(list)
    ? list.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const unique = [...new Set(ids)];
  if (unique.length === 0) return row.templateId ? [row.templateId] : [];
  return unique;
}

/**
 * Normalise the template input of a create/update body: `templateIds` wins
 * when given, else `templateId`. Returns null when neither is present.
 */
export function templateInput(body: {
  templateId?: string | null;
  templateIds?: string[] | null;
}): string[] | null {
  if (body.templateIds && body.templateIds.length > 0) {
    return [...new Set(body.templateIds.filter(Boolean))];
  }
  if (body.templateId) return [body.templateId];
  return null;
}
