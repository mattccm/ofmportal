"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { PerFieldUpload, type CreatorField } from "@/components/portal/per-field-upload";
import { RequestCover } from "@/components/portal/request-cover";
import { FieldCell, StateWord, useViewerTimeZone } from "@/components/title-wall";
import { creatorSummary, sentLine, toStrip } from "@/components/portal/creator-words";
import {
  computeCreatorFieldStates,
  fieldKey,
  isCreatorTextField,
} from "@/lib/creator-field-states";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { TemplateField, RichContent } from "@/lib/template-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DuplicateWarningDialog,
  DuplicateAlert,
} from "@/components/uploads/duplicate-warning";
import type { DuplicateCheckResult } from "@/lib/duplicate-detection";
import type { DuplicateCheckResult as FingerprintCheckResult } from "@/types/content-fingerprint";
import { resolveMimeType } from "@/lib/file-utils";
import { stripImageLocation } from "@/lib/image-privacy";
import { isRequestOverdue } from "@/lib/request-status";
import { Loader2, ChevronLeft, ChevronDown, ChevronUp, Send, MapPinOff, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HtmlContent } from "@/components/ui/html-content";

interface RequestField {
  id?: string;
  label: string;
  value: string;
  type: string;
  richContent?: TemplateField["richContent"];
  required?: boolean;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  minFiles?: number;
  maxFileSize?: number;
  helpText?: string;
  quantity?: number;
  filledByCreator?: boolean;
}

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** The due day everyone sees */
  dueOn?: string | null;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  requirements: Record<string, unknown> & {
    _richContent?: RichContent;
  };
  fields: RequestField[];
  fieldSubmissions?: Record<string, FieldSubmission>;
}

interface UploadFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  uploadStatus: string;
  thumbnailUrl?: string;
  storageKey?: string;
  fieldId?: string | null;
  reviewNote?: string | null;
  createdAt?: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  fieldId?: string | null;
  user?: {
    name: string;
    image?: string;
  };
  isAgency: boolean;
}

// Files up to this size are hashed whole; larger ones hash the first and last
// 8MB plus the size. Used for both the duplicate check and stored fingerprints.
const FULL_HASH_LIMIT = 100 * 1024 * 1024;
const EDGE_HASH_BYTES = 8 * 1024 * 1024;
const fileHashCache = new WeakMap<File, Promise<string | null>>();

function getFileHash(file: File): Promise<string | null> {
  let pending = fileHashCache.get(file);
  if (!pending) {
    pending = (async () => {
      if (typeof crypto === "undefined" || !crypto.subtle) return null;
      try {
        const data =
          file.size <= FULL_HASH_LIMIT
            ? await file.arrayBuffer()
            : await new Blob([
                file.slice(0, EDGE_HASH_BYTES),
                file.slice(file.size - EDGE_HASH_BYTES),
                String(file.size),
              ]).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch (error) {
        console.warn("Could not hash file for duplicate detection:", error);
        return null;
      }
    })();
    fileHashCache.set(file, pending);
  }
  return pending;
}

// Record a fingerprint for a finished upload so later uploads can be checked against it
async function storeFingerprint(file: File, uploadId: string): Promise<void> {
  const fileHash = await getFileHash(file);
  if (!fileHash || file.size < 1) return;
  try {
    const token = localStorage.getItem("creatorToken");
    const response = await fetch("/api/uploads/fingerprint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-creator-token": token || "",
      },
      body: JSON.stringify({
        uploadId,
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        mimeType: resolveMimeType(file.name, file.type),
      }),
    });
    if (!response.ok) {
      console.warn("Failed to store upload fingerprint:", response.status);
    }
  } catch (error) {
    console.warn("Failed to store upload fingerprint:", error);
  }
}

