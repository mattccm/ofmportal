import crypto from "crypto";
import DOMPurify from "isomorphic-dompurify";
import type { RichContent, TemplateField } from "./template-types";
import { TEMPLATE_ASSETS_PREFIX, saveTemplateAsset, templateAssetUrl } from "./template-assets";

/**
 * Moving request templates over from Content Snare (Partner API v1, a personal
 * access token cs_pat_... from the person importing; never stored).
 *
 * The API lists templates by name only. The contents (pages, sections,
 * fields, instructions, example images) come with a request, so each import
 * makes a draft request from the template for a placeholder client, reads it
 * and deletes it. Nothing is sent to anyone. Server only.
 */

const BASE = process.env.CONTENT_SNARE_API_URL || "https://api.contentsnare.com";
const API = `${BASE}/partner_api/v1`;
const PLACEHOLDER_CLIENT = { name: "CCM template import", email: "template-import@of-m.com" };
const MAX_EXAMPLE_BYTES = 50 * 1024 * 1024;

export class ContentSnareError extends Error {}

export const looksLikeToken = (t: unknown): t is string => typeof t === "string" && /^cs_pat_[A-Za-z0-9_-]{10,}$/.test(t.trim());

async function call<T>(token: string, path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}`, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429 && !retried) {
    const wait = Math.min(15, Number(res.headers.get("retry-after")) || 5);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return call(token, path, init, true);
  }
  if (res.status === 401) throw new ContentSnareError("Content Snare didn't accept the token. It may have expired or been revoked: make a new one.");
  if (res.status === 403)
    throw new ContentSnareError("The token is missing a permission. It needs Read templates, Read requests and Write requests (to make and delete the draft).");
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const said = Array.isArray(body?.errors) ? body.errors.join(" ") : "";
    throw new ContentSnareError(`Content Snare said no (${res.status})${said ? `: ${said}` : ""}.`);
  }
  return (await res.json()) as T;
}

// ---------- listing ----------

export interface SnareTemplate {
  id: string;
  name: string;
  description: string;
}

export async function listTemplates(token: string): Promise<SnareTemplate[]> {
  const all: SnareTemplate[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await call<{ results?: SnareTemplate[]; pagination?: { total_count?: number } }>(token, `/request_templates?limit=100&offset=${offset}`);
    const results = page.results ?? [];
    all.push(...results.map((t) => ({ id: String(t.id), name: t.name || "Untitled", description: t.description || "" })));
    if (results.length < 100 || all.length >= (page.pagination?.total_count ?? Infinity)) break;
  }
  return all;
}

// ---------- reading one template (through a draft request) ----------

interface SnareImage {
  filename?: string;
  url?: string;
  image?: { url?: string };
}
export interface SnareField {
  id?: string;
  name?: string;
  type?: string;
  sub_type?: string;
  instruction_text?: string | null;
  show_instruction?: boolean;
  placeholder?: string | null;
  required?: boolean;
  internal?: boolean;
  min_answer_count?: number | null;
  max_answer_count?: number | null;
  images?: SnareImage[];
  field_configuration?: { settings?: Record<string, unknown> } | null;
  sorting_position?: number;
}
export interface SnareSection {
  name?: string;
  instruction_text?: string | null;
  show_instruction?: boolean;
  sorting_position?: number;
  fields?: SnareField[];
}
export interface SnarePage {
  id: string;
  name?: string;
  instruction_text?: string | null;
  show_instruction?: boolean;
  sorting_position?: number;
  sections?: SnareSection[];
}
export interface SnareContents {
  instruction: string | null;
  pages: SnarePage[];
}

const bySort = <T extends { sorting_position?: number }>(a: T, b: T) => (a.sorting_position ?? 0) - (b.sorting_position ?? 0);

export async function readTemplate(token: string, templateId: string): Promise<SnareContents> {
  const draft = await call<{ id: string }>(token, "/requests", {
    method: "POST",
    body: JSON.stringify({
      name: "CCM import (deleted automatically)",
      request_template_id: templateId,
      status: "draft",
      client_full_name: PLACEHOLDER_CLIENT.name,
      client_email: PLACEHOLDER_CLIENT.email,
      share_via_link_enabled: false,
    }),
  });
  try {
    // Content Snare builds the pages after creating the request
    let request: { build_status?: string; instruction_text?: string | null; show_instruction?: boolean; pages?: { id: string }[] } | null = null;
    for (let i = 0; i < 20; i++) {
      request = await call(token, `/requests/${draft.id}`);
      if (request?.build_status !== "building") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!request || request.build_status === "failed") throw new ContentSnareError("Content Snare couldn't build this template's pages.");
    if (request.build_status === "building") throw new ContentSnareError("Content Snare is still building this template. Try it again in a minute.");
    const pages: SnarePage[] = [];
    for (const p of request.pages ?? []) {
      pages.push(await call<SnarePage>(token, `/pages/${p.id}?include_internal_fields=false`));
    }
    return { instruction: request.show_instruction === false ? null : request.instruction_text ?? null, pages: pages.sort(bySort) };
  } finally {
    await call(token, `/requests/${draft.id}`, { method: "DELETE" }).catch((e) => console.warn("[content-snare] draft not deleted:", draft.id, e?.message));
  }
}

// ---------- turning it into a CCM template ----------

const clean = (html: string | null | undefined) =>
  html
    ? DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ["p", "br", "b", "i", "u", "em", "strong", "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr", "s"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      }).trim()
    : "";
const hasText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Videos embedded in instructions (iframes are dropped from the text, so keep their links) */
function embeddedVideos(html: string | null | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https:\/\//.test(u));
}

type FieldType = TemplateField["type"];

function optionsOf(f: SnareField): string[] {
  const s = f.field_configuration?.settings ?? {};
  for (const key of ["options", "choices", "items", "values", "answers"]) {
    const v = (s as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      const labels = v
        .map((o) => (typeof o === "string" ? o : o && typeof o === "object" ? String((o as Record<string, unknown>).label ?? (o as Record<string, unknown>).name ?? (o as Record<string, unknown>).value ?? "") : ""))
        .map((x) => x.trim())
        .filter(Boolean);
      if (labels.length) return labels;
    }
  }
  return [];
}

/** Content Snare's field kind -> CCM's, plus a note when something doesn't carry over exactly */
export function mapFieldType(f: SnareField): { type: FieldType; note?: string } {
  const kind = `${f.type ?? ""} ${f.sub_type ?? ""}`.toLowerCase();
  const name = f.name?.trim() || "a field";
  if (/file|image|upload|document|video|media|photo|gallery|attachment/.test(kind)) return { type: "file" };
  if (/signature/.test(kind)) return { type: "file", note: `"${name}" was a signature: here they upload a photo of it.` };
  if (/table|grid|repeater/.test(kind)) return { type: "textarea", note: `"${name}" was a table: here it's a long text answer.` };
  if (/accept|agree|consent|terms|boolean|yes_?no|toggle/.test(kind)) return { type: "checkbox" };
  if (/checkbox|multi/.test(kind)) {
    return optionsOf(f).length > 1
      ? { type: "select", note: `"${name}" allowed several choices: here they pick one.` }
      : { type: "checkbox" };
  }
  if (/radio|choice|dropdown|select|option/.test(kind)) return { type: "select" };
  if (/date|calendar/.test(kind)) return { type: "date" };
  if (/number|numeric|integer|currency|decimal/.test(kind)) return { type: "number" };
  if (/textarea|long|paragraph|rich|area|multiline|wysiwyg/.test(kind)) return { type: "textarea" };
  if (/text|string|email|phone|url|link|name|address|short/.test(kind)) return { type: "text" };
  return { type: "textarea", note: `"${name}" was a Content Snare "${f.type ?? "unknown"}" field: here it's a long text answer.` };
}

