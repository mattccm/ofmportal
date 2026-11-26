import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ContentSnareError, pageFromExport, toTemplate, type SnareImage, type SnarePage } from "./content-snare";
import { requestFieldsFromTemplate, type RequestFieldFromTemplate } from "./template-request";
import { TEMPLATE_ASSETS_PREFIX, templateAssetUrl } from "./template-assets";
import { MAX_FILE_SIZE, generateStorageKey, streamToStorage } from "./storage";

/**
 * Bringing clients' open requests over from Content Snare, from the requests
 * export file (lib/content-snare-export-script.ts). Server only.
 *
 * Each request becomes a CCM request with the same questions, made the way a
 * template import makes a template (toTemplate). Files then come over one at
 * a time (copyFile), as some are large videos:
 *  - example files staff attached to an upload field followed by the upload
 *    the creator does ("Video Movement To Recreate", then "5 minute footage")
 *    become the example on that upload, as in a template import
 *  - what the creator uploaded comes over as their uploads, reviewed as they
 *    were in Content Snare (approved, sent in, or sent back)
 * Content Snare keeps both as a field's answers. An example is attached when
 * the request is made; a creator's upload comes later, so an answer on such a
 * field is an example only when it's no later than EXAMPLE_WINDOW after the
 * request was sent.
 */

const EXAMPLE_WINDOW_MS = 2 * 60 * 60 * 1000;
const PENDING = "content-snare-pending:";