// Map the check-duplicate API response onto the shape the warning UI renders
function toDuplicateDisplayResult(result: FingerprintCheckResult): DuplicateCheckResult {
  const matches = result.matches.map((m) => ({
    type:
      m.matchType === "exact"
        ? ("exact_hash" as const)
        : m.matchType === "near"
          ? ("possible_version" as const)
          : ("similar_filename" as const),
    confidence: m.confidence / 100,
    existingUploadId: m.originalUploadId,
    existingFileName: m.originalFileName || "Previous upload",
    existingFileSize: BigInt(m.originalFileSize ?? 0),
    existingCreatorId: "",
    existingRequestId: m.originalRequestId,
    existingUploadedAt: m.originalUploadedAt ? new Date(m.originalUploadedAt) : null,
    matchDetails: m.originalRequestName
      ? `Submitted for "${m.originalRequestName}"`
      : m.hashMatch
        ? "Identical file content"
        : "Similar content",
  }));
  return {
    isDuplicate: result.isDuplicate,
    matches,
    highestConfidence: matches[0]?.confidence ?? 0,
    recommendedAction: "review",
  };
}

export default function CreatorRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const router = useRouter();
  const tz = useViewerTimeZone();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  // Approved, cancelled or archived: the request has left the portal
  const [finished, setFinished] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [, setCreator] = useState<{
    id: string;
    name: string;
    email: string;
    image?: string;
  } | null>(null);

  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFieldId, setPendingFieldId] = useState<string | undefined>(undefined);
  const [duplicateProcessing, setDuplicateProcessing] = useState(false);
  const [duplicateAlertResult, setDuplicateAlertResult] = useState<{ result: DuplicateCheckResult; fileName: string } | null>(null);

  // UI state - must be at top level before any conditionals
  const [showInstructions, setShowInstructions] = useState(true);
  // Page-level "Show previews": off by default, nothing loads until asked
  const [showPreviews, setShowPreviews] = useState(false);

  // Video thumbnails are generated after the upload finishes, so they aren't
  // ready the moment the upload POST resolves. Track pending poll timers so we
  // can always clear them on unmount.
  const thumbnailPollTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const {
    queue: uploadQueue,
    addFiles,
    pauseFile,
    resumeFile,
    retryFile,
    cancelFile,
    removeFile,
    clearCompleted,
    pauseAll,
    resumeAll,
    isUploading,
    totalProgress,
    totalSize,
    uploadedSize,
  } = useFileUpload({
    requestId,
    maxConcurrent: 3,
    onUploadComplete: (file) => {
      fetchData();
      if (file.uploadId) {
        storeFingerprint(file.file, file.uploadId);
      }
      if (file.uploadId && file.file.type.startsWith("video/")) {
        pollThumbnail(file.uploadId);
      }
    },
    onAllComplete: () => {},
  });

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (response.status === 410) {
        setFinished(true);
        setRequest(null);
        return;
      }
      if (response.status === 404) {
        setRequest(null);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch request");
      }

      const data = await response.json();
      setRequest(data.request);
      setUploads(data.uploads || []);
      setComments(data.comments || []);
    } catch (error) {
      console.error("Error fetching request:", error);
      toast.error("This request didn't load. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  // Poll the thumbnail endpoint until the video's generated thumbnail is
  // available, then patch it into local state so it renders without a manual
  // refresh. Bounded attempts with backoff so it always stops.
  const pollThumbnail = useCallback((uploadId: string) => {
    const delays = [1000, 1500, 2500, 3000, 3000]; // ~11s across 5 attempts
    let attempt = 0;

    const schedule = () => {
      if (attempt >= delays.length) return;
      const delay = delays[attempt++];
      const timer = setTimeout(async () => {
        thumbnailPollTimers.current.delete(timer);
        let resolved = false;
        try {
          const token = localStorage.getItem("creatorToken");
          const response = await fetch(`/api/uploads/${uploadId}/thumbnail`, {
            headers: { "x-creator-token": token || "" },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.url) {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadId ? { ...u, thumbnailUrl: data.url } : u
                )
              );
              resolved = true;
            }
          }
        } catch {
          // Network error - fall through to retry.
        }
        if (!resolved) schedule();
      }, delay);
      thumbnailPollTimers.current.add(timer);
    };

    schedule();
  }, []);

  // On a desktop, a file dropped beside a field (not on it) would make the
  // browser open it in this tab and leave the page mid-upload. Swallow it.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const guard = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);

  // Clear any pending poll timers on unmount.
  useEffect(() => {
    const timers = thumbnailPollTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");
    const name = localStorage.getItem("creatorName");
    const email = localStorage.getItem("creatorEmail");
    const avatar = localStorage.getItem("creatorAvatar");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    setCreator({
      id: creatorId,
      name: name || "Creator",
      email: email || "",
      image: avatar || undefined,
    });

    fetchData();
  }, [router, fetchData]);

  const checkDuplicates = async (file: File): Promise<FingerprintCheckResult | null> => {
    const token = localStorage.getItem("creatorToken");
    try {
      const fileHash = await getFileHash(file);
      if (!fileHash || file.size < 1) {
        return null;
      }

      const response = await fetch("/api/uploads/check-duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({
          requestId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: resolveMimeType(file.name, file.type),
          fileHash,
        }),
      });

      if (!response.ok) {
        console.warn("Duplicate check failed:", response.status, await response.text().catch(() => ""));
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return null;
    }
  };

  const handleDuplicateReplace = async () => {
    if (pendingFiles.length === 0) return;
    setDuplicateProcessing(true);
    addFiles(pendingFiles, pendingFieldId);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleDuplicateKeepBoth = async () => {
    if (pendingFiles.length === 0) return;
    setDuplicateProcessing(true);
    addFiles(pendingFiles, pendingFieldId);
    setDuplicateProcessing(false);
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingFiles([]);
    setPendingFieldId(undefined);
    setDuplicateResult(null);
  };

  const handleFilesSelected = async (files: FileList | File[], fieldId?: string) => {
    const fileArray = Array.from(files);

    // Every creator upload enters here (per-field and fallback dropzones).
    // Check every file (sequentially, to bound memory while hashing). Likely
    // duplicates are held for the dialog; everything else uploads right away.
    const flagged: File[] = [];
    const clean: File[] = [];
    let flaggedResult: FingerprintCheckResult | null = null;
    let alert: { result: FingerprintCheckResult; fileName: string } | null = null;

    for (const selected of fileArray) {
      // Remove GPS location from photos first: everything after this (the
      // duplicate hash, the upload, the stored fingerprint) must use the
      // stripped bytes so the hash matches what the server stores.
      const file = await stripImageLocation(selected);
      const duplicateCheck = await checkDuplicates(file);

      if (
        duplicateCheck &&
        duplicateCheck.isDuplicate &&
        (duplicateCheck.recommendation === "block" ||
          (duplicateCheck.matches[0]?.confidence ?? 0) >= 70)
      ) {
        flagged.push(file);
        flaggedResult = flaggedResult ?? duplicateCheck;
      } else {
        if (duplicateCheck && duplicateCheck.isDuplicate && !alert) {
          alert = { result: duplicateCheck, fileName: file.name };
        }
        clean.push(file);
      }
    }

    if (alert) {
      setDuplicateAlertResult({
        result: toDuplicateDisplayResult(alert.result),
        fileName: alert.fileName,
      });
      setTimeout(() => setDuplicateAlertResult(null), 5000);
    }

    if (clean.length > 0) {
      addFiles(clean, fieldId);
    }

    if (flagged.length > 0 && flaggedResult) {
      setPendingFiles(flagged);
      setPendingFieldId(fieldId);
      setDuplicateResult(toDuplicateDisplayResult(flaggedResult));
      setDuplicateDialogOpen(true);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/submit`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      toast.success("Submitted for review. You'll get a notification when it's reviewed.");
      fetchData();
    } catch {
      toast.error("This didn't submit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSendingComment(true);
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-creator-token": token || "",
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) {
        throw new Error("Failed to send comment");
      }

      setNewComment("");
      toast.success("Message sent");
      fetchData();
    } catch {
      toast.error("Your message didn't send. Try again.");
    } finally {
      setSendingComment(false);
    }
  };

  const handleReplyToField = async (fieldId: string, content: string) => {
    const token = localStorage.getItem("creatorToken");
    const response = await fetch(`/api/portal/requests/${requestId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-creator-token": token || "",
      },
      body: JSON.stringify({ content, fieldId }),
    });

    if (!response.ok) {
      toast.error("Failed to send reply");
      throw new Error("Failed to send reply");
    }

    toast.success("Reply sent");
    await fetchData();
  };

  if (loading) {
    return (
      <div className="px-4 pt-4" role="status" aria-label="Loading the request">
        <Skeleton className="h-11 w-28" />
        <div className="mt-2 rounded-[10px] bg-tile p-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-5 h-10 w-40" />
          <Skeleton className="mt-5 h-3 w-full" />
        </div>
        <Skeleton className="mt-6 h-40 w-full" />
        <Skeleton className="mt-3 h-40 w-full" />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="px-4 pt-6 lg:px-6 lg:pt-10">
        <div className="max-w-[560px] rounded-[var(--tw-r-tile)] bg-tile p-5 lg:p-6">
          <span className="grid size-10 place-items-center rounded-full bg-tile-hi" aria-hidden="true">
            <Check className="size-5 text-ink" />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.01em]">
            This request is finished
          </h1>
          <p className="mt-2 text-[15px] leading-normal text-ink-2">
            There&apos;s nothing more to do here. Finished requests leave your portal, so your list only shows
            what still needs you.
          </p>
          <Button asChild className="mt-5 h-11 md:h-9">
            <Link href="/creator/dashboard">Go to your requests</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="px-4 pt-6 lg:px-6 lg:pt-10">
        <h1 className="text-[22px] font-semibold leading-tight">This request isn&apos;t available</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-normal text-ink-2">
          It may have been closed, or the link is out of date. Your other requests are on your home screen.
        </p>
        <Button asChild variant="outline" className="mt-4 h-11 md:h-9">
          <Link href="/creator/dashboard">Go to your requests</Link>
        </Button>
      </div>
    );
  }

  const canUpload =
    request.status === "PENDING" ||
    request.status === "IN_PROGRESS" ||
    request.status === "NEEDS_REVISION";

  const hasActiveUploads = uploadQueue.some(
    (f) => f.status === "uploading" || f.status === "pending" || f.status === "paused"
  );

  const canSubmit = canUpload && uploads.length > 0 && !hasActiveUploads;
  const overdue = isRequestOverdue(request);

  // The creator's fields, in the request's order: file fields and the written
  // answers asked for. Text the team filled in is instructions (Details).
  const allFields = request.fields || [];
  const fieldRows = computeCreatorFieldStates({
    fields: allFields,
    fieldSubmissions: request.fieldSubmissions,
    uploads,
    requestStatus: request.status,
    overdue,
  });
  const states = Object.fromEntries(fieldRows.map((r) => [r.id, r.state]));
  const unsentFields = Object.fromEntries(fieldRows.map((r) => [r.id, r.unsent]));
  const creatorFields: CreatorField[] = allFields
    .filter((f) => f.type === "file" || isCreatorTextField(f))
    .map((f) => ({
      id: fieldKey(f),
      label: f.label,
      type: f.type === "file" ? ("file" as const) : ("text" as const),
      required: f.required,
      acceptedFileTypes: f.acceptedFileTypes,
      maxFiles: f.maxFiles,
      minFiles: f.minFiles,
      quantity: f.quantity,
      maxFileSize: f.maxFileSize,
      helpText: f.helpText,
      richContent: f.richContent,
      value: f.value,
    }));
  const infoFields = allFields.filter((f) => f.type !== "file" && !isCreatorTextField(f));
  const fileFields = allFields.filter((f) => f.type === "file");
  const hasFileFields = fileFields.length > 0;

  // Section-scoped feedback is rendered inline within each field. General
  // comments are those with no field, plus any whose field is no longer shown.
  const fieldIds = new Set(creatorFields.map((f) => f.id));
  const generalComments = comments.filter((c) => !c.fieldId || !fieldIds.has(c.fieldId));

  const inReview = request.status === "SUBMITTED" || request.status === "UNDER_REVIEW";
  const left = fieldRows.filter((r) => r.state === "waiting" || r.state === "overdue" || r.state === "changes").length;

  const submitHint = hasActiveUploads
    ? "Uploading. Submit when it finishes."
    : uploads.length === 0
      ? "Upload something to submit."
      : left === 0
        ? "Everything is in."
        : left === 1
          ? "1 field still to do. You can submit what you have."
          : `${left} fields still to do. You can submit what you have.`;

  const rc = request.requirements?._richContent;
  const instructionsLabel = rc?.instructionsLabel || "The brief";
  const canToggle = rc?.showInstructionsToggle !== false;

  // Handler for deleting uploads
  const handleDeleteUpload = async (uploadId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: "DELETE",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete upload");
      }

      toast.success("File deleted");
      fetchData();
    } catch {
      toast.error("That file didn't delete. Check your connection and try again.");
    }
  };

  // Handler for per-field submit
  const handleFieldSubmit = async (fieldId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/fields/${fieldId}/submit`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit field");
      }

      toast.success("Submitted for review");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That field didn't submit. Try again.");
    }
  };

  // Handler for redacting a field submission
  const handleFieldRedact = async (fieldId: string) => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests/${requestId}/fields/${fieldId}/redact`, {
        method: "POST",
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to redact submission");
      }

      toast.success("Taken back. You can change it now.");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work. Try again.");
    }
  };

  // Save a written answer (captions, notes)
  const handleSaveText = async (fieldId: string, value: string) => {
    const token = localStorage.getItem("creatorToken");
    const response = await fetch(`/api/portal/requests/${requestId}/fields/${encodeURIComponent(fieldId)}/value`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-creator-token": token || "" },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Your answer didn't save. Try again.");
    }
    toast.success("Saved");
    await fetchData();
  };

  const submitButton = (className?: string) => (
    <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className={className}>
      {submitting ? <Loader2 className="animate-spin" /> : <Send />}
      Submit
    </Button>
  );

  return (
    <div className="px-4 pt-2 lg:px-6 lg:pt-6">
      <Link
        href="/creator/requests"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-[15px] text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Requests
      </Link>

      {/* From 1024px: the fields and uploads on the left, a sticky progress and Submit panel on the right */}
      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <RequestCover
            className="mt-1 lg:mt-0"
            size="lg"
            headingLevel="h1"
            headingId="request-title"
            title={request.title}
            sentText={sentLine(request.createdAt, tz)}
            due={request.dueDate}
            dueOn={request.dueOn}
            statusText={inReview ? "Submitted for review" : undefined}
            fields={toStrip(fieldRows)}
            summary={creatorSummary(fieldRows)}
          />

          {hasFileFields && canUpload && (
            <div className="mt-4 flex items-start gap-2.5 text-[14px] leading-normal text-ink-2">
              <MapPinOff className="mt-0.5 size-4 shrink-0 text-icon" aria-hidden="true" />
              <p>
                Location data is removed from photos automatically. For videos, turn location off in your camera before
                you film.
              </p>
            </div>
          )}

          {request.status === "NEEDS_REVISION" && (
            <p className="mt-4 rounded-[var(--tw-r-ctl)] bg-tile px-3 py-2.5 text-[15px] leading-normal">
              <span className="font-semibold text-changes">Needs changes.</span> The fields that need a new take
              say what to change.
            </p>
          )}

          {request.description && (
            <section aria-labelledby="asked-h" className="mt-6">
              {canToggle ? (
                <h2 id="asked-h" className="text-[17px] font-semibold leading-snug">
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    aria-expanded={showInstructions}
                    className="-mx-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9"
                  >
                    {instructionsLabel}
                    {showInstructions ? (
                      <ChevronUp className="size-4 text-icon" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4 text-icon" aria-hidden="true" />
                    )}
                  </button>
                </h2>
              ) : (
                <h2 id="asked-h" className="min-h-11 py-2 text-[17px] font-semibold leading-snug">
                  {instructionsLabel}
                </h2>
              )}
              {(showInstructions || !canToggle) && (
                <div className="mt-1 rounded-[var(--tw-r-tile)] bg-tile p-4">
                  <HtmlContent html={request.description} className="max-w-[70ch] text-[15px] leading-relaxed text-ink" />
                  {rc && <FieldExamplesDisplay richContent={rc} fieldLabel="Request" variant="card" className="mt-3" />}
                </div>
              )}
            </section>
          )}

          {infoFields.length > 0 && (
            <section aria-labelledby="details-h" className="mt-6">
              <h2 id="details-h" className="mb-2 text-[17px] font-semibold leading-snug">
                Details
              </h2>
              <dl className="divide-y divide-line rounded-[var(--tw-r-tile)] bg-tile px-4 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0">
                {infoFields.map((field, index) => (
                  <div key={field.id || index} className="py-3 lg:border-b lg:border-line lg:[&:nth-last-child(-n+2)]:border-b-0">
                    <dt className="text-[14px] text-ink-2">{field.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[15px] leading-normal">{field.value || "Not set"}</dd>
                    {field.richContent && (
                      <FieldExamplesDisplay richContent={field.richContent} fieldLabel={field.label} className="mt-2" />
                    )}
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Duplicate Warning Dialog */}
          {duplicateResult && pendingFiles.length > 0 && (
            <DuplicateWarningDialog
              open={duplicateDialogOpen}
              onOpenChange={setDuplicateDialogOpen}
              result={duplicateResult}
              newFile={{
                name: pendingFiles[0].name,
                size: pendingFiles[0].size,
                type: resolveMimeType(pendingFiles[0].name, pendingFiles[0].type),
              }}
              onReplace={handleDuplicateReplace}
              onKeepBoth={handleDuplicateKeepBoth}
              onCancel={handleDuplicateCancel}
              isProcessing={duplicateProcessing}
            />
          )}

          {creatorFields.length > 0 && (
            <section aria-labelledby="fields-h" className="mt-6">
              <div className="mb-2 flex min-h-11 items-center gap-3">
                <h2 id="fields-h" className="flex-1 text-[17px] font-semibold leading-snug">
                  {canUpload ? "What to send" : "What you sent"}
                  <span className="ml-2 text-[14px] font-normal text-ink-2">{creatorFields.length}</span>
                </h2>
                {uploads.length > 0 && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] text-ink-2">
                    Show previews
                    <Switch aria-label="Show previews" checked={showPreviews} onCheckedChange={(v) => setShowPreviews(!!v)} />
                  </label>
                )}
              </div>

              {duplicateAlertResult && (
                <DuplicateAlert
                  result={duplicateAlertResult.result}
                  fileName={duplicateAlertResult.fileName}
                  onDismiss={() => setDuplicateAlertResult(null)}
                />
              )}

              <PerFieldUpload
                fields={creatorFields}
                states={states}
                uploads={uploads}
                queue={uploadQueue}
                fieldSubmissions={request.fieldSubmissions}
                unsent={unsentFields}
                onFilesSelected={handleFilesSelected}
                onPause={pauseFile}
                onResume={resumeFile}
                onRetry={retryFile}
                onCancel={cancelFile}
                onRemove={removeFile}
                onClearCompleted={clearCompleted}
                onPauseAll={pauseAll}
                onResumeAll={resumeAll}
                onFieldSubmit={handleFieldSubmit}
                onFieldRedact={handleFieldRedact}
                onDeleteUpload={handleDeleteUpload}
                onSaveText={handleSaveText}
                isUploading={isUploading}
                canUpload={canUpload}
                previewsRevealed={showPreviews}
                comments={comments}
                onReplyToField={handleReplyToField}
              />
            </section>
          )}

          {/* Fallback: one upload area when the request lists no file fields */}
          {canUpload && !hasFileFields && (
            <section aria-labelledby="upload-h" className="mt-6 space-y-3">
              <h2 id="upload-h" className="text-[17px] font-semibold leading-snug">
                Upload your content
              </h2>

              {duplicateAlertResult && !creatorFields.length && (
                <DuplicateAlert
                  result={duplicateAlertResult.result}
                  fileName={duplicateAlertResult.fileName}
                  onDismiss={() => setDuplicateAlertResult(null)}
                />
              )}

              <FileDropzone onFilesSelected={handleFilesSelected} fullPageDrop={true} showPasteButton={true} />

              {uploadQueue.length > 0 && (
                <UploadQueue
                  queue={uploadQueue}
                  onPause={pauseFile}
                  onResume={resumeFile}
                  onRetry={retryFile}
                  onCancel={cancelFile}
                  onRemove={removeFile}
                  onClearCompleted={clearCompleted}
                  onPauseAll={pauseAll}
                  onResumeAll={resumeAll}
                  totalProgress={totalProgress}
                  totalSize={totalSize}
                  uploadedSize={uploadedSize}
                  isUploading={isUploading}
                  collapsible={true}
                  maxVisibleItems={5}
                />
              )}
            </section>
          )}

          {inReview && (
            <p className="mt-6 rounded-[var(--tw-r-tile)] bg-tile p-4 text-[15px] leading-normal lg:hidden">
              <span className="font-semibold">In review.</span>{" "}
              <span className="text-ink-2">You&apos;ll get a notification when it&apos;s approved or a new take is needed.</span>
            </p>
          )}

          {/* Messages about this request */}
          <section aria-labelledby="talk-h" className="mt-8">
            <h2 id="talk-h" className="text-[17px] font-semibold leading-snug">
              Messages about this request
            </h2>
            {generalComments.length === 0 ? (
              <p className="mt-1 text-[14px] leading-normal text-ink-2">
                Nothing yet. Ask your team here if anything in this request is unclear.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {generalComments.map((comment) => (
                  <li key={comment.id} className={cn("flex flex-col", comment.isAgency ? "items-start" : "items-end")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[10px] px-3.5 py-2.5 lg:max-w-[70%]",
                        comment.isAgency ? "bg-tile" : "bg-tile-hi"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-normal">{comment.content}</p>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">
                      {comment.isAgency ? comment.user?.name || "Your team" : "You"} ·{" "}
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendComment();
              }}
            >
              <label htmlFor="request-message" className="sr-only">
                Message your team about this request
              </label>
              <Textarea
                id="request-message"
                rows={1}
                placeholder="Write a message"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-11 resize-none"
              />
              <Button type="submit" variant="outline" className="h-11 shrink-0" disabled={!newComment.trim() || sendingComment}>
                {sendingComment ? <Loader2 className="animate-spin" /> : <Send />}
                Send
              </Button>
            </form>
          </section>
        </div>

        {/* Desktop: progress by field (each a jump link) and the one Submit, kept in view */}
        <aside aria-labelledby="progress-h" className="hidden lg:sticky lg:top-6 lg:block">
          <div className="rounded-[var(--tw-r-tile)] bg-tile p-5">
            <h2 id="progress-h" className="text-[17px] font-semibold leading-snug">
              Your progress
            </h2>
            <p className="mt-0.5 text-[14px] leading-normal text-ink-2">{creatorSummary(fieldRows)}</p>
            {fieldRows.length > 0 && (
              <ol className="-mx-2 mt-3 space-y-0.5">
                {fieldRows.map((row) => {
                  return (
                    <li key={row.id}>
                      <a
                        href={`#field-${row.id}`}
                        className="flex min-h-9 items-center gap-3 rounded-md px-2 text-[14px] transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <FieldCell state={row.state} name={row.name} audience="creator" unsent={row.unsent} />
                        <span className="min-w-0 flex-1 truncate">{row.name}</span>
                        <StateWord state={row.state} unsent={row.unsent} audience="creator" />
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}

            {canUpload ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[14px] leading-snug text-ink-2" aria-live="polite">
                  {submitHint}
                </p>
                {submitButton("mt-3 h-11 w-full text-[15px]")}
              </div>
            ) : inReview ? (
              <p className="mt-4 border-t border-line pt-4 text-[14px] leading-normal text-ink-2">
                <span className="font-semibold text-ink">In review.</span> You&apos;ll get a notification when it&apos;s
                approved or a new take is needed.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Phone and tablet: a sticky Submit bar above the tab bar, clear of the safe areas */}
      {canUpload && (
        <div className="lg:hidden">
          <div aria-hidden="true" className="h-24" />
          <div className="fixed inset-x-0 z-30 border-t border-line bg-ground bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:pb-[env(safe-area-inset-bottom,0px)]">
            <div className="mx-auto flex max-w-[560px] items-center gap-3 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:max-w-[720px]">
              <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink-2" aria-live="polite">
                {submitHint}
              </p>
              {submitButton("h-12 shrink-0 px-6 text-[15px]")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
