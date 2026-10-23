// Shared request-status helpers (safe for client and server components)

/** Statuses where the creator still owes content */
export const CREATOR_ACTIONABLE_STATUSES = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];

/** True while the request is waiting on the creator (not submitted, in review, approved or closed) */
export function isAwaitingCreator(status: string): boolean {
  return CREATOR_ACTIONABLE_STATUSES.includes(status);
}

/** A request is overdue only when its due date has passed and the creator still owes content */
export function isRequestOverdue(request: {
  dueDate: string | Date | null | undefined;
  status: string;
}): boolean {
  if (!request.dueDate) return false;
  return (
    new Date(request.dueDate).getTime() < Date.now() &&
    isAwaitingCreator(request.status)
  );
}