const newId = (i: number) => `field_${Date.now()}_${i}_${crypto.randomBytes(4).toString("hex")}`;

/** Copy an example file into the portal's own storage (Content Snare's links expire) */
async function rehost(agencyId: string, img: SnareImage): Promise<{ url: string; kind: "image" | "video" | "file"; name: string } | null> {
  const src = img.url || img.image?.url;
  if (!src) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_EXAMPLE_BYTES || bytes.byteLength < 16) return null;
    const type = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const name = (img.filename || src.split("?")[0].split("/").pop() || "example").replace(/[^a-zA-Z0-9.-]/g, "_").slice(-80);
    const key = `${TEMPLATE_ASSETS_PREFIX}/${agencyId}/content-snare/${crypto.randomBytes(6).toString("hex")}-${name}`;
    await saveTemplateAsset(key, bytes, type);
    return { url: templateAssetUrl(key), kind: type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : "file", name: img.filename || name };
  } catch {
    return null;
  }
}

export interface ImportedTemplate {
  description: string;
  fields: TemplateField[];
  notes: string[];
  examples: number;
}

/** The CCM template for these contents. Pages and sections become headings in the description, fields stay in order. */
export async function toTemplate(agencyId: string, t: SnareTemplate, c: SnareContents): Promise<ImportedTemplate> {
  const notes: string[] = [];
  const parts: string[] = [];
  if (t.description.trim()) parts.push(`<p>${esc(t.description.trim())}</p>`);
  const intro = clean(c.instruction);
  if (hasText(intro)) parts.push(intro);

  const fields: TemplateField[] = [];
  let examples = 0;
  const multiPage = c.pages.length > 1;
  for (const page of c.pages) {
    const sections = [...(page.sections ?? [])].sort(bySort);
    const pageText = page.show_instruction === false ? "" : clean(page.instruction_text);
    if (multiPage || hasText(pageText)) parts.push(`<h3>${esc(page.name?.trim() || "Page")}</h3>${hasText(pageText) ? pageText : ""}`);
    for (const section of sections) {
      const sectionText = section.show_instruction === false ? "" : clean(section.instruction_text);
      if (hasText(sectionText)) parts.push(`<h4>${esc(section.name?.trim() || "Section")}</h4>${sectionText}`);
      for (const f of [...(section.fields ?? [])].sort(bySort)) {
        if (f.internal) continue;
        const { type, note } = mapFieldType(f);
        if (note) notes.push(note);
        const rc: RichContent = {};
        const text = f.show_instruction === false ? "" : clean(f.instruction_text);
        if (hasText(text)) rc.description = text;
        const videos = embeddedVideos(f.instruction_text);
        if (videos[0]) rc.exampleVideoUrl = videos[0];
        const links = videos.slice(1).map((url, i) => ({ label: `Video ${i + 2}`, url }));
        for (const img of f.images ?? []) {
          const kept = await rehost(agencyId, img);
          if (!kept) {
            notes.push(`An example file on "${f.name ?? "a field"}" couldn't be copied over.`);
            continue;
          }
          examples++;
          if (kept.kind === "image") (rc.exampleImages ??= []).push({ url: kept.url });
          else if (kept.kind === "video" && !rc.exampleVideoUrl) rc.exampleVideoUrl = kept.url;
          else links.push({ label: kept.name, url: kept.url });
        }
        if (links.length) rc.referenceLinks = links;
        examples += videos.length;

        const options = type === "select" ? optionsOf(f) : [];
        if (type === "select" && !options.length) notes.push(`"${f.name ?? "a field"}" had choices that couldn't be read: add them in the editor.`);
        const field: TemplateField = {
          id: newId(fields.length),
          type,
          label: (f.name?.trim() || `Field ${fields.length + 1}`).slice(0, 200),
          required: !!f.required,
          ...(f.placeholder?.trim() && type !== "file" ? { placeholder: f.placeholder.trim().slice(0, 200) } : {}),
          ...(Object.keys(rc).length ? { richContent: rc } : {}),
          ...(options.length ? { options: options.map((label, i) => ({ id: `opt_${i}_${crypto.randomBytes(3).toString("hex")}`, label, value: label })) } : {}),
          ...(type === "file"
            ? {
                ...(f.max_answer_count && f.max_answer_count > 0 ? { maxFiles: f.max_answer_count } : {}),
                ...(f.min_answer_count && f.min_answer_count > 0 ? { minFiles: f.min_answer_count } : {}),
              }
            : {}),
        };
        fields.push(field);
      }
    }
  }
  if (c.pages.length > 1 || c.pages.some((p) => (p.sections ?? []).length > 1)) {
    notes.unshift("Content Snare's pages and sections are headings in the description here; the fields keep their order.");
  }
  // Content Snare fill-ins ({{client_first_name}}) would show to creators as typed
  const fillIns = new Set([parts.join(""), ...fields.map((f) => `${f.label} ${f.richContent?.description ?? ""} ${f.placeholder ?? ""}`)].join(" ").match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []);
  if (fillIns.size) notes.push(`Content Snare fill-ins (${[...fillIns].slice(0, 3).join(", ")}) came over as typed: creators would see them, so reword those bits.`);
  return { description: parts.join(""), fields, notes: [...new Set(notes)], examples };
}
