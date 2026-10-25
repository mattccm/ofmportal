/**
 * Shared types for the Title Wall components. These are presentation types:
 * pages map their Prisma rows onto them, the components never fetch.
 */
import {
  CircleCheck,
  CircleDashed,
  Clock,
  RotateCcw,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";

/**
 * The state of one requested field, as the wall draws it. Every state is a
 * colour, an icon and a word together, never colour alone:
 * - waiting:  to do, not uploaded yet (grey outline, dashed circle)
 * - ready:    uploaded, waiting for review (blue, clock)
 * - approved: approved (green, check; the only green in the product)
 * - changes:  needs changes (orange, undo arrow)
 * - overdue:  not uploaded and the request is past due (red outline, alert)
 */
export type FieldState = "waiting" | "ready" | "approved" | "changes" | "overdue";

/** Who is reading: staff review uploads, creators wait for that review. */
export type StateAudience = "staff" | "creator";

export interface FieldSummary {
  /** Stable key (the field id) */
  id?: string;
  /** The field's name, e.g. "Cover photo" */
  name: string;
  state: FieldState;
  /**
   * Creator side only: a "ready" field whose uploads the creator has not sent
   * in yet. The cell stays ready; the word and icon become the unsent ones.
   */
  unsent?: boolean;
}

/** Display order, from "nothing yet" to "done", with overdue first when it shows. */
export const FIELD_STATE_ORDER: FieldState[] = ["overdue", "waiting", "ready", "changes", "approved"];

/** The full name of a state, for tooltips and accessible names (staff wording). */
export const FIELD_STATE_LABEL: Record<FieldState, string> = {
  waiting: "To do, not uploaded yet",
  ready: "Ready to review",
  approved: "Approved",
  changes: "Needs changes",
  overdue: "Overdue, not uploaded yet",
};

/** The word on a chip, a legend or under a labelled strip (staff wording). */
export const FIELD_STATE_SHORT: Record<FieldState, string> = {
  waiting: "To do",
  ready: "Ready to review",
  approved: "Approved",
  changes: "Needs changes",
  overdue: "Overdue",
};

/** The same vocabulary in the creator's words: CCM reviews, the creator waits. */
export const CREATOR_FIELD_STATE_LABEL: Record<FieldState, string> = {
  waiting: "To do, not uploaded yet",
  ready: "Waiting for review",
  approved: "Approved",
  changes: "Needs changes",
  overdue: "Overdue, not uploaded yet",
};

export const CREATOR_FIELD_STATE_SHORT: Record<FieldState, string> = {
  waiting: "To do",
  ready: "Waiting for review",
  approved: "Approved",
  changes: "Needs changes",
  overdue: "Overdue",
};

/**
 * One icon per state, drawn beside the word wherever a state is written out
 * (chips, legends, labelled strips). Distinct silhouettes so the states still
 * read when hues collapse for colour-blind readers.
 */
export const FIELD_STATE_ICON: Record<FieldState, LucideIcon> = {
  waiting: CircleDashed,
  ready: Clock,
  approved: CircleCheck,
  changes: RotateCcw,
  overdue: TriangleAlert,
};

/**
 * Creator side only: a field with uploads the creator has not sent in yet.
 * Not a sixth state (the cell stays "ready"); only the word and icon change,
 * in neutral ink, because nobody is reviewing it yet. Once sent it reads
 * "Waiting for review".
 */
export const UNSENT_LABEL = "Uploaded, not sent yet";
export const UNSENT_SHORT = "Not sent yet";
export const UNSENT_ICON: LucideIcon = Upload;

/** The text colour utility for a state's icon (and its word on a chip). */
export const FIELD_STATE_TEXT: Record<FieldState, string> = {
  waiting: "text-waiting",
  ready: "text-ready",
  approved: "text-approved",
  changes: "text-changes",
  overdue: "text-late",
};

export function stateLabel(state: FieldState, audience: StateAudience = "staff"): string {
  return (audience === "creator" ? CREATOR_FIELD_STATE_LABEL : FIELD_STATE_LABEL)[state];
}

export function stateShort(state: FieldState, audience: StateAudience = "staff"): string {
  return (audience === "creator" ? CREATOR_FIELD_STATE_SHORT : FIELD_STATE_SHORT)[state];
}

/**
 * A request's status, as one of the field states (for request-level chips).
 * Drafts, cancelled and archived requests have no state and return null.
 */
export function requestStatusState(status: string, overdue = false): FieldState | null {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "NEEDS_REVISION":
      return "changes";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return overdue ? "overdue" : "ready";
    case "PENDING":
    case "IN_PROGRESS":
      return overdue ? "overdue" : "waiting";
    default:
      return null;
  }
}

/** An upload's review status (PENDING / APPROVED / REJECTED) as a field state. */
export function uploadStatusState(status: string): FieldState {
  return status === "APPROVED" ? "approved" : status === "REJECTED" ? "changes" : "ready";
}

/** True when a field should read "Uploaded, not sent yet" (creator words, ready and unsent) */
export function isUnsent(state: FieldState, unsent: boolean | undefined, audience: StateAudience): boolean {
  return audience === "creator" && state === "ready" && !!unsent;
}

/** A field's full state name, with the creator's unsent wording when it applies */
export function fieldStateLabel(state: FieldState, audience: StateAudience = "staff", unsent?: boolean): string {
  return isUnsent(state, unsent, audience) ? UNSENT_LABEL : stateLabel(state, audience);
}

/** A field's short state word, with the creator's unsent wording when it applies */
export function fieldStateShort(state: FieldState, audience: StateAudience = "staff", unsent?: boolean): string {
  return isUnsent(state, unsent, audience) ? UNSENT_SHORT : stateShort(state, audience);
}

/** "Cover photo: Approved; Set photos: Ready to review" for a strip's accessible name */
export function stripLabel(fields: FieldSummary[], audience: StateAudience = "staff"): string {
  return fields.map((f) => `${f.name}: ${fieldStateLabel(f.state, audience, f.unsent)}`).join("; ");
}

/** "2 of 6 approved · 2 to review · 1 needs changes · 1 overdue · 2 to do" */
export function fieldSummary(fields: FieldSummary[], audience: StateAudience = "staff"): string {
  const n = fields.length;
  const count = (s: FieldState) => fields.filter((f) => f.state === s).length;
  const approved = count("approved");
  if (n > 0 && approved === n) return `${n === 1 ? "1 field" : `${n} fields`} approved`;
  const parts = [`${approved} of ${n} approved`];
  const ready = count("ready");
  const changes = count("changes");
  const toDo = count("waiting");
  const overdue = count("overdue");
  if (audience === "creator") {
    const unsent = fields.filter((f) => f.state === "ready" && f.unsent).length;
    if (unsent) parts.push(`${unsent} not sent yet`);
    if (ready - unsent) parts.push(`${ready - unsent} waiting for review`);
  } else if (ready) parts.push(`${ready} to review`);
  if (changes) parts.push(`${changes} ${changes === 1 ? "needs" : "need"} changes`);
  if (overdue) parts.push(`${overdue} overdue`);
  if (toDo) parts.push(`${toDo} to do`);
  return parts.join(" · ");
}
