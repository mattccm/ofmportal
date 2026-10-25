/**
 * Maps request rows (Prisma JSON fields + uploads) onto the Title Wall's
 * presentation types for the Requests screens. Field states come from the
 * shared mapper in src/lib/title-wall/request-card-data.ts.
 */
import type { FieldState, FieldSummary } from "@/components/title-wall";
import { mapRequestFields } from "@/lib/title-wall/request-card-data";

export interface MapField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface MapSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

export interface MapUpload {
  fieldId?: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  uploadStatus: string; // COMPLETED | ...
}

/** Statuses that count as finished: no time left, read-only review. */
export const FINISHED_STATUSES = ["APPROVED", "CANCELLED", "ARCHIVED"] as const;

export function isFinished(status: string): boolean {
  return (FINISHED_STATUSES as readonly string[]).includes(status);
}

/** The file fields of a request, in order. */
export function fileFieldsOf(fields: unknown): MapField[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter(
    (f): f is MapField => !!f && typeof f === "object" && (f as MapField).type === "file" && typeof (f as MapField).id === "string"
  );
}

/**
 * The field strip for a request, drawn by the one shared rule in
 * src/lib/title-wall/request-card-data.ts, so the Requests screens count
 * "ready" exactly as the Overview and the creator pages do. Requests without
 * file fields (ad-hoc) get a single "Uploads" cell drawn from all their uploads.
 */
export function mapFields(input: {
  fields: unknown;
  fieldSubmissions: unknown;
  uploads: MapUpload[];
  status: string;
  dueDate: string | Date | null;
  now?: Date;
}): FieldSummary[] {
  const cards = mapRequestFields(
    {
      id: "",
      status: input.status,
      dueDate: input.dueDate,
      fields: input.fields,
      fieldSubmissions: input.fieldSubmissions,
      uploads: input.uploads
        .filter((u) => u.uploadStatus === "COMPLETED")
        .map((u, i) => ({ id: String(i), fieldId: u.fieldId ?? null, status: u.status, uploadedAt: null, createdAt: new Date(0) })),
    },
    input.now
  );
  return cards
    // the player shows orphaned uploads under their own request, not as a field
    .filter((c) => c.id !== ":other")
    .map((c) => ({ id: c.id === ":uploads" ? "__uploads" : c.id, name: c.name, state: c.state }));
}

/** Counts by state, for tabs and sentences. */
export function countStates(fields: FieldSummary[]) {
  const c = { waiting: 0, ready: 0, approved: 0, changes: 0, overdue: 0 } as Record<FieldState, number>;
  for (const f of fields) c[f.state]++;
  return c;
}