export const IMPORT_ACTION = "request.imported";

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const arr = (v: unknown): Loose[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bySort = (a: Loose, b: Loose) => (num(a.sorting_position) ?? 0) - (num(b.sorting_position) ?? 0);

/** How Content Snare had a creator's upload */
export type Review = "approved" | "sent" | "sentBack" | "notSent";

/** A file to bring over once the request is made */
export interface PlannedCopy {
  kind: "example" | "upload";
  /** The CCM field it belongs to */
  fieldId: string;
  /** Content Snare's link to the file (it forwards to a short-lived download) */
  url: string;
  name: string;
  contentType: string;
  size: number;
  /** Uploads: how it was reviewed, when it was uploaded, why it was sent back */
  review?: Review;
  uploadedAt?: string;
  feedback?: string;
}

export interface PlannedRequest {
  contentSnareId: string;
  /** When Content Snare sent it (ISO), so the request isn't "sent" after it was due */
  sentAt: string | null;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  due: string | null;
  fields: RequestFieldFromTemplate[];
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "NEEDS_REVISION";
  copies: PlannedCopy[];
  notes: string[];
}

const REVIEW: Record<string, Review> = { approve: "approved", complete: "sent", outstanding: "sentBack", not_complete: "notSent" };

const isUpload = (f: Loose) => String(f.type ?? "").toLowerCase() === "fields::file";
const fileOf = (a: Loose) => obj(a.attachment);
const hasFile = (a: Loose) => !!str(fileOf(a).url);
const absolute = (u: string) => new URL(u, process.env.CONTENT_SNARE_API_URL || "https://api.contentsnare.com").toString();
const kindOf = (type: string | undefined): "image" | "video" | "file" =>
  type?.startsWith("image/") ? "image" : type?.startsWith("video/") ? "video" : "file";

/** One request from the export file, as a CCM request plus the files to copy */
export async function planRequest(agencyId: string, entry: unknown): Promise<PlannedRequest> {
  const e = obj(entry);
  const r = Object.keys(obj(e.request)).length ? obj(e.request) : obj(e.listed);
  const id = String(e.id ?? r.id ?? "");
  if (!id) throw new ContentSnareError("This request has no Content Snare id.");
  const sent = Date.parse(str(r.published_at) ?? "");

  // Each field's answers: examples stay on the field (toTemplate moves them on); the creator's go aside
  const theirs = new Map<string, { review: Review; answers: Loose[]; feedback?: string }>();
  const pages: SnarePage[] = arr(e.pages)
    .sort(bySort)
    .map((p) => {
      const sections = arr(p.sections_attributes).map((s) => {
        const fields = arr(s.fields_attributes).sort(bySort);
        return {
          ...s,
          fields_attributes: fields.map((f, i) => {
            const files = arr(f.answers).filter(hasFile);
            if (!files.length) return f;
            const attachedWithRequest = files.every((a) => {
              const at = Date.parse(str(fileOf(a).created_at) ?? "");
              return !Number.isFinite(sent) || !Number.isFinite(at) || at - sent <= EXAMPLE_WINDOW_MS;
            });
            if (isUpload(f) && attachedWithRequest && fields.slice(i + 1).some(isUpload)) return f;
            const feedback = files.map((a) => str(a.rejection_comment)).find(Boolean) ?? str(obj(f.rejection_message).text);
            theirs.set(String(f.id), { review: REVIEW[String(f.status)] ?? "notSent", answers: files, feedback });
            return { ...f, answers: arr(f.answers).filter((a) => !hasFile(a)) };
          }),
        };
      });
      return pageFromExport({ ...p, sections_attributes: sections });
    });

  // Examples are copied later: toTemplate gets a stand-in link for each, swapped out below
  const examples: SnareImage[] = [];
  const keepExample = async (img: SnareImage) => {
    examples.push(img);
    return { url: PENDING + (examples.length - 1), kind: kindOf(img.content_type), name: img.filename || "example" };
  };
  const title = (str(r.name) ?? str(e.name) ?? "").trim() || "Imported request";
  const made = await toTemplate(
    agencyId,
    { id, name: title, description: "" },
    { instruction: r.show_instruction === false ? null : str(r.instruction_text) ?? null, pages },
    keepExample
  );

  const copies: PlannedCopy[] = [];
  // (where on the field each goes is settled when it's copied, by what it turns out to be)
  const pendingCopy = (url: string | undefined, fieldId: string): boolean => {
    if (!url?.startsWith(PENDING)) return false;
    const img = examples[Number(url.slice(PENDING.length))];
    if (img?.url) copies.push({ kind: "example", fieldId, url: absolute(img.url), name: img.filename || "example", contentType: img.content_type || "", size: img.byte_size ?? 0 });
    return true;
  };
  for (const f of made.fields) {
    const rc = f.richContent;
    if (!rc) continue;
    if (pendingCopy(rc.exampleVideoUrl, f.id)) delete rc.exampleVideoUrl;
    rc.exampleImages = rc.exampleImages?.filter((i) => !pendingCopy(i.url, f.id));
    rc.referenceLinks = rc.referenceLinks?.filter((l) => !pendingCopy(l.url, f.id));
    if (!rc.exampleImages?.length) delete rc.exampleImages;
    if (!rc.referenceLinks?.length) delete rc.referenceLinks;
    if (!Object.keys(rc).length) delete f.richContent;
  }

  // Two fields with the same name: numbered, as the editor needs unique names
  const seen = new Map<string, number>();
  for (const f of made.fields) {
    const key = f.label.trim().toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) f.label = `${f.label} ${n}`;
  }

  // The creator's uploads, on the fields they belong to
  const placed = new Set<string>();
  for (const [fieldId, snareId] of Object.entries(made.from)) {
    const t = theirs.get(snareId);
    if (!t) continue;
    placed.add(snareId);
    for (const a of t.answers) {
      const file = fileOf(a);
      copies.push({
        kind: "upload",
        fieldId,
        url: absolute(String(file.url)),
        name: str(file.original_filename) || str(file.filename) || "upload",
        contentType: str(file.content_type) || "",
        size: num(file.byte_size) ?? 0,
        review: t.review,
        uploadedAt: str(file.created_at),
        feedback: t.feedback,
      });
    }
  }

  const reviews = copies.filter((c) => c.kind === "upload").map((c) => c.review);
  const status: PlannedRequest["status"] = reviews.includes("sentBack")
    ? "NEEDS_REVISION"
    : String(r.status) === "waiting"
      ? "SUBMITTED"
      : reviews.length
        ? "IN_PROGRESS"
        : "PENDING";

  // toTemplate's notes are about templates; keep the ones that say something about this request
  const notes = made.notes.filter((n) => !/held an example|pages are headings/.test(n));
  const lost = [...theirs.keys()].filter((k) => !placed.has(k)).length;
  if (lost) notes.push(`${lost} of the creator's uploads were on questions that didn't come over, so they stay in Content Snare.`);
  const due = str(r.due)?.slice(0, 10);

  return {
    contentSnareId: id,
    sentAt: Number.isFinite(sent) && sent < Date.now() ? new Date(sent).toISOString() : null,
    title: title.slice(0, 200),
    description: made.description,
    due: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    fields: requestFieldsFromTemplate({ fields: made.fields }),
    status,
    copies,
    notes,
  };
}

/** Only Content Snare's own file links, never anywhere else */
export function isContentSnareFileUrl(u: string): boolean {
  try {
    const url = new URL(u);
    const allowed = new URL(process.env.CONTENT_SNARE_API_URL || "https://api.contentsnare.com");
    return url.origin === allowed.origin && url.pathname.startsWith("/rails/active_storage/");
  } catch {
    return false;
  }
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
};
/** A storable name, with an extension that says what it is (pictures in instructions have none) */
function safeName(name: string, type: string): string {
  let plain = name;
  try {
    plain = decodeURIComponent(name);
  } catch {
    /* keep it as it was */
  }
  const base = plain.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-100) || "file";
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : base + (EXTENSIONS[type] ?? "");
}

