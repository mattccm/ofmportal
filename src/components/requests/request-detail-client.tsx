"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  MessageSquare,
  PanelRightOpen,
  Send,
  Bell,
} from "lucide-react";
import { NotesPanel } from "@/components/notes/notes-panel";
import { type Note } from "@/lib/notes-utils";
import { formatDistanceToNow } from "date-fns";
import { UploadsList } from "@/components/uploads/uploads-list";
import { RequestActions } from "@/components/requests/request-actions";
import { CommentSection } from "@/components/comments/comment-section";
import { type FieldSubmission } from "@/components/requests/field-review-controls";
import { CloneRequestDialog } from "@/components/requests/clone-request-dialog";
import { WatchersPanel, type Watcher } from "@/components/requests/watchers-panel";
import { toast } from "sonner";
import {
  EditableRequestTitle,
  EditableStatusBadge,
  EditablePriorityBadge,
  EditableDueDate,
} from "@/components/editable";
import { useCreatorContextPanel, useSetCreatorContext } from "@/components/providers/creator-context-provider";
import { HtmlContent } from "@/components/ui/html-content";
import { RequestEditor } from "@/components/requests/request-editor";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { useCelebrationContext } from "@/components/celebrations";
import { Countdown, FieldCell, FIELD_STATE_LABEL, fieldSummary, formatDay, formatDue, formatStamp, type FieldSummary } from "@/components/title-wall";
import { VideoReviewPanel } from "@/components/video-review";
import { fileFieldsOf, isFinished, mapFields } from "./title-wall-map";
import { approveTarget, holdAction, requestChangesTarget, type ReviewTarget } from "./review-actions";
import {
  FieldSelector,
  Stage,
  UpNextBar,
  UpNextQueue,
  UploadPicker,
  UPLOAD_STATUS_LABEL,
  kindOf,
  uploadFacts,
  type StageUpload,
} from "./review-player-parts";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access/client";

interface Creator {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
}

interface RichContentData {
  description?: string;
  exampleText?: string;
  exampleImageUrl?: string;
  exampleImages?: { url: string; caption?: string }[];
  exampleVideoUrl?: string;
  referenceLinks?: { label: string; url: string }[];
}

interface TemplateField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
  helpText?: string;
  quantity?: number;
  quantityLabel?: string;
  minFiles?: number;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  richContent?: RichContentData;
}

interface UploadItem {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint;
  storageKey: string;
  uploadStatus: string;
  status: string;
  uploadedAt: Date | null;
  createdAt: Date;
  fieldId?: string | null;
  metadata?: unknown;
  [key: string]: unknown;
}

interface CommentItem {
  id: string;
  message: string;
  createdAt: Date;
  isInternal: boolean;
  fieldId?: string | null;
  user: { id: string; name: string | null; avatar?: string | null };
  [key: string]: unknown;
}

interface WatcherItem {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
  notifyOnUpload: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  notifyOnDueDate: boolean;
  createdAt: string;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: Date | null;
  createdAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  viewedAt?: Date | null;
  reminders?: { id: string; type: string; channel: string; sentAt: Date | string | null }[];
  requirements: (Record<string, string> & { _richContent?: RichContentData }) | null;
  fields: TemplateField[] | null;
  fieldSubmissions?: Record<string, FieldSubmission> | null;
  creator: Creator;
  template: { id: string; name: string } | null;
  uploads: UploadItem[];
  comments: CommentItem[];
  watchers?: WatcherItem[];
}

interface CloneHistory {
  isClone: boolean;
  clonedFrom: {
    id: string;
    title: string;
    status: string;
    clonedAt?: string;
    creator: { id: string; name: string };
  } | null;
  clones: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    creator: { id: string; name: string; email?: string; avatar?: string | null };
  }[];
  cloneCount: number;
}

interface RequestDetailClientProps {
  request: Request;
  creators: Creator[];
  initialNotes?: Note[];
  currentUserId?: string;
  currentUser?: { id: string; name: string; role: string };
}

const PSEUDO = "__uploads";
const FILE_CAP = 4;
const STATUS_WORD: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  NEEDS_REVISION: "Needs changes",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};

const REMINDER_WORD: Record<string, string> = {
  UPCOMING: "before the due date",
  DUE_TODAY: "due today",
  OVERDUE: "overdue",
  ESCALATION: "follow-up",
};
const HISTORY_CAP = 6;

interface HistoryEvent {
  key: string;
  at: Date;
  text: string;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role='dialog'],[role='menu'],[role='listbox']");
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] border border-ctl px-1 font-mono text-[12px] text-ink-2">
      {children}
    </kbd>
  );
}

