/**
 * The creator portal's own words for request and field states, shared by the
 * creator home, requests list and request page so they always say the same
 * thing. Creator language: "submitted", "in review", "a new take", "to do".
 * The creator never sees the agency's short name here: people are named by
 * first name, the agency is "your team".
 */
import { fieldSummary, formatDay, type FieldSummary } from "@/components/title-wall";
import type { CreatorFieldStateRow } from "@/lib/creator-field-states";

export const ACTIONABLE = new Set(["PENDING", "IN_PROGRESS", "NEEDS_REVISION"]);
/** Submitted and waiting for review */
export const IN_REVIEW = new Set(["SUBMITTED", "UNDER_REVIEW"]);

/** Field rows mapped onto the Title Wall's strip type */
export function toStrip(rows: CreatorFieldStateRow[] | undefined): FieldSummary[] {
  return (rows || []).map((r) => ({ id: r.id, name: r.name, state: r.state, unsent: r.unsent }));
}

/**
 * "1 of 3 approved · 1 not sent yet · 1 waiting for review · 1 needs changes · 2 to do",
 * the shared field vocabulary in the creator's words
 */
export function creatorSummary(rows: CreatorFieldStateRow[] | undefined): string {
  const list = rows || [];
  if (list.length === 0) return "No fields listed";
  return fieldSummary(toStrip(list), "creator");
}

/** "Sent Mon 19 Oct" */
export function sentLine(createdAt: string | Date): string {
  return `Sent ${formatDay(new Date(createdAt))}`;
}

export interface NextStep {
  /** One sentence: what to do next */
  sentence: string;
  /** The primary action's label */
  cta: string;
  /** Field to jump to on the request page */
  fieldId?: string;
  /** The reviewer's note when a new take is needed */
  note?: string;
}

/**
 * The one next action on a request the creator still has to finish.
 * Order: a new take that was asked for, then the fields still to do, then submitting.
 */
export function nextStep(
  rows: CreatorFieldStateRow[] | undefined,
  feedback?: Record<string, { feedback?: string } | undefined> | null
): NextStep {
  const list = rows || [];
  const changes = list.filter((r) => r.state === "changes");
  if (changes.length > 0) {
    const f = changes[0];
    const more = changes.length > 1 ? `, and ${changes.length - 1} more` : "";
    return {
      sentence: `Next: a new take of ${f.name}${more}.`,
      cta: "Upload a new take",
      fieldId: f.id,
      note: feedback?.[f.id]?.feedback || undefined,
    };
  }
  // overdue (required) fields first, then the rest in the request's order
  const toDo = list
    .filter((r) => r.state === "waiting" || r.state === "overdue")
    .sort((a, b) => Number(b.state === "overdue") - Number(a.state === "overdue"));
  if (toDo.length > 0) {
    const f = toDo[0];
    const rest = toDo.length - 1;
    const sentence =
      rest === 0
        ? `Next: ${f.name}, the last thing to do.`
        : `Next: ${f.name}, then ${rest} more ${rest === 1 ? "field" : "fields"}.`;
    // the button opens this one field, so it names it
    const cta = f.kind === "text" ? `Write ${f.name.toLowerCase()}` : `Upload ${f.name.toLowerCase()}`;
    return { sentence, cta, fieldId: f.id };
  }
  return {
    sentence: "Everything is in. Submit it when you're happy with it.",
    cta: "Submit",
  };
}

/** One word for a request's status, as the creator sees it */
export const STATUS_WORD: Record<string, string> = {
  PENDING: "To do",
  IN_PROGRESS: "In progress",
  NEEDS_REVISION: "Needs changes",
  SUBMITTED: "In review",
  UNDER_REVIEW: "In review",
};
