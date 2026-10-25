/**
 * Map a content request (Prisma row: its `fields` JSON, `fieldSubmissions`
 * JSON and completed uploads) onto the Title Wall's field states.
 *
 * Pure and typed: no database access, safe on the server and the client.
 * Pages fetch their own rows and call these helpers; the Title Wall
 * components (src/components/title-wall) only draw the result.
 *
 * How a request's fields relate to its uploads in this app:
 * - `ContentRequest.fields` is an array of `{ id, label, type, required }`.
 *   Only `type === "file"` entries are upload slots; text fields are notes
 *   the creator fills in and are never reviewed, so they are not drawn.
 * - Each upload carries `fieldId` (the slot it was uploaded to) and a review
 *   `status`: PENDING (not reviewed), APPROVED, REJECTED.
 * - `ContentRequest.fieldSubmissions[fieldId].status` tracks the slot as a
 *   whole: PENDING (creator still uploading, not sent in), SUBMITTED (sent in
 *   for review), APPROVED, NEEDS_REVISION. The field review API only reviews a
 *   SUBMITTED slot, so uploads in a PENDING slot are not ready yet.
 * - Required slots are the file fields marked `required`; when none is marked,
 *   every file field is a slot (the same rule as getRequiredFileFieldIds in
 *   src/lib/upload-finalize.ts). Optional fields are drawn only once the
 *   creator has put something in them.
 * - Older requests with no file fields fall back to one "Uploads" field built
 *   from all the request's uploads.
 */

import type { FieldState, FieldSummary } from "@/components/title-wall/types";

/** Statuses where the creator still owes content (mirrors src/lib/request-status.ts) */
const AWAITING_CREATOR = new Set(["PENDING", "IN_PROGRESS", "NEEDS_REVISION"]);

/** Requests that are out with a creator or with staff (not drafts, not closed) */
export const ACTIVE_REQUEST_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_REVISION",
] as const;

export type UploadReview = "PENDING" | "APPROVED" | "REJECTED";

/** The upload columns the mapper reads. Pass COMPLETED uploads only. */
export interface RequestUploadInput {
  id: string;
  fieldId: string | null;
  status: UploadReview | string;
  uploadedAt: Date | string | null;
  createdAt: Date | string;
}

/** The request columns the mapper reads */
export interface RequestCardInput {
  id: string;
  status: string;
  dueDate: Date | string | null;
  /** ContentRequest.fields (JSON) */
  fields: unknown;
  /** ContentRequest.fieldSubmissions (JSON) */
  fieldSubmissions: unknown;
  uploads: RequestUploadInput[];
}

/** One drawn field, with what the wall needs beyond its state */
export interface RequestFieldCard extends FieldSummary {
  id: string;
  /** Completed uploads in this field */
  uploads: number;
  /** Uploads waiting for review that staff can review now */
  readyUploads: number;
  /** The creator has uploaded but not sent the field in yet */
  inProgress: boolean;
  /** Latest upload time in this field */
  latestUploadAt: Date | null;
  /** Staff feedback when changes were requested */
  feedback?: string;
}

export interface RequestFieldCounts {
  total: number;
  approved: number;
  ready: number;
  changes: number;
  /** Not uploaded yet (waiting + overdue) */
  toCome: number;
  /** Uploads staff can review now */
  readyUploads: number;
}

interface RawField {
  id?: unknown;
  label?: unknown;
  name?: unknown;
  type?: unknown;
  required?: unknown;
}

interface RawSubmission {
  status?: unknown;
  feedback?: unknown;
}

const toDate = (d: Date | string | null | undefined): Date | null => (d == null ? null : d instanceof Date ? d : new Date(d));

/** Past its due date while the creator still owes content */
export function isRequestLate(req: Pick<RequestCardInput, "status" | "dueDate">, now: Date = new Date()): boolean {
  const due = toDate(req.dueDate);
  return !!due && due.getTime() < now.getTime() && AWAITING_CREATOR.has(req.status);
}

/** True while the request waits on the creator */
export function isAwaitingCreator(status: string): boolean {
  return AWAITING_CREATOR.has(status);
}

function fileFieldsOf(fields: unknown): { id: string; name: string; required: boolean }[] {
  if (!Array.isArray(fields)) return [];
  return (fields as RawField[])
    .filter((f) => f && f.type === "file" && typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      name: typeof f.label === "string" && f.label.trim() ? f.label.trim() : typeof f.name === "string" ? f.name : "Upload",
      required: f.required === true,
    }));
}

function submissionsOf(json: unknown): Record<string, RawSubmission> {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, RawSubmission>) : {};
}