/**
 * Copy one planned file into CCM: an example onto its field, or the creator's
 * upload onto theirs (reviewed as Content Snare had it, when the person
 * importing may review). Returns the bytes copied.
 */
export async function copyFile(opts: {
  agencyId: string;
  requestId: string;
  copy: PlannedCopy;
  canReview: boolean;
}): Promise<number> {
  const { agencyId, requestId, copy } = opts;
  if (!isContentSnareFileUrl(copy.url)) throw new ContentSnareError("That isn't a Content Snare file link.");
  const request = await db.contentRequest.findFirst({
    where: { id: requestId, agencyId },
    select: { id: true, creatorId: true, fields: true, fieldSubmissions: true },
  });
  if (!request) throw new ContentSnareError("The request isn't there any more.");
  const fields = (Array.isArray(request.fields) ? request.fields : []) as unknown as RequestFieldFromTemplate[];
  const field = fields.find((f) => f.id === copy.fieldId);
  if (!field) throw new ContentSnareError("That question isn't on the request.");

  const res = await fetch(copy.url, { redirect: "follow", signal: AbortSignal.timeout(280_000) });
  if (!res.ok || !res.body) throw new ContentSnareError(`Content Snare didn't hand over ${copy.name} (${res.status}).`);
  const length = Number(res.headers.get("content-length"));
  if (length > MAX_FILE_SIZE) throw new ContentSnareError(`${copy.name} is bigger than CCM takes (5 GB).`);
  const type = copy.contentType || (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
  const name = safeName(copy.name, type);

  if (copy.kind === "example") {
    const key = `${TEMPLATE_ASSETS_PREFIX}/${agencyId}/content-snare/${crypto.randomBytes(6).toString("hex")}-${name}`;
    const bytes = await streamToStorage(key, res.body, type);
    const url = templateAssetUrl(key);
    // As a template import does: the first video plays on the field, pictures show, anything else is a link
    const rc = (field.richContent ??= {});
    if (type.startsWith("video/") && !rc.exampleVideoUrl) rc.exampleVideoUrl = url;
    else if (type.startsWith("image/")) (rc.exampleImages ??= []).push({ url });
    else (rc.referenceLinks ??= []).push({ label: copy.name === "example" ? "Example" : copy.name, url });
    await db.contentRequest.update({ where: { id: request.id }, data: { fields: fields as unknown as Prisma.InputJsonValue } });
    return bytes;
  }

  const key = generateStorageKey(agencyId, request.creatorId, request.id, name);
  const bytes = await streamToStorage(key, res.body, type);
  const review: Review = !opts.canReview && (copy.review === "approved" || copy.review === "sentBack") ? "sent" : copy.review ?? "notSent";
  const uploadedAt = copy.uploadedAt && Number.isFinite(Date.parse(copy.uploadedAt)) ? new Date(copy.uploadedAt) : new Date();
  await db.upload.create({
    data: {
      requestId: request.id,
      creatorId: request.creatorId,
      fieldId: field.id,
      fileName: name,
      originalName: copy.name.slice(0, 255),
      fileType: type,
      fileSize: BigInt(bytes),
      storageKey: key,
      uploadStatus: "COMPLETED",
      uploadProgress: 100,
      status: review === "approved" ? "APPROVED" : review === "sentBack" ? "REJECTED" : "PENDING",
      reviewNote: review === "sentBack" ? copy.feedback?.slice(0, 2000) || null : null,
      metadata: { source: "content-snare" },
      uploadedAt,
    },
  });
  // The question as a whole, as Content Snare had it
  if (review !== "notSent") {
    const subs = obj(request.fieldSubmissions);
    const now = new Date().toISOString();
    subs[field.id] =
      review === "approved"
        ? { status: "APPROVED", submittedAt: uploadedAt.toISOString(), reviewedAt: now }
        : review === "sentBack"
          ? { status: "NEEDS_REVISION", submittedAt: uploadedAt.toISOString(), reviewedAt: now, ...(copy.feedback ? { feedback: copy.feedback } : {}) }
          : { status: "SUBMITTED", submittedAt: uploadedAt.toISOString() };
    await db.contentRequest.update({ where: { id: request.id }, data: { fieldSubmissions: subs as Prisma.InputJsonValue } });
  }
  return bytes;
}
