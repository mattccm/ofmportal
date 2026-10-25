import type { FieldState } from "@/components/title-wall/types";
import type { RequestFieldCounts } from "@/lib/title-wall/request-card-data";

/** Serialisable shapes the Overview server page hands to its client wall. */

export interface OverviewField {
  id: string;
  name: string;
  state: FieldState;
  uploads: number;
  readyUploads: number;
  inProgress: boolean;
  feedback: string | null;
}

export interface OverviewRequest {
  id: string;
  title: string;
  status: string;
  /** ISO due moment */
  due: string | null;
  /** ISO, when the request was created */
  sentAt: string;
  creatorId: string;
  creatorName: string;
  creatorLastSeen: string | null;
  /** Template name */
  kind: string | null;
  /** Past due while the creator still owes content */
  late: boolean;
  lastReminderAt: string | null;
  fields: OverviewField[];
  counts: RequestFieldCounts;
}

/** One field's uploads that are ready for review: a tile on "New from creators" */
export interface OverviewUpload {
  /** `${requestId}:${fieldId}` */
  id: string;
  /** The newest upload in the field, used for the preview */
  uploadId: string;
  requestId: string;
  requestTitle: string;
  creatorId: string;
  creatorName: string;
  fieldName: string;
  count: number;
  photos: number;
  videos: number;
  bytes: number;
  kind: "photo" | "video";
  /** Seconds, for a video with a known duration */
  duration: number | null;
  /** A same-origin route that redirects to a short-lived signed preview; null when there is none */
  thumb: string | null;
  uploadedAt: string;
}

export interface OverviewMessage {
  conversationId: string;
  creatorId: string;
  creatorName: string;
  unread: number;
  preview: string;
  at: string;
}

export interface OverviewData {
  /** The server's "now" (ISO), so every figure on the page agrees */
  now: string;
  /** Active requests, most urgent first */
  requests: OverviewRequest[];
  uploads: OverviewUpload[];
  messages: OverviewMessage[];
  /** creatorId → their creator conversation id (for Message links) */
  conversationByCreator: Record<string, string>;
  approvedThisWeek: number;
  approvedLastWeek: number;
}