export function RequestDetailClient({
  request: initialRequest,
  creators,
  initialNotes = [],
  currentUserId = "",
  currentUser = { id: "", name: "Unknown", role: "MEMBER" },
}: RequestDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";

  const [request, setRequest] = useState(initialRequest);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [watchers, setWatchers] = useState<Watcher[]>((initialRequest.watchers || []) as Watcher[]);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneHistory, setCloneHistory] = useState<CloneHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyAll, setHistoryAll] = useState(false);

  const { openCreatorContext } = useCreatorContextPanel();
  const { can } = useAccess();
  const canApprove = can("review.approve");
  const canAskChanges = can("review.requestChanges");
  const canEdit = can("requests.edit");
  useSetCreatorContext(initialRequest.creator.id);
  const { celebrateCustom } = useCelebrationContext();
  const userId = currentUserId || currentUser.id;

  // ---------------------------------------------------------------- fields

  const fileFields = useMemo(() => fileFieldsOf(request.fields) as TemplateField[], [request.fields]);
  const hasFileFields = fileFields.length > 0;
  const strip: FieldSummary[] = useMemo(
    () =>
      mapFields({
        fields: request.fields,
        fieldSubmissions: request.fieldSubmissions,
        uploads: request.uploads,
        status: request.status,
        dueDate: request.dueDate,
      }),
    [request.fields, request.fieldSubmissions, request.uploads, request.status, request.dueDate]
  );
  const stateOf = useCallback((id: string) => strip.find((f) => f.id === id)?.state ?? "waiting", [strip]);

  const uploadsFor = useCallback(
    (fieldId: string): UploadItem[] =>
      request.uploads
        .filter((u) => (fieldId === PSEUDO ? true : u.fieldId === fieldId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [request.uploads]
  );

  const finished = isFinished(request.status);
  const readyIds = strip.filter((f) => f.state === "ready").map((f) => f.id as string);

  const [currentId, setCurrentId] = useState<string>(() => {
    const first = strip.find((f) => f.state === "ready") ?? strip.find((f) => f.state === "changes") ?? strip[0];
    return (first?.id as string) ?? PSEUDO;
  });
  const current = strip.find((f) => f.id === currentId) ?? strip[0];
  const currentField = fileFields.find((f) => f.id === currentId) ?? null;
  const currentUploads = uploadsFor(currentId);
  const submission = currentField ? request.fieldSubmissions?.[currentField.id] : undefined;
  const fieldComments = request.comments.filter((c) => (currentField ? c.fieldId === currentField.id : false));

  const [pickedUpload, setPickedUpload] = useState<Record<string, string>>({});
  const [allFiles, setAllFiles] = useState<Record<string, boolean>>({});
  const stageUpload =
    currentUploads.find((u) => u.id === pickedUpload[currentId]) ??
    currentUploads.find((u) => u.status === "PENDING") ??
    currentUploads[0] ??
    null;

  // ---------------------------------------------------------------- previews

  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [frameNotes, setFrameNotes] = useState<{ id: string; src: string; name: string } | null>(null);

  // Signed thumbnail URLs for the field on screen: JSON only. No image is
  // requested until a preview is revealed.
  useEffect(() => {
    const need = currentUploads.filter(
      (u) => thumbs[u.id] === undefined && (u.fileType.startsWith("image/") || u.fileType.startsWith("video/"))
    );
    if (need.length === 0) return;
    let live = true;
    Promise.all(
      need.map((u) =>
        fetch(`/api/uploads/${u.id}/thumbnail`)
          .then((r) => (r.ok ? r.json() : { url: null }))
          .then((d) => [u.id, (d?.url as string | null) ?? null] as const)
          .catch(() => [u.id, null] as const)
      )
    ).then((pairs) => {
      if (live) setThumbs((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      live = false;
    };
  }, [currentUploads, thumbs]);

  const isRevealed = (id: string) => showAll || revealed.has(id);
  const setRevealedFor = (id: string, v: boolean) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  // ---------------------------------------------------------------- side effects kept from before

  const handleExitEditMode = useCallback(() => {
    router.push(`/dashboard/requests/${request.id}`);
    router.refresh();
  }, [router, request.id]);

  useEffect(() => {
    if (isEditMode) return;
    fetch("/api/comments/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: initialRequest.id }),
    }).catch(() => {});
  }, [initialRequest.id, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    let live = true;
    fetch(`/api/requests/${request.id}/clone`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && setCloneHistory(d))
      .catch(() => {})
      .finally(() => live && setLoadingHistory(false));
    return () => {
      live = false;
    };
  }, [request.id, isEditMode]);

  const handleTitleUpdate = useCallback((t: string) => setRequest((p) => ({ ...p, title: t })), []);
  // Celebrate outside the state updater: updaters must stay pure, and the
  // celebration sets state in another component
  const handleStatusUpdate = useCallback(
    (newStatus: string) => {
      if (newStatus === "APPROVED" && request.status !== "APPROVED") {
        celebrateCustom({
          id: `request-approved-${request.id}`,
          title: "Request approved",
          description: "Every field is approved and the request is finished.",
          message: "The creator's submission is fully signed off.",
          confettiPreset: "normal",
          colorVariant: "success",
          dismissText: "Done",
        });
      }
      setRequest((prev) => ({ ...prev, status: newStatus }));
    },
    [celebrateCustom, request.id, request.status]
  );
  const handlePriorityUpdate = useCallback((p: string) => setRequest((prev) => ({ ...prev, urgency: p })), []);
  const handleDueDateUpdate = useCallback(
    (d: string | null) => setRequest((prev) => ({ ...prev, dueDate: d ? new Date(d) : null })),
    []
  );
  const handleUploadStatusChange = useCallback((uploadId: string, newStatus: string) => {
    setRequest((prev) => ({ ...prev, uploads: prev.uploads.map((u) => (u.id === uploadId ? { ...u, status: newStatus } : u)) }));
  }, []);

  // ---------------------------------------------------------------- review

  const [upNext, setUpNext] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState("");
  const [sendingChanges, setSendingChanges] = useState(false);
  const holds = useRef(new Map<string, ReturnType<typeof holdAction>>());
  const changesRef = useRef<HTMLTextAreaElement>(null);

  const targetFor = useCallback(
    (fieldId: string, req: Request): ReviewTarget => {
      const sub = fieldId === PSEUDO ? undefined : req.fieldSubmissions?.[fieldId];
      return {
        requestId: req.id,
        fieldId: fieldId === PSEUDO ? null : fieldId,
        submitted: !!sub && sub.status !== "PENDING",
        uploadIds: req.uploads
          .filter((u) => (fieldId === PSEUDO || u.fieldId === fieldId) && u.uploadStatus === "COMPLETED" && u.status === "PENDING")
          .map((u) => u.id),
      };
    },
    []
  );

  // Pending approvals are sent at once when the page goes away
  useEffect(() => {
    const map = holds.current;
    const flushAll = () => map.forEach((h) => h.flush());
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, []);

  const goTo = useCallback((id: string) => {
    setUpNext(null);
    setChangesOpen(false);
    setCurrentId(id);
  }, []);

  /** Approve one or more fields: applied on screen at once, sent after the Undo hold. */
  const approve = useCallback(
    (fieldIds: string[]) => {
      if (finished || fieldIds.length === 0) return;
      const snapshot = request;
      const targets = fieldIds.map((id) => targetFor(id, snapshot));
      const now = new Date().toISOString();
      setRequest((prev) => ({
        ...prev,
        fieldSubmissions: hasFileFields
          ? {
              ...(prev.fieldSubmissions || {}),
              ...Object.fromEntries(
                fieldIds.map((id) => [id, { ...(prev.fieldSubmissions?.[id] ?? {}), status: "APPROVED" as const, reviewedAt: now }])
              ),
            }
          : prev.fieldSubmissions,
        uploads: prev.uploads.map((u) =>
          u.uploadStatus === "COMPLETED" && (fieldIds.includes(PSEUDO) || (u.fieldId && fieldIds.includes(u.fieldId)))
            ? { ...u, status: "APPROVED" }
            : u
        ),
      }));
      setChangesOpen(false);

      const names = fieldIds.map((id) => strip.find((f) => f.id === id)?.name ?? "Field");
      const key = fieldIds.join("|");
      const hold = holdAction({
        message: fieldIds.length === 1 ? `Approving ${names[0]}` : `Approving ${fieldIds.length} fields`,
        onUndo: () => {
          holds.current.delete(key);
          setRequest((prev) => ({
            ...prev,
            fieldSubmissions: snapshot.fieldSubmissions,
            uploads: prev.uploads.map((u) => snapshot.uploads.find((s) => s.id === u.id) ?? u),
          }));
          setUpNext(null);
          setCurrentId(fieldIds[0]);
          toast.message("Approval undone. Nothing was sent.");
        },
        run: async (keepalive) => {
          holds.current.delete(key);
          let lastStatus: string | undefined;
          const failed: string[] = [];
          for (let i = 0; i < targets.length; i++) {
            const r = await approveTarget(targets[i], keepalive);
            if (!r.ok) failed.push(names[i]);
            else {
              if (r.requestStatus) lastStatus = r.requestStatus;
              const fid = targets[i].fieldId;
              if (r.fieldSubmission && fid) {
                const sub = r.fieldSubmission as FieldSubmission;
                setRequest((prev) => ({ ...prev, fieldSubmissions: { ...(prev.fieldSubmissions || {}), [fid]: sub } }));
              }
            }
          }
          if (failed.length > 0) {
            // Put the failed fields back the way they were
            const failedIds = fieldIds.filter((_, i) => failed.includes(names[i]));
            setRequest((prev) => ({
              ...prev,
              fieldSubmissions: {
                ...(prev.fieldSubmissions || {}),
                ...Object.fromEntries(
                  failedIds.filter((id) => id !== PSEUDO && snapshot.fieldSubmissions?.[id]).map((id) => [id, snapshot.fieldSubmissions![id]])
                ),
              },
              uploads: prev.uploads.map((u) =>
                failedIds.includes(PSEUDO) || (u.fieldId && failedIds.includes(u.fieldId))
                  ? (snapshot.uploads.find((s) => s.id === u.id) ?? u)
                  : u
              ),
            }));
            toast.error(`${failed.join(", ")} couldn't be approved. Try again from the field.`);
          }
          if (lastStatus) handleStatusUpdate(lastStatus);
          else if (failed.length === 0) router.refresh();
        },
      });
      holds.current.set(key, hold);
    },
    [finished, request, targetFor, hasFileFields, strip, handleStatusUpdate, router]
  );

  const approveCurrent = useCallback(() => {
    if (!current || finished || !canApprove) return;
    const id = current.id as string;
    if (current.state === "approved" || current.state === "waiting" || current.state === "overdue") return;
    approve([id]);
    // Up next: the next ready field after this one, wrapping round
    const order = strip.map((f) => f.id as string);
    const idx = order.indexOf(id);
    const rest = [...order.slice(idx + 1), ...order.slice(0, idx)];
    const next = rest.find((fid) => fid !== id && stateOf(fid) === "ready");
    if (next) setUpNext(next);
    else toast.message("Every ready field is reviewed", { description: "New uploads will show here as the creator sends them." });
  }, [current, finished, canApprove, approve, strip, stateOf]);

  const approveAllReady = () => {
    if (readyIds.length === 0 || !canApprove) return;
    approve(readyIds);
    setUpNext(null);
  };

  const sendChanges = async () => {
    const text = changesText.trim();
    if (!text || !current) return;
    setSendingChanges(true);
    const id = current.id as string;
    const result = await requestChangesTarget(targetFor(id, request), text);
    setSendingChanges(false);
    if (!result.ok) {
      toast.error(result.error ? `Changes weren't sent: ${result.error}` : "Changes weren't sent. Try again.");
      return;
    }
    toast.success(`Changes requested for ${current.name}`);
    setRequest((prev) => ({
      ...prev,
      fieldSubmissions:
        id !== PSEUDO
          ? {
              ...(prev.fieldSubmissions || {}),
              [id]: (result.fieldSubmission as FieldSubmission) ?? {
                ...(prev.fieldSubmissions?.[id] ?? {}),
                status: "NEEDS_REVISION",
                feedback: text,
                reviewedAt: new Date().toISOString(),
              },
            }
          : prev.fieldSubmissions,
      uploads: prev.uploads.map((u) =>
        (id === PSEUDO || u.fieldId === id) && u.uploadStatus === "COMPLETED" && u.status !== "APPROVED"
          ? { ...u, status: "REJECTED" }
          : u
      ),
    }));
    if (result.requestStatus) handleStatusUpdate(result.requestStatus);
    setChangesOpen(false);
    setChangesText("");
  };

  const openChanges = () => {
    if (finished || !current || currentUploads.length === 0 || !canAskChanges) return;
    setUpNext(null);
    setChangesText(submission?.feedback ?? "");
    setChangesOpen(true);
    requestAnimationFrame(() => changesRef.current?.focus());
  };

  const step = useCallback(
    (dir: 1 | -1) => {
      const order = strip.map((f) => f.id as string);
      const idx = order.indexOf(currentId);
      const next = order[(idx + dir + order.length) % order.length];
      if (next) goTo(next);
    },
    [strip, currentId, goTo]
  );

  // ---------------------------------------------------------------- keyboard
  // J/K come from the shortcut provider (keyboard-shortcut:next/prev in the
  // requests context). A and R are owned here; R straight after G is the
  // provider's "go to Requests" chord, so it is ignored.
  const lastKey = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  // The listeners read the latest handlers through a ref, so they subscribe once
  const keys = useRef({ step, approveCurrent, openChanges, upNext, changesOpen });
  useEffect(() => {
    keys.current = { step, approveCurrent, openChanges, upNext, changesOpen };
  });
  useEffect(() => {
    if (isEditMode) return;
    const onNext = () => keys.current.step(1);
    const onPrev = () => keys.current.step(-1);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const prev = lastKey.current;
      lastKey.current = { key, at: Date.now() };
      if (key === "escape") {
        if (keys.current.upNext) {
          setUpNext(null);
          e.preventDefault();
        } else if (keys.current.changesOpen) {
          setChangesOpen(false);
          e.preventDefault();
        }
        return;
      }
      if (isTyping(e.target)) return;
      if (key === "a") {
        e.preventDefault();
        keys.current.approveCurrent();
      } else if (key === "r") {
        if (prev.key === "g" && Date.now() - prev.at < 1200) return;
        e.preventDefault();
        keys.current.openChanges();
      }
    };
    window.addEventListener("keyboard-shortcut:next", onNext);
    window.addEventListener("keyboard-shortcut:prev", onPrev);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keyboard-shortcut:next", onNext);
      window.removeEventListener("keyboard-shortcut:prev", onPrev);
      window.removeEventListener("keydown", onKey);
    };
  }, [isEditMode]);

  // ---------------------------------------------------------------- edit mode

  if (isEditMode && can("requests.edit")) {
    return (
      <RequestEditor
        request={request as unknown as Parameters<typeof RequestEditor>[0]["request"]}
        onSave={handleExitEditMode}
        onCancel={handleExitEditMode}
      />
    );
  }

  // ---------------------------------------------------------------- derived copy

  // Only what the role may see reaches the browser; show what is there
  const contactLine = [request.creator.email, request.creator.phone].filter(Boolean).join(" · ");

  const requestForClone = {
    id: request.id,
    title: request.title,
    description: request.description,
    dueDate: request.dueDate ? new Date(request.dueDate).toISOString() : null,
    urgency: request.urgency,
    status: request.status,
    fields: request.fields,
    requirements: request.requirements,
    creator: request.creator,
    template: request.template,
  };

  const detailFields = (request.fields || []).filter((f) => f.type !== "file");
  const otherUploads = hasFileFields ? request.uploads.filter((u) => !u.fieldId) : [];
  const generalComments = request.comments.filter((c) => !c.fieldId);
  const completedAt = request.status === "APPROVED" ? request.reviewedAt : null;
  const firstName = request.creator.name.split(" ")[0];

  // History, built from what the page already holds: when it was sent and
  // opened, uploads per field and day, field reviews, the request's own
  // submit and sign-off, and the reminders that went out.
  const history: HistoryEvent[] = (() => {
    const out: HistoryEvent[] = [];
    const nameOf = (fid: string | null | undefined) =>
      (fid && strip.find((f) => f.id === fid)?.name) || "the request";
    out.push({ key: "sent", at: new Date(request.createdAt), text: "Request sent" });
    if (request.viewedAt) out.push({ key: "viewed", at: new Date(request.viewedAt), text: `Opened by ${firstName}` });
    const groups = new Map<string, { at: Date; n: number; fid: string | null }>();
    for (const u of request.uploads) {
      if (u.uploadStatus && u.uploadStatus !== "COMPLETED") continue;
      const at = new Date(u.uploadedAt ?? u.createdAt);
      const k = `${u.fieldId ?? ""}|${at.toDateString()}`;
      const g = groups.get(k);
      if (g) {
        g.n += 1;
        if (at > g.at) g.at = at;
      } else groups.set(k, { at, n: 1, fid: u.fieldId ?? null });
    }
    groups.forEach((g, k) => {
      const where = hasFileFields ? (g.fid ? ` to ${nameOf(g.fid)}` : " outside a field") : "";
      out.push({ key: `up-${k}`, at: g.at, text: `${g.n} ${g.n === 1 ? "file" : "files"} uploaded${where}` });
    });
    for (const [fid, sub] of Object.entries(request.fieldSubmissions ?? {})) {
      if (!sub?.reviewedAt) continue;
      if (sub.status === "APPROVED") out.push({ key: `rev-${fid}`, at: new Date(sub.reviewedAt), text: `${nameOf(fid)} approved` });
      else if (sub.status === "NEEDS_REVISION")
        out.push({ key: `rev-${fid}`, at: new Date(sub.reviewedAt), text: `Changes requested on ${nameOf(fid)}` });
    }
    if (request.submittedAt) out.push({ key: "submitted", at: new Date(request.submittedAt), text: `${firstName} submitted the request` });
    if (request.status === "APPROVED" && request.reviewedAt)
      out.push({ key: "approved", at: new Date(request.reviewedAt), text: "Request approved" });
    for (const r of request.reminders ?? []) {
      if (!r.sentAt) continue;
      out.push({
        key: `rem-${r.id}`,
        at: new Date(r.sentAt),
        text: `Reminder sent by ${r.channel === "SMS" ? "text" : "email"} (${REMINDER_WORD[r.type] ?? "reminder"})`,
      });
    }
    return out.filter((e) => !Number.isNaN(e.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());
  })();

  const metaFor = (id: string) => {
    const ups = uploadsFor(id);
    const st = stateOf(id);
    if (ups.length === 0) {
      const f = fileFields.find((x) => x.id === id);
      return f?.helpText || (f?.quantity ? `${f.quantity} ${f.quantityLabel ?? "files"} asked` : "Nothing uploaded yet");
    }
    const latest = ups[0];
    const when = latest.uploadedAt ?? latest.createdAt;
    const kinds = new Set(ups.map((u) => kindOf(u.fileType)));
    const what = `${ups.length} ${kinds.size === 1 ? (kinds.has("video") ? "video" : kinds.has("photo") ? "photo" : "file") : "file"}${ups.length === 1 ? "" : "s"}`;
    if (st === "approved") return `${what} · approved`;
    return `${what} · ${formatDay(when)}`;
  };

  const specLine = (() => {
    if (!currentField) return null;
    const parts: string[] = [];
    if (currentField.quantity) parts.push(`${currentField.quantity} ${currentField.quantityLabel ?? "files"}`);
    else if (currentField.minFiles || currentField.maxFiles)
      parts.push(`${currentField.minFiles ?? 1}${currentField.maxFiles ? ` to ${currentField.maxFiles}` : "+"} files`);
    const types = (currentField.acceptedFileTypes ?? []).map((t) =>
      t === "image/*" ? "photos" : t === "video/*" ? "videos" : t.replace(/^.*\//, "")
    );
    if (types.length) parts.push(types.join(" or "));
    parts.push(currentField.required ? "required" : "optional");
    return parts.join(" · ");
  })();

  const canReview = !finished && currentUploads.length > 0;
  const currentState = current?.state ?? "waiting";

  // ---------------------------------------------------------------- render

  return (
    <div className="pb-8">
      {/* Header */}
      <Link
        href="/dashboard/requests"
        className="inline-flex items-center gap-1 text-[14px] text-ink-2 underline-offset-[3px] hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Requests
      </Link>

      <div className="mt-2 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            <EditableRequestTitle requestId={request.id} title={request.title} onUpdate={handleTitleUpdate} size="lg" className="text-[28px] font-bold tracking-[-0.02em] md:text-[32px]" />
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
            <Link href={`/dashboard/creators/${request.creator.id}`} className="font-medium text-ink hover:underline">
              {request.creator.name}
            </Link>
            {request.template && (
              <>
                <span aria-hidden="true">·</span>
                <span>{request.template.name}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Sent {formatDay(request.createdAt)}</span>
            {request.dueDate && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatDue(request.dueDate)}</span>
                <span aria-hidden="true">·</span>
                <Countdown due={request.dueDate} completedAt={completedAt} />
              </>
            )}
            {finished && !request.dueDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-ink">{STATUS_WORD[request.status]}</span>
              </>
            )}
            {cloneHistory?.isClone && cloneHistory.clonedFrom && (
              <>
                <span aria-hidden="true">·</span>
                <Link href={`/dashboard/requests/${cloneHistory.clonedFrom.id}`} className="inline-flex items-center gap-1 hover:text-ink hover:underline">
                  <GitBranch className="size-3.5" aria-hidden="true" />
                  Cloned from {cloneHistory.clonedFrom.creator.name}&apos;s request
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!finished && canApprove && (
            <Button variant="outline" onClick={approveAllReady} disabled={readyIds.length === 0}>
              <Check className="size-4" />
              Approve all ready{readyIds.length > 0 ? ` (${readyIds.length})` : ""}
            </Button>
          )}
          {can("review.reveal") && (
            <Button variant="outline" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {showAll ? "Hide previews" : "Show previews"}
            </Button>
          )}
          <RequestActions request={request} onCloneClick={() => setCloneDialogOpen(true)} />
        </div>
      </div>

      {/* The field strip: the player's field selector */}
      {strip.length > 0 && (
        <div className="mt-5">
          <FieldSelector fields={strip} currentId={currentId} onSelect={goTo} />
        </div>
      )}

      <div className="mt-5 grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------------------------------------------------- the player */}
        <div className="min-w-0 space-y-8">
          <section aria-label={`Review ${current?.name ?? "uploads"}`} className="space-y-4">
            {stageUpload ? (
              <Stage
                upload={stageUpload as unknown as StageUpload}
                label={`${current?.name ?? "Upload"}, file ${currentUploads.indexOf(stageUpload) + 1}`}
                thumbUrl={thumbs[stageUpload.id]}
                revealed={isRevealed(stageUpload.id)}
                onRevealedChange={(v) => setRevealedFor(stageUpload.id, v)}
                onOpenFrameNotes={(src) => setFrameNotes({ id: stageUpload.id, src, name: stageUpload.originalName })}
              />
            ) : (
              <div className="flex aspect-[16/9] max-h-[40vh] min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-[10px] bg-well px-6 text-center">
                <p className="text-[15px] text-ink">Nothing uploaded to {current?.name ?? "this request"} yet.</p>
                <p className="text-[14px] text-ink-2">
                  {finished ? "This request finished without an upload here." : `${firstName} hasn't sent anything for this field. A reminder brings it to the top of their list.`}
                </p>
              </div>
            )}

            <UploadPicker
              uploads={currentUploads as unknown as StageUpload[]}
              currentId={stageUpload?.id ?? null}
              onSelect={(id) => setPickedUpload((p) => ({ ...p, [currentId]: id }))}
            />

            {/* Field spec and the upload on stage */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold leading-tight text-ink">{current?.name ?? "Uploads"}</h2>
                {specLine && <p className="mt-1 text-[15px] text-ink-2">{specLine}</p>}
                {currentField?.helpText && <p className="mt-0.5 text-[15px] text-ink-2">{currentField.helpText}</p>}
                {stageUpload && (
                  <p className="mt-1 text-[15px] text-ink-2">
                    {uploadFacts(stageUpload as unknown as StageUpload)} · uploaded{" "}
                    {formatDistanceToNow(new Date(stageUpload.uploadedAt ?? stageUpload.createdAt), { addSuffix: true })} ·{" "}
                    <span className="text-ink">{UPLOAD_STATUS_LABEL[stageUpload.status] ?? stageUpload.status}</span>
                  </p>
                )}
              </div>
              <p className="flex shrink-0 items-center gap-2 text-[15px] text-ink">
                <FieldCell state={currentState} />
                {FIELD_STATE_LABEL[currentState]}
              </p>
            </div>

            {currentState === "changes" && submission?.feedback && (
              <p className="rounded-[8px] bg-tile px-4 py-3 text-[15px] text-ink">
                <span className="text-changes">Changes requested:</span> {submission.feedback}
              </p>
            )}

            {/* Actions */}
            {finished ? (
              <p className="rounded-[8px] bg-tile px-4 py-3 text-[15px] text-ink-2">
                This request is {STATUS_WORD[request.status]?.toLowerCase()}, so it is read-only. Change its status from the menu to review again.
              </p>
            ) : upNext ? (
              <UpNextBar
                nextName={strip.find((f) => f.id === upNext)?.name ?? "Next field"}
                onGo={() => goTo(upNext)}
                onCancel={() => setUpNext(null)}
              />
            ) : changesOpen ? (
              <form
                className="space-y-2 rounded-[8px] bg-tile p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendChanges();
                }}
              >
                <label htmlFor="changes-note" className="block text-[14px] font-medium text-ink">
                  What should {firstName} change in {current?.name}?
                </label>
                <Textarea
                  id="changes-note"
                  ref={changesRef}
                  rows={3}
                  value={changesText}
                  onChange={(e) => setChangesText(e.target.value)}
                  placeholder="Say what to fix and how, e.g. two clips are too dark; reshoot them near the window."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendChanges();
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={!changesText.trim() || sendingChanges}>
                    {sendingChanges ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Send changes
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setChangesOpen(false)}>
                    Cancel <Kbd>Esc</Kbd>
                  </Button>
                  <span className="text-[13px] text-ink-2">{firstName} sees this note on the field.</span>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {canReview && canApprove && currentState !== "approved" && (
                  <Button onClick={approveCurrent} disabled={currentState === "waiting" || currentState === "overdue"}>
                    <Check className="size-4" />
                    {currentState === "changes" ? "Approve anyway" : "Approve"}
                    <Kbd>A</Kbd>
                  </Button>
                )}
                {canReview && canAskChanges && (
                  <Button variant="outline" onClick={openChanges}>
                    Request changes <Kbd>R</Kbd>
                  </Button>
                )}
                {!canReview && can("requests.remind") && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const res = await fetch("/api/requests/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "sendReminders", requestIds: [request.id] }),
                      });
                      const d = await res.json().catch(() => ({}));
                      if (res.ok && d.affected > 0) toast.success(`Reminder sent to ${firstName}`);
                      else toast.error(d.errors?.[0] ?? d.error ?? "The reminder wasn't sent. Try again.");
                    }}
                  >
                    <Bell className="size-4" />
                    Send a reminder
                  </Button>
                )}
                {strip.length > 1 && (
                  <div className="ml-auto flex gap-1">
                    <Button variant="outline" size="icon" aria-label="Previous field (K)" onClick={() => step(-1)}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Next field (J)" onClick={() => step(1)}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!finished && (
              <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2 md:flex">
                <span className="inline-flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> next and previous field</span>
                {canApprove && <span className="inline-flex items-center gap-1"><Kbd>A</Kbd> approve</span>}
                {canAskChanges && <span className="inline-flex items-center gap-1"><Kbd>R</Kbd> request changes</span>}
                <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> cancel</span>
                <span>Hold a preview, or press P on it, to peek</span>
              </p>
            )}
          </section>

          {/* Instructions and examples for this field */}
          {currentField?.richContent && (
            <FieldExamplesDisplay richContent={currentField.richContent} fieldLabel={currentField.label} variant="inline" />
          )}

          {/* Every file in this field, with per-file decisions */}
          {currentUploads.length > 0 && (
            <section aria-labelledby="field-files-h" className="space-y-3">
              <h2 id="field-files-h" className="text-[17px] font-semibold text-ink">
                Files in {current?.name ?? "this field"} <span className="font-normal text-ink-2">{currentUploads.length}</span>
              </h2>
              <UploadsList
                uploads={allFiles[currentId] ? currentUploads : currentUploads.slice(0, FILE_CAP)}
                requestId={request.id}
                onStatusChange={handleUploadStatusChange}
                readOnly={finished}
              />
              {currentUploads.length > FILE_CAP && (
                <Button variant="ghost" size="sm" onClick={() => setAllFiles((p) => ({ ...p, [currentId]: !p[currentId] }))}>
                  {allFiles[currentId] ? "Show fewer" : `Show all ${currentUploads.length} files`}
                </Button>
              )}
            </section>
          )}

          {/* Thread for this field */}
          {currentField && (
            <section aria-labelledby="field-thread-h" className="space-y-3">
              <h2 id="field-thread-h" className="text-[17px] font-semibold text-ink">
                Comments on {currentField.label} <span className="font-normal text-ink-2">{fieldComments.length}</span>
              </h2>
              <div className="rounded-[10px] bg-tile p-4">
                <CommentSection
                  key={currentField.id}
                  requestId={request.id}
                  fieldId={currentField.id}
                  comments={fieldComments}
                  currentUserId={userId}
                  compact
                  placeholder={`Comment on ${currentField.label}. Type @ to mention someone.`}
                  emptyText={`Nothing said about ${currentField.label} yet.`}
                />
              </div>
            </section>
          )}

          {otherUploads.length > 0 && (
            <section aria-labelledby="other-h" className="space-y-3">
              <h2 id="other-h" className="text-[17px] font-semibold text-ink">
                Uploads outside a field <span className="font-normal text-ink-2">{otherUploads.length}</span>
              </h2>
              <UploadsList uploads={otherUploads} requestId={request.id} onStatusChange={handleUploadStatusChange} readOnly={finished} />
            </section>
          )}

          <section aria-labelledby="discussion-h" className="space-y-3">
            <h2 id="discussion-h" className="text-[17px] font-semibold text-ink">
              Discussion <span className="font-normal text-ink-2">{generalComments.length}</span>
            </h2>
            <p className="-mt-1 text-[14px] text-ink-2">About the whole request. Feedback on one field belongs in that field&apos;s comments.</p>
            <div className="rounded-[10px] bg-tile p-4">
              <CommentSection
                requestId={request.id}
                comments={generalComments}
                currentUserId={userId}
                emptyText="Nothing about the whole request yet."
                composerFolded={!!currentField}
                composerLabel="Comment on the whole request"
              />
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------- the rail */}
        <aside className="min-w-0 space-y-8" aria-label="Request details">
          <section aria-labelledby="queue-h">
            <h2 id="queue-h" className="mb-3 text-[17px] font-semibold text-ink">{finished ? "Fields" : "Up next"}</h2>
            <UpNextQueue fields={strip} currentId={currentId} metaFor={metaFor} onSelect={goTo} finished={finished} />
          </section>

          <section aria-labelledby="details-h">
            <h2 id="details-h" className="mb-3 text-[17px] font-semibold text-ink">Details</h2>
            <dl className="divide-y divide-line rounded-[10px] bg-tile px-4 text-[14px]">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-ink-2">Creator</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <Avatar size="xs" user={{ name: request.creator.name, email: request.creator.email, image: request.creator.avatar }} />
                  <Link href={`/dashboard/creators/${request.creator.id}`} className="truncate text-ink hover:underline">
                    {request.creator.name}
                  </Link>
                </dd>
              </div>
              {request.template && (
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-ink-2">Template</dt>
                  <dd className="truncate text-ink">{request.template.name}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Status</dt>
                <dd>
                  {canEdit ? (
                    <EditableStatusBadge
                      requestId={request.id}
                      status={request.status}
                      onUpdate={handleStatusUpdate}
                      size="sm"
                      allowedStatuses={Object.keys(STATUS_WORD).filter(
                        (s) => s === request.status || (s === "APPROVED" ? canApprove : s === "NEEDS_REVISION" ? canAskChanges : s === "ARCHIVED" ? can("requests.archive") : true)
                      )}
                    />
                  ) : (
                    <span className="text-ink">{STATUS_WORD[request.status] ?? request.status}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Priority</dt>
                <dd>
                  {canEdit ? (
                    <EditablePriorityBadge requestId={request.id} priority={request.urgency} onUpdate={handlePriorityUpdate} size="sm" />
                  ) : (
                    <span className="text-ink">{request.urgency.charAt(0) + request.urgency.slice(1).toLowerCase()}</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2.5">
                <dt className="text-ink-2">Sent</dt>
                <dd className="text-ink">{formatStamp(request.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Due</dt>
                <dd className={cn("text-right", !finished && request.dueDate && new Date(request.dueDate) < new Date() ? "text-late" : "text-ink")}>
                  {canEdit ? (
                    <EditableDueDate requestId={request.id} dueDate={request.dueDate} onUpdate={handleDueDateUpdate} size="sm" />
                  ) : request.dueDate ? (
                    formatStamp(request.dueDate)
                  ) : (
                    "No due date"
                  )}
                </dd>
              </div>
              {request.submittedAt && (
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-ink-2">Submitted</dt>
                  <dd className="text-ink">{formatStamp(request.submittedAt)}</dd>
                </div>
              )}
              {request.reviewedAt && (
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-ink-2">Last reviewed</dt>
                  <dd className="text-ink">{formatStamp(request.reviewedAt)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 py-2.5">
                <dt className="text-ink-2">Fields</dt>
                <dd className="text-right text-ink">{fieldSummary(strip)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Request ID</dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(request.id).then(
                        () => toast.success("Request ID copied"),
                        () => toast.error("Couldn't copy. Select the ID and copy it by hand.")
                      );
                    }}
                    className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-[4px] font-mono text-[12px] text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-acc"
                    aria-label="Copy request ID"
                  >
                    <span className="truncate">{request.id}</span>
                    <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </dd>
              </div>
            </dl>
          </section>

          {(contactLine || can("messages.creators") || can("creators.view") || can("requests.create")) && (
          <section aria-labelledby="message-h">
            <h2 id="message-h" className="mb-3 text-[17px] font-semibold text-ink">Message {firstName}</h2>
            <div className="space-y-3 rounded-[10px] bg-tile p-4">
              {contactLine && <p className="text-[14px] text-ink-2">{contactLine}</p>}
              <div className="flex flex-wrap gap-2">
                {can("messages.creators") && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/messages?creatorId=${request.creator.id}`}>
                      <MessageSquare className="size-4" />
                      Open the thread
                    </Link>
                  </Button>
                )}
                {can("creators.view") && (
                  <Button variant="ghost" size="sm" onClick={() => openCreatorContext(request.creator.id)}>
                    <PanelRightOpen className="size-4" />
                    Creator context <Kbd>C</Kbd>
                  </Button>
                )}
                {can("requests.create") && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/requests/new?creatorId=${request.creator.id}`}>New request</Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
          )}

          {/* The brief */}
          {(request.description || detailFields.length > 0 || request.requirements?._richContent) && (
            <section aria-labelledby="brief-h" className="">
              <h2 id="brief-h" className="mb-3 text-[17px] font-semibold text-ink">The brief</h2>
              <div className="space-y-4 rounded-[10px] bg-tile p-4">
                {request.description && <HtmlContent html={request.description} />}
                {detailFields.length > 0 && (
                  <dl className="divide-y divide-line">
                    {detailFields.map((f, i) => (
                      <div key={f.id ?? i} className="flex justify-between gap-4 py-2 text-[14px]">
                        <dt className="text-ink-2">{f.label}</dt>
                        <dd className="text-right text-ink">{f.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {request.requirements?._richContent && (
                  <FieldExamplesDisplay richContent={request.requirements._richContent} fieldLabel="Request" variant="inline" />
                )}
              </div>
            </section>
          )}

          {/* History */}
          <section aria-labelledby="history-h">
            <h2 id="history-h" className="mb-3 text-[17px] font-semibold text-ink">History</h2>
            <div className="rounded-[10px] bg-tile p-4">
              <ol className="space-y-3">
                {(historyAll ? history : history.slice(0, HISTORY_CAP)).map((e) => (
                  <li key={e.key} className="grid grid-cols-[6px_minmax(0,1fr)] gap-x-3">
                    <span className="mt-[8px] size-1.5 rounded-full bg-icon" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[14px] text-ink">{e.text}</span>
                      <time dateTime={e.at.toISOString()} className="block text-[13px] text-ink-2">
                        {formatStamp(e.at)}
                      </time>
                    </span>
                  </li>
                ))}
              </ol>
              {history.length > HISTORY_CAP && (
                <Button variant="ghost" size="sm" className="-mx-2 mt-2" onClick={() => setHistoryAll((v) => !v)}>
                  {historyAll ? "Show less" : `Show all ${history.length} events`}
                </Button>
              )}
            </div>
          </section>

          {/* Secondary: watchers, internal notes and clones in one quiet group */}
          <section aria-labelledby="team-h">
            <h2 id="team-h" className="mb-3 text-[17px] font-semibold text-ink">For the team</h2>
            <div className="divide-y divide-line rounded-[10px] bg-tile px-4">
              <div className="py-3">
                <WatchersPanel
                  requestId={request.id}
                  watchers={watchers}
                  currentUserId={userId}
                  canManageWatchers={can("requests.edit")}
                  canRemoveWatchers={can("requests.watchers")}
                  onWatchersChange={setWatchers}
                />
              </div>
              <div className="py-3">
                <NotesPanel
                  entityType="request"
                  entityId={request.id}
                  initialNotes={notes}
                  currentUser={currentUser}
                  apiBasePath="/api/notes"
                  title="Internal notes"
                  description={`No notes. Only staff see these; ${firstName} never does.`}
                  onNotesChange={setNotes}
                  compact={true}
                />
              </div>
              <div className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-ink">
                    Clones{" "}
                    {cloneHistory && <span className="font-normal text-ink-2">{cloneHistory.clones.length}</span>}
                  </h3>
                  {can("requests.create") && (
                    <Button variant="ghost" size="sm" onClick={() => setCloneDialogOpen(true)}>
                      <GitBranch className="size-3.5" />
                      Clone
                    </Button>
                  )}
                </div>
                {loadingHistory ? (
                  <p className="flex items-center gap-2 text-[14px] text-ink-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Loading clones
                  </p>
                ) : cloneHistory && cloneHistory.clones.length > 0 ? (
                  <ul className="-mx-2 space-y-0.5">
                    {cloneHistory.clones.slice(0, 5).map((clone) => (
                      <li key={clone.id}>
                        <Link
                          href={`/dashboard/requests/${clone.id}`}
                          className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-[14px] hover:bg-tile-hi"
                        >
                          <span className="truncate text-ink">{clone.creator.name}</span>
                          <span className="shrink-0 text-ink-2">
                            {STATUS_WORD[clone.status] ?? clone.status} · {formatDay(clone.createdAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {cloneHistory.clones.length > 5 && (
                      <li className="px-2 text-[13px] text-ink-2">and {cloneHistory.clones.length - 5} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-[14px] text-ink-2">Not cloned. Cloning sends the same brief to another creator.</p>
                )}
              </div>
            </div>
          </section>

        </aside>
      </div>

      <CloneRequestDialog
        request={requestForClone}
        creators={creators}
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onCloneSuccess={(ids) => {
          toast.success(ids.length === 1 ? "Request cloned" : `${ids.length} requests cloned`);
          fetch(`/api/requests/${request.id}/clone`)
            .then((r) => r.json())
            .then(setCloneHistory)
            .catch(() => {});
        }}
      />

      {frameNotes && (
        <VideoReviewPanel
          uploadId={frameNotes.id}
          videoSrc={frameNotes.src}
          fileName={frameNotes.name}
          open={!!frameNotes}
          onOpenChange={(o) => !o && setFrameNotes(null)}
          currentUser={{ id: currentUser.id, name: currentUser.name }}
        />
      )}
    </div>
  );
}

