/**
 * Rich text (the WYSIWYG editor's HTML) next to older plain text. Pure: safe
 * in client components. Rendering still goes through sanitizeHtml.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Does this look like editor HTML rather than plain text? */
export function looksLikeHtml(value: string): boolean {
  return /<(p|br|ul|ol|li|strong|em|b|i|u|a|h[1-6]|blockquote|div|span)\b[^>]*>/i.test(value);
}

/** Plain text → paragraphs; a blank line starts a new paragraph, a single newline is a line break */
export function plainToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Editor HTML as is; older plain text turned into paragraphs so its line breaks survive */
export function asRichHtml(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  if (!v) return "";
  return looksLikeHtml(v) ? v : plainToHtml(v);
}

/** HTML → readable plain text (for comparisons and plain-text editors) */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Is there anything to show once the tags are gone? (The editor leaves "<p></p>" when emptied) */
export function hasRichText(value: string | null | undefined): boolean {
  if (!value) return false;
  return htmlToPlain(value).length > 0 || /<img\b/i.test(value);
}
