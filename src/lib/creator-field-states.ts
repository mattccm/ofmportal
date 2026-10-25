/**
 * Field states as the creator portal draws them (the Title Wall's FieldState),
 * computed the same way on the server (request list) and the client (request
 * page), so a creator's home and request page always agree.
 *
 * - approved: CCM approved the field (or the whole request)
 * - changes:  CCM asked for a new take (field NEEDS_REVISION, or a rejected file)
 * - ready:    uploaded (or a written answer saved); `unsent` while the creator
 *             has not sent it in yet, "Waiting for review" once sent
 * - waiting:  nothing yet; "overdue" when the request is past due
 */

export type CreatorFieldState = "waiting" | "ready" | "approved" | "changes" | "overdue";

export interface CreatorFieldDef {
  id?: string;
  label: string;
  type: string;
  value?: string;
  required?: boolean;
  /** Set by the creator portal when the creator wrote this answer */
  filledByCreator?: boolean;
}

export interface CreatorFieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

export interface CreatorUploadLite {
  fieldId?: string | null;
  status?: string | null;
}

export interface CreatorFieldStateRow {
  id: string;
  name: string;
  kind: "file" | "text";
  state: CreatorFieldState;
  /** A ready field the creator has not sent in yet (not submitted, request not in review) */
  unsent?: boolean;
}

const TEXT_TYPES = new Set(["text", "textarea"]);

/** A field id that is stable even for legacy fields saved without one */
export function fieldKey(f: { id?: string; label: string }): string {
  return f.id || `field-${f.label}`;
}

/**
 * A written field the creator answers: a text field CCM left empty when it was
 * sent (or one the creator already answered). Text fields CCM filled in are
 * instructions and stay read-only.
 */
export function isCreatorTextField(f: CreatorFieldDef): boolean {
  return TEXT_TYPES.has(f.type) && (!f.value || !!f.filledByCreator);
}

export function computeCreatorFieldStates(input: {
  fields: CreatorFieldDef[] | null | undefined;
  fieldSubmissions?: Record<string, CreatorFieldSubmission> | null;
  uploads: CreatorUploadLite[];
  requestStatus: string;
  overdue: boolean;
}): CreatorFieldStateRow[] {
  const fields = input.fields || [];
  const subs = input.fieldSubmissions || {};
  const allApproved = input.requestStatus === "APPROVED";
  const requestSent = input.requestStatus === "SUBMITTED" || input.requestStatus === "UNDER_REVIEW";
  const unsent = (id: string, state: CreatorFieldState) =>
    state === "ready" && !requestSent && subs[id]?.status !== "SUBMITTED";
  const rows: CreatorFieldStateRow[] = [];

  for (const f of fields) {
    const id = fieldKey(f);
    if (f.type === "file") {
      const files = input.uploads.filter((u) => u.fieldId === id);
      const sub = subs[id]?.status;
      let state: CreatorFieldState;
      if (allApproved || sub === "APPROVED") state = "approved";
      else if (sub === "NEEDS_REVISION" || files.some((u) => u.status === "REJECTED")) state = "changes";
      else if (files.length > 0) state = files.every((u) => u.status === "APPROVED") ? "approved" : "ready";
      // an optional field left empty is never "overdue"
      else state = input.overdue && f.required !== false ? "overdue" : "waiting";
      rows.push({ id, name: f.label, kind: "file", state, unsent: unsent(id, state) });
    } else if (isCreatorTextField(f)) {
      const filled = !!f.value?.trim();
      const state: CreatorFieldState = allApproved
        ? "approved"
        : filled
          ? "ready"
          : input.overdue && f.required
            ? "overdue"
            : "waiting";
      rows.push({ id, name: f.label, kind: "text", state, unsent: unsent(id, state) });
    }
  }
  return rows;
}
