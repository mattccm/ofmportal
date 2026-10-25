/**
 * Field review calls shared by the Requests list (Approve all ready) and the
 * request review player. Two paths, in this order:
 * 1. a field the creator submitted goes through the field review route, which
 *    also approves or rejects its uploads and moves the request status;
 * 2. otherwise (ad-hoc uploads, or a field with no submission record) the
 *    field's pending uploads go through /api/uploads/approve or /reject.
 */
import { toast } from "sonner";

export interface ReviewTarget {
  requestId: string;
  /** null for ad-hoc requests without file fields */
  fieldId: string | null;
  /** The creator submitted this field (fieldSubmissions has a non-PENDING record) */
  submitted: boolean;
  /** Completed uploads still waiting for a decision */
  uploadIds: string[];
}

export interface ReviewResult {
  ok: boolean;
  /** New request status when the field route reports one */
  requestStatus?: string;
  /** The field's new submission record when the field route returns one */
  fieldSubmission?: { status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION"; feedback?: string; reviewedAt?: string; submittedAt?: string };
  error?: string;
}

async function post(url: string, body: unknown, keepalive = false) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function approveTarget(t: ReviewTarget, keepalive = false): Promise<ReviewResult> {
  try {
    if (t.submitted && t.fieldId) {
      const { res, data } = await post(`/api/requests/${t.requestId}/fields/${t.fieldId}/review`, { action: "approve" }, keepalive);
      if (res.ok) return { ok: true, requestStatus: data.requestStatus, fieldSubmission: data.fieldSubmission };
      // Fall through to the uploads path when the field has no reviewable submission
      if (t.uploadIds.length === 0) return { ok: false, error: data.error };
    }
    if (t.uploadIds.length === 0) return { ok: false, error: "Nothing in this field is waiting for review." };
    const { res, data } = await post("/api/uploads/approve", { uploadIds: t.uploadIds, requestId: t.requestId }, keepalive);
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  } catch {
    return { ok: false, error: "The connection dropped." };
  }
}

export async function requestChangesTarget(t: ReviewTarget, feedback: string): Promise<ReviewResult> {
  try {
    if (t.submitted && t.fieldId) {
      const { res, data } = await post(`/api/requests/${t.requestId}/fields/${t.fieldId}/review`, {
        action: "request_changes",
        feedback,
      });
      if (res.ok) return { ok: true, requestStatus: data.requestStatus, fieldSubmission: data.fieldSubmission };
      if (t.uploadIds.length === 0) return { ok: false, error: data.error };
    }
    if (t.uploadIds.length === 0) return { ok: false, error: "There is no upload in this field to send back." };
    const { res, data } = await post("/api/uploads/reject", { uploadIds: t.uploadIds, requestId: t.requestId, reason: feedback });
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  } catch {
    return { ok: false, error: "The connection dropped." };
  }
}

/** How long an approval is held, so Undo can take it back before it is sent. */
export const HOLD_MS = 5000;

/**
 * Holds an action for HOLD_MS behind a toast with Undo. Returns a handle:
 * `flush()` sends it now (on navigation), `cancel()` drops it.
 * The work runs once, whichever comes first.
 */
export function holdAction(opts: {
  message: string;
  run: (keepalive: boolean) => Promise<void>;
  onUndo: () => void;
}) {
  let done = false;
  const fire = (keepalive: boolean) => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    void opts.run(keepalive);
  };
  const timer = window.setTimeout(() => fire(false), HOLD_MS);
  const id = toast(opts.message, {
    duration: HOLD_MS,
    action: {
      label: "Undo",
      onClick: () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        opts.onUndo();
      },
    },
  });
  return {
    flush: () => {
      toast.dismiss(id);
      fire(true);
    },
    cancel: () => {
      done = true;
      window.clearTimeout(timer);
      toast.dismiss(id);
    },
    get done() {
      return done;
    },
  };
}