function fieldState(opts: {
  requestStatus: string;
  late: boolean;
  submission: string | undefined;
  uploads: RequestUploadInput[];
  /** No per-field submission tracking (legacy / no file fields) */
  legacy: boolean;
}): { state: FieldState; readyUploads: number; inProgress: boolean } {
  const { requestStatus, late, submission, uploads, legacy } = opts;
  if (requestStatus === "APPROVED") return { state: "approved", readyUploads: 0, inProgress: false };

  const pending = uploads.filter((u) => u.status === "PENDING").length;
  const rejected = uploads.filter((u) => u.status === "REJECTED").length;
  const approved = uploads.filter((u) => u.status === "APPROVED").length;

  // Uploads are reviewable once the field is sent in. Without per-field
  // tracking (or with a PENDING entry left by a submit from before fields were
  // marked on submit), a request the creator has submitted counts as sent in.
  const sentIn =
    submission === "SUBMITTED" ||
    ((submission === undefined || submission === "PENDING") &&
      (legacy || requestStatus === "SUBMITTED" || requestStatus === "UNDER_REVIEW"));

  if (pending > 0 && submission !== "APPROVED" && sentIn) return { state: "ready", readyUploads: pending, inProgress: false };
  if (submission === "NEEDS_REVISION" || (rejected > 0 && pending === 0 && submission !== "APPROVED")) {
    return { state: "changes", readyUploads: 0, inProgress: false };
  }
  if (submission === "APPROVED" || (uploads.length > 0 && approved === uploads.length)) {
    return { state: "approved", readyUploads: 0, inProgress: false };
  }
  return { state: late ? "overdue" : "waiting", readyUploads: 0, inProgress: pending > 0 };
}

/**
 * Every drawn field of a request, in the request's own order, with its state.
 *
 * @example
 * const fields = mapRequestFields(row);           // RequestFieldCard[]
 * <TitleCard fields={fields} ... />               // FieldSummary-compatible
 */
export function mapRequestFields(req: RequestCardInput, now: Date = new Date()): RequestFieldCard[] {
  const late = isRequestLate(req, now);
  const subs = submissionsOf(req.fieldSubmissions);
  const files = fileFieldsOf(req.fields);
  const latest = (list: RequestUploadInput[]) =>
    list.reduce<Date | null>((m, u) => {
      const t = toDate(u.uploadedAt) ?? toDate(u.createdAt);
      return t && (!m || t > m) ? t : m;
    }, null);

  const build = (id: string, name: string, list: RequestUploadInput[], submission: RawSubmission | undefined, legacy: boolean): RequestFieldCard => {
    const status = typeof submission?.status === "string" ? submission.status : undefined;
    const s = fieldState({ requestStatus: req.status, late, submission: status, uploads: list, legacy });
    return {
      id,
      name,
      state: s.state,
      uploads: list.length,
      readyUploads: s.readyUploads,
      inProgress: s.inProgress,
      latestUploadAt: latest(list),
      feedback: s.state === "changes" && typeof submission?.feedback === "string" ? submission.feedback : undefined,
    };
  };

  if (files.length === 0) {
    return [build(`${req.id}:uploads`, "Uploads", req.uploads, undefined, true)];
  }

  const anyRequired = files.some((f) => f.required);
  const known = new Set(files.map((f) => f.id));
  const out: RequestFieldCard[] = [];
  for (const f of files) {
    const list = req.uploads.filter((u) => u.fieldId === f.id);
    const isSlot = anyRequired ? f.required : true;
    // optional fields are drawn once the creator has used them
    if (!isSlot && list.length === 0 && !subs[f.id]) continue;
    out.push(build(f.id, f.name, list, subs[f.id], false));
  }
  const orphans = req.uploads.filter((u) => !u.fieldId || !known.has(u.fieldId));
  if (orphans.length) out.push(build(`${req.id}:other`, "Other uploads", orphans, undefined, true));
  return out;
}

/** Counts across a request's drawn fields */
export function countFields(fields: RequestFieldCard[]): RequestFieldCounts {
  const c = (s: FieldState) => fields.filter((f) => f.state === s).length;
  return {
    total: fields.length,
    approved: c("approved"),
    ready: c("ready"),
    changes: c("changes"),
    toCome: c("waiting") + c("overdue"),
    readyUploads: fields.reduce((n, f) => n + f.readyUploads, 0),
  };
}

/**
 * Order requests by urgency for a featured slot: overdue first (most late
 * first), then the most fields ready to review, then the nearest due date.
 */
export function compareUrgency(
  a: { late: boolean; due: Date | null; counts: RequestFieldCounts },
  b: { late: boolean; due: Date | null; counts: RequestFieldCounts }
): number {
  if (a.late !== b.late) return a.late ? -1 : 1;
  const dueA = a.due?.getTime() ?? Number.POSITIVE_INFINITY;
  const dueB = b.due?.getTime() ?? Number.POSITIVE_INFINITY;
  if (a.late && b.late) return dueA - dueB;
  if (a.counts.ready !== b.counts.ready) return b.counts.ready - a.counts.ready;
  return dueA - dueB;
}
