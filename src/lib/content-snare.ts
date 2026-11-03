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
  /** The choices, when already read (export files) */
  options?: string[];
  /** Shown only depending on other answers (Content Snare logic) */
  conditional?: boolean;
}
export interface SnareSection {
  name?: string;
  conditional?: boolean;
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

// ---------- reading one template from an export file ----------

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const arr = (...vs: unknown[]): Loose[] => (vs.find((v) => Array.isArray(v) && v.length) as Loose[] | undefined)?.map(obj) ?? [];
const str = (...vs: unknown[]): string | undefined => vs.find((v): v is string => typeof v === "string");
const num = (...vs: unknown[]): number | undefined => vs.find((v): v is number => typeof v === "number");
const bool = (...vs: unknown[]): boolean | undefined => vs.find((v): v is boolean => typeof v === "boolean");

/** Content Snare stores some text with HTML entities (choices, names) */
const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

const absolute = (u: string) => (u.startsWith("//") ? `https:${u}` : u.startsWith("/") ? `${BASE}${u}` : u);

/** Example files staff attached to a field (Content Snare keeps them as a pre-filled answer) */
function attachmentsOf(f: Loose): SnareImage[] {
  const out: SnareImage[] = [];
  const add = (a: unknown) => {
    if (typeof a === "string" && /^(https?:)?\/\//.test(a)) return out.push({ url: absolute(a) });
    const o = obj(a);
    const url = str(o.url, o.download_url, o.file_url, o.original_url, o.service_url, o.blob_url, obj(o.file).url, obj(o.image).url);
    if (url) out.push({ url: absolute(url), filename: str(o.filename, o.original_filename, o.name, obj(o.blob).filename) });
  };
  for (const a of arr(f.answers)) {
    add(a.attachment);
    for (const x of arr(a.attachments)) add(x);
  }
  for (const x of arr(f.images, f.images_attributes, f.demo_uploads)) add(x.attachment ?? x);
  return out;
}

function fieldFromExport(f: Loose): SnareField {
  const settings = obj(obj(f.field_configuration).settings ?? f.settings);
  const choices = arr(f.additional_fields_attributes, f.options, f.options_attributes, f.choices, settings.options)
    .sort((a, b) => (num(a.sorting_position) ?? 0) - (num(b.sorting_position) ?? 0))
    .map((o) => decode(str(o.text, o.label, o.name, o.value) ?? ""))
    .filter(Boolean);
  return {
    id: String(f.id ?? ""),
    name: str(f.name, f.label, f.title),
    type: str(f.type, f.field_type, f.kind),
    sub_type: str(f.sub_type, f.subtype),
    instruction_text: str(f.instruction_text, f.instruction, f.instructions, f.description) ?? null,
    show_instruction: bool(f.show_instruction),
    placeholder: str(f.placeholder) ?? null,
    required: !!bool(f.required, f.is_required),
    internal: !!bool(f.internal, f.is_internal),
    min_answer_count: num(f.min_answer_count) ?? null,
    max_answer_count: num(f.max_answer_count) ?? null,
    sorting_position: num(f.sorting_position, f.position),
    images: attachmentsOf(f),
    options: choices,
    conditional: !!f.logic,
  };
}

function pageFromExport(p: Loose): SnarePage {
  return {
    id: String(p.id ?? ""),
    name: str(p.name, p.title),
    instruction_text: str(p.instruction_text, p.instruction, p.description) ?? null,
    show_instruction: bool(p.show_instruction),
    sorting_position: num(p.sorting_position, p.position),
    sections: arr(p.sections_attributes, p.sections).map((s) => ({
      name: str(s.name, s.title),
      instruction_text: str(s.instruction_text, s.instruction, s.description) ?? null,
      show_instruction: bool(s.show_instruction),
      sorting_position: num(s.sorting_position, s.position),
      conditional: !!s.logic,
      fields: arr(s.fields_attributes, s.fields).map(fieldFromExport),
    })),
  };
}

/**
 * One template from the export script's file: { template (form_templates/<id>),
 * pages (tabs/<id>, when loaded) }. Content Snare keeps the pages under
 * template.content.tabs_attributes, each with sections_attributes and fields_attributes.
 */
export function contentsFromExport(raw: unknown): SnareContents {
  const r = obj(raw);
  const template = obj(r.template);
  const content = obj(template.content);
  const listed = arr(content.tabs_attributes, template.tabs_attributes, content.tabs, template.tabs, template.pages);
  const loaded = arr(r.pages);
  // A page loaded on its own may carry more (example files); the template's copy has the rest
  const pages = (listed.length ? listed : loaded).map((p) => {
    const more = loaded.find((l) => String(l.id) === String(p.id)) ?? {};
    return pageFromExport({ ...p, ...more, sections_attributes: arr(more.sections_attributes, p.sections_attributes, more.sections, p.sections) });
  });
  const intro = Object.keys(content).length ? content : template;
  return {
    instruction: bool(intro.show_instruction) === false ? null : str(intro.instruction_text, intro.instruction) ?? null,
    pages: pages.sort(bySort),
  };
}

// ---------- turning it into a CCM template ----------

const clean = (html: string | null | undefined) =>
  html
    ? DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ["p", "br", "b", "i", "u", "em", "strong", "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr", "s", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      })
        .replace(/<h5>\s*(<br\s*\/?>)?\s*<\/h5>/g, "")
        .trim()
    : "";
const hasText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Videos embedded in instructions (iframes are dropped from the text, so keep their links) */
function embeddedVideos(html: string | null | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => absolute(m[1])).filter((u) => /^https:\/\//.test(u));
}

/** Pictures embedded in instructions (images are dropped from the text, so they become examples) */
function embeddedImages(html: string | null | undefined): SnareImage[] {
  if (!html) return [];
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => ({ url: absolute(m[1].replace(/&amp;/g, "&")) })).filter((i) => /^https?:\/\//.test(i.url!));
}

type FieldType = TemplateField["type"];

function optionsOf(f: SnareField): string[] {
  if (f.options?.length) return f.options;
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
export function mapFieldType(f: SnareField, label = f.name?.trim() || "a field"): { type: FieldType; note?: string } {
  const kind = (f.type ?? "").toLowerCase();
  const sub = (f.sub_type ?? "").toLowerCase();
  const name = label;
  // Content Snare's own kinds (Fields::Text, ::File, ::Option, ::Numerical, ::Table, ::Custom)
  if (kind === "fields::file") {
    return sub === "signature" ? { type: "file", note: `"${name}" was a signature: here they upload a photo of it.` } : { type: "file" };
  }
  if (kind === "fields::option") {
    const n = optionsOf(f).length;
    if (sub === "task list") return { type: "textarea", note: `"${name}" was a task list: here it's a long text answer.` };
    if (n <= 1) return { type: "checkbox" }; // one choice ("I've read this") is a tick box
    if (sub === "checkbox") return { type: "select", note: `"${name}" allowed several choices: here they pick one.` };
    return { type: "select" };
  }
  if (kind === "fields::numerical") {
    if (sub.includes("date")) return { type: "date" };
    if (sub === "phone") return { type: "text" };
    return { type: "number" };
  }
  if (kind === "fields::table") return { type: "textarea", note: `"${name}" was a table: here it's a long text answer.` };
  if (kind === "fields::custom") {
    if (sub.includes("date")) return { type: "text", note: `"${name}" was a date range: here they type it.` };
    return { type: "textarea", note: `"${name}" was a Content Snare ${sub || "custom"} check, which CCM doesn't do: here it's a long text answer.` };
  }
  if (kind === "fields::text") {
    return ["textarea", "wysiwyg", "address"].includes(sub) ? { type: "textarea" } : { type: "text" };
  }
  // Anything else: go by the words in its kind
  const words = `${kind} ${sub}`;
  if (/file|image|upload|document|video|media|photo|gallery|attachment/.test(words)) return { type: "file" };
  if (/signature/.test(words)) return { type: "file", note: `"${name}" was a signature: here they upload a photo of it.` };
  if (/table|grid|repeater/.test(words)) return { type: "textarea", note: `"${name}" was a table: here it's a long text answer.` };
  if (/accept|agree|consent|terms|boolean|yes_?no|toggle/.test(words)) return { type: "checkbox" };
  if (/checkbox|multi/.test(words)) {
    return optionsOf(f).length > 1 ? { type: "select", note: `"${name}" allowed several choices: here they pick one.` } : { type: "checkbox" };
  }
  if (/radio|choice|dropdown|select|option/.test(words)) return { type: "select" };
  if (/date|calendar/.test(words)) return { type: "date" };
  if (/phone/.test(words)) return { type: "text" };
  if (/number|numeric|integer|currency|decimal/.test(words)) return { type: "number" };
  if (/textarea|long|paragraph|rich|area|multiline|wysiwyg|address/.test(words)) return { type: "textarea" };
  if (/text|string|email|url|link|name|short/.test(words)) return { type: "text" };
  return { type: "textarea", note: `"${name}" was a Content Snare "${f.type ?? "unknown"}" field: here it's a long text answer.` };
}

const newId = (i: number) => `field_${Date.now()}_${i}_${crypto.randomBytes(4).toString("hex")}`;
const MAX_EXAMPLES_PER_TEMPLATE = 60;

/** Copy an example file into the portal's own storage (Content Snare's links can expire) */
async function rehost(agencyId: string, img: SnareImage): Promise<{ url: string; kind: "image" | "video" | "file"; name: string } | null> {
  const src = img.url || img.image?.url;
  if (!src) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_EXAMPLE_BYTES || bytes.byteLength < 16) return null;
    const type = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const name = decodeURIComponent(img.filename || src.split("?")[0].split("/").pop() || "example").replace(/[^a-zA-Z0-9.-]/g, "_").slice(-80);
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

/**
 * The CCM template for these contents. Fields stay in order. Page instructions
 * go in the note (as headings when there are several pages); a section's
 * instructions and pictures go on its first field, where creators see them.
 */
export async function toTemplate(agencyId: string, t: SnareTemplate, c: SnareContents): Promise<ImportedTemplate> {
  const notes: string[] = [];
  const parts: string[] = [];
  if (t.description.trim()) parts.push(`<p>${esc(t.description.trim())}</p>`);
  const intro = clean(c.instruction);
  if (hasText(intro)) parts.push(intro);

  // A name used in several sections ("Reel 1", "Reel 2" each with "5 minute footage") gets its section in front
  const nameCount = new Map<string, number>();
  for (const page of c.pages)
    for (const section of page.sections ?? [])
      for (const f of section.fields ?? []) {
        const n = decode(f.name ?? "").toLowerCase();
        if (n && !f.internal) nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
      }

  const copied = new Map<string, Awaited<ReturnType<typeof rehost>>>();
  let examplesLeft = MAX_EXAMPLES_PER_TEMPLATE;
  const keep = async (img: SnareImage) => {
    const src = img.url || img.image?.url || "";
    if (!copied.has(src)) {
      if (examplesLeft <= 0) return null;
      examplesLeft--;
      copied.set(src, await rehost(agencyId, img));
    }
    return copied.get(src) ?? null;
  };

  const fields: TemplateField[] = [];
  let examples = 0;
  let conditional = false;
  let failedCopies = 0;
  const multiPage = c.pages.length > 1;
  for (const page of c.pages) {
    const sections = [...(page.sections ?? [])].sort(bySort);
    const pageText = page.show_instruction === false ? "" : clean(page.instruction_text);
    if (multiPage) parts.push(`<h3>${esc(decode(page.name ?? "") || "Page")}</h3>${hasText(pageText) ? pageText : ""}`);
    else if (hasText(pageText)) parts.push(pageText);
    let pageImages = page.show_instruction === false ? [] : embeddedImages(page.instruction_text);

    for (const section of sections) {
      if (section.conditional) conditional = true;
      const sectionName = decode(section.name ?? "");
      const sectionShown = section.show_instruction !== false;
      let sectionText = sectionShown ? clean(section.instruction_text) : "";
      let sectionImages = [...pageImages, ...(sectionShown ? embeddedImages(section.instruction_text) : [])];
      let sectionVideos = sectionShown ? embeddedVideos(section.instruction_text) : [];
      pageImages = [];
      const sectionFields = [...(section.fields ?? [])].sort(bySort).filter((f) => !f.internal);
      let carried: { files: SnareImage[]; text: string } | null = null;

      for (const [i, f] of sectionFields.entries()) {
        if (f.conditional) conditional = true;
        const own = decode(f.name ?? "");
        const options = optionsOf(f);
        const label =
          (own && sectionName && sectionName.toLowerCase() !== own.toLowerCase() && (nameCount.get(own.toLowerCase()) ?? 0) > 1
            ? `${sectionName} · ${own}`
            : own) ||
          (f.type?.toLowerCase() === "fields::option" && options.length === 1 ? options[0] : "") ||
          (sectionFields.length === 1 ? sectionName : sectionName ? `${sectionName} ${i + 1}` : "") ||
          `Field ${fields.length + 1}`;
        const fieldShown = f.show_instruction !== false;
        const text = fieldShown ? clean(f.instruction_text) : "";

        // An upload field staff pre-filled with an example ("Video Movement To Recreate"),
        // followed by the upload the creator does: its example goes on that upload instead
        const isUpload = (g: SnareField) => (g.type ?? "").toLowerCase() === "fields::file";
        if (isUpload(f) && (f.images?.length ?? 0) > 0 && sectionFields.slice(i + 1).some(isUpload)) {
          carried = { files: [...(carried?.files ?? []), ...(f.images ?? [])], text: `${carried?.text ?? ""}${hasText(text) ? text : ""}` };
          notes.push(`"${label}" held an example: it's now the example on the upload after it.`);
          continue;
        }

        const { type, note } = mapFieldType(f, label);
        if (note) notes.push(note);

        const rc: RichContent = {};
        // The section's instructions lead its first field
        const lead = hasText(sectionText) ? `${sectionName ? `<p><strong>${esc(sectionName)}</strong></p>` : ""}${sectionText}` : "";
        const description = [lead, carried?.text ?? "", hasText(text) ? text : ""].filter(Boolean).join("");
        if (description) rc.description = description;
        sectionText = "";

        const videos = [...sectionVideos, ...(fieldShown ? embeddedVideos(f.instruction_text) : [])];
        sectionVideos = [];
        if (videos[0]) rc.exampleVideoUrl = videos[0];
        const links = videos.slice(1).map((url, n) => ({ label: `Video ${n + 2}`, url }));
        examples += videos.length;

        const files = [...sectionImages, ...(carried?.files ?? []), ...(fieldShown ? embeddedImages(f.instruction_text) : []), ...(f.images ?? [])];
        sectionImages = [];
        carried = null;
        for (const img of files) {
          const kept = await keep(img);
          if (!kept) {
            failedCopies++;
            continue;
          }
          examples++;
          if (kept.kind === "image") (rc.exampleImages ??= []).push({ url: kept.url });
          else if (kept.kind === "video" && !rc.exampleVideoUrl) rc.exampleVideoUrl = kept.url;
          else links.push({ label: kept.name, url: kept.url });
        }
        if (links.length) rc.referenceLinks = links;

        // A one-choice question is a tick box: its choice is what they tick
        const helpText = type === "checkbox" && options.length === 1 && options[0] !== label ? options[0] : undefined;
        const selectOptions = type === "select" ? options : [];
        if (type === "select" && !selectOptions.length) notes.push(`"${label}" had choices that couldn't be read: add them in the editor.`);
        const isImageField = (f.sub_type ?? "").toLowerCase() === "image";
        const field: TemplateField = {
          id: newId(fields.length),
          type,
          label: label.slice(0, 200),
          required: !!f.required,
          ...(helpText ? { helpText: helpText.slice(0, 500) } : {}),
          ...(f.placeholder?.trim() && type !== "file" ? { placeholder: decode(f.placeholder).slice(0, 200) } : {}),
          ...(Object.keys(rc).length ? { richContent: rc } : {}),
          ...(selectOptions.length ? { options: selectOptions.map((o, n) => ({ id: `opt_${n}_${crypto.randomBytes(3).toString("hex")}`, label: o, value: o })) } : {}),
          ...(type === "file"
            ? {
                ...(isImageField ? { acceptedFileTypes: ["image/*"] } : {}),
                ...(f.max_answer_count && f.max_answer_count > 0 ? { maxFiles: f.max_answer_count } : {}),
                ...(f.min_answer_count && f.min_answer_count > 1 ? { minFiles: f.min_answer_count } : {}),
              }
            : {}),
        };
        fields.push(field);
      }
    }
  }
  if (multiPage) notes.unshift("Content Snare's pages are headings in the note; each section's instructions are on its first field.");
  if (conditional) notes.push("Some questions only showed in Content Snare depending on earlier answers: here every question shows.");
  if (failedCopies) notes.push(`${failedCopies} example ${failedCopies === 1 ? "picture or file" : "pictures or files"} couldn't be copied over.`);
  if (examplesLeft <= 0) notes.push(`Only the first ${MAX_EXAMPLES_PER_TEMPLATE} example files were copied.`);
  // Content Snare fill-ins ({{client_first_name}}) would show to creators as typed
  const fillIns = new Set([parts.join(""), ...fields.map((f) => `${f.label} ${f.richContent?.description ?? ""} ${f.placeholder ?? ""}`)].join(" ").match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []);
  if (fillIns.size) notes.push(`Content Snare fill-ins (${[...fillIns].slice(0, 3).join(", ")}) came over as typed: creators would see them, so reword those bits.`);
  return { description: parts.join(""), fields, notes: [...new Set(notes)], examples };
}
