"use client";

import * as React from "react";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Check,
  Maximize2,
  Trash2,
  Send,
  Loader2,
  Undo2,
  Play,
  FileText,
  Music,
} from "lucide-react";
import type { QueuedFile } from "@/hooks/use-file-upload";
import type { TemplateField } from "@/lib/template-types";
import type { CreatorFieldState } from "@/lib/creator-field-states";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";
import { DiscreetPreview, FieldCell, StateWord, formatDay, useViewerTimeZone } from "@/components/title-wall";

interface SectionComment {
  id: string;
  content: string;
  createdAt: string;
  fieldId?: string | null;
  user?: { name: string; image?: string };
  isAgency: boolean;
}

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fieldId?: string | null;
  thumbnailUrl?: string;
  storageKey?: string;
  status?: string;
  reviewNote?: string | null;
  createdAt?: string;
}

export interface CreatorField {
  id: string;
  label: string;
  /** "file" fields take uploads; "text" fields take a written answer */
  type: "file" | "text";
  required?: boolean;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  minFiles?: number;
  /** How many were asked for, when the template says */
  quantity?: number;
  maxFileSize?: number;
  helpText?: string;
  richContent?: TemplateField["richContent"];
  enforceFileTypes?: boolean;
  enforceMaxFileSize?: boolean;
  enforceFileCount?: boolean;
  /** text fields: the saved answer */
  value?: string;
}

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

interface PerFieldUploadProps {
  fields: CreatorField[];
  /** Each field's state, computed by the page (src/lib/creator-field-states) */
  states: Record<string, CreatorFieldState>;
  /** Ready fields the creator has not sent in yet (src/lib/creator-field-states) */
  unsent?: Record<string, boolean | undefined>;
  uploads: UploadedFile[];
  queue: QueuedFile[];
  fieldSubmissions?: Record<string, FieldSubmission>;
  onFilesSelected: (files: FileList | File[], fieldId: string) => void;
  onPause: (fileId: string) => void;
  onResume: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onCancel: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearCompleted: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onFieldSubmit?: (fieldId: string) => Promise<void>;
  onFieldRedact?: (fieldId: string) => Promise<void>;
  onDeleteUpload?: (uploadId: string) => Promise<void>;
  /** Saves a text field's answer */
  onSaveText?: (fieldId: string, value: string) => Promise<void>;
  isUploading: boolean;
  className?: string;
  canUpload?: boolean;
  /** Page-level "Show previews": when true every preview is revealed */
  previewsRevealed?: boolean;
  comments?: SectionComment[];
  onReplyToField?: (fieldId: string, content: string) => Promise<void>;
}

const FIRST_FILES = 6;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function kindWords(accepted?: string[]) {
  const a = accepted && accepted.length > 0 ? accepted : ["*/*"];
  const any = a.includes("*/*");
  const img = any || a.some((t) => t.startsWith("image"));
  const vid = any || a.some((t) => t.startsWith("video"));
  if (img && vid) return { noun: "photos or videos", one: "file", add: "Add photos or videos" };
  if (img) return { noun: "photos", one: "photo", add: "Add photos" };
  if (vid) return { noun: "videos", one: "video", add: "Add videos" };
  return { noun: "files", one: "file", add: "Add files" };
}

/** "Photos · 20 asked for · up to 25" */
function specLine(field: CreatorField) {
  const k = kindWords(field.acceptedFileTypes);
  const parts = [k.noun.charAt(0).toUpperCase() + k.noun.slice(1)];
  if (field.quantity && field.quantity > 0) parts.push(`${field.quantity} asked for`);
  else if (field.minFiles && field.minFiles > 1) parts.push(`at least ${field.minFiles}`);
  if (field.maxFiles && field.maxFiles > 1) parts.push(`up to ${field.maxFiles}`);
  if (field.enforceMaxFileSize && field.maxFileSize) parts.push(`${formatFileSize(field.maxFileSize)} each at most`);
  return parts.join(" · ");
}

/** One uploaded file: a discreet preview (no image is loaded until revealed), its name, open and delete */
function UploadTile({
  upload,
  revealed,
  onOpen,
  onDelete,
}: {
  upload: UploadedFile;
  revealed?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const rejected = upload.status === "REJECTED";
  const approved = upload.status === "APPROVED";
  const name = upload.originalName;
  const [confirming, setConfirming] = React.useState(false);

  return (
    <li className="min-w-0">
      {isImage || (isVideo && upload.thumbnailUrl) ? (
        <DiscreetPreview
          src={upload.thumbnailUrl || null}
          label={name}
          kind={isVideo ? "video" : "photo"}
          caption={isVideo ? "Video" : undefined}
          revealed={revealed ? true : undefined}
        />
      ) : (
        <span className="tw-preview cursor-default" style={{ aspectRatio: "1 / 1" }} aria-hidden="true">
          {isVideo ? <Play className="size-5" /> : upload.fileType.startsWith("audio/") ? <Music className="size-5" /> : <FileText className="size-5" />}
        </span>
      )}
      <p className="mt-1.5 truncate text-[13px] font-medium" title={name}>
        {name}
      </p>
      {rejected || approved ? (
        <StateWord state={rejected ? "changes" : "approved"} audience="creator" className="flex font-normal" />
      ) : (
        <p className="text-[13px] text-ink-2">{formatFileSize(upload.fileSize)}</p>
      )}
      {confirming ? (
        <div className="mt-1 flex gap-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-11 flex-1 px-2 md:h-9"
            onClick={() => {
              setConfirming(false);
              onDelete?.();
            }}
          >
            Delete
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-11 px-2 md:h-9" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="mt-1 flex">
          {onOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-icon hover:text-ink md:size-9"
              aria-label={`Open ${name}`}
              onClick={onOpen}
            >
              <Maximize2 className="size-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-icon hover:text-late md:size-9"
              aria-label={`Delete ${name}`}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function FieldHeader({
  field,
  state,
  unsent,
  spec,
}: {
  field: CreatorField;
  state: CreatorFieldState;
  /** Ready but not sent in yet: "Not sent yet" instead of "Waiting for review" */
  unsent?: boolean;
  spec: string;
}) {
  return (
    <header className="flex items-start gap-3">
      <FieldCell state={state} name={field.label} audience="creator" unsent={unsent} className="mt-[5px]" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-semibold leading-[1.4] tracking-[-0.01em]">
          {field.label}
          {!field.required && <span className="ml-2 text-[13px] font-normal text-ink-2">Optional</span>}
        </h3>
        <p className="mt-0.5 text-[14px] leading-normal text-ink-2">{spec}</p>
      </div>
      <StateWord state={state} unsent={unsent} audience="creator" className="pt-0.5" />
    </header>
  );
}

function FeedbackThread({
  comments,
  onReply,
}: {
  comments: SectionComment[];
  onReply?: (content: string) => Promise<void>;
}) {
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const id = React.useId();
  const tz = useViewerTimeZone();

  const send = async () => {
    if (!onReply || !reply.trim()) return;
    setSending(true);
    try {
      await onReply(reply.trim());
      setReply("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 rounded-[var(--tw-r-ctl)] bg-well p-3">
      <p className="text-[13px] font-medium text-ink-2">Notes about this field</p>
      <ol className="mt-2 space-y-2.5">
        {comments.map((c) => (
          <li key={c.id} className={cn("flex", !c.isAgency && "justify-end")}>
            <div className={cn("max-w-[85%] rounded-[10px] px-3 py-2", c.isAgency ? "bg-tile" : "bg-tile-hi")}>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-normal">{c.content}</p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                {c.isAgency ? c.user?.name || "Your team" : "You"} · {formatDay(c.createdAt, tz)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {onReply && (
        <div className="mt-3 flex items-end gap-2">
          <label htmlFor={id} className="sr-only">
            Reply about this field
          </label>
          <Textarea
            id={id}
            rows={1}
            placeholder="Write a reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-11 resize-none"
          />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={send} disabled={!reply.trim() || sending}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}

function FileFieldCard({
  field,
  state,
  unsent,
  uploads,
  queue,
  submission,
  onFilesSelected,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
  onFieldSubmit,
  onFieldRedact,
  onDeleteUpload,
  isUploading,
  canUpload,
  previewsRevealed,
  comments,
  onReply,
}: {
  field: CreatorField;
  state: CreatorFieldState;
  unsent?: boolean;
  uploads: UploadedFile[];
  queue: QueuedFile[];
  submission?: FieldSubmission;
  onFilesSelected: (files: FileList | File[]) => void;
  onPause: (fileId: string) => void;
  onResume: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onCancel: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearCompleted: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onFieldSubmit?: () => Promise<void>;
  onFieldRedact?: () => Promise<void>;
  onDeleteUpload?: (uploadId: string) => Promise<void>;
  isUploading: boolean;
  canUpload: boolean;
  previewsRevealed?: boolean;
  comments: SectionComment[];
  onReply?: (content: string) => Promise<void>;
}) {
  const tz = useViewerTimeZone();
  const [submitting, setSubmitting] = React.useState(false);
  const [redacting, setRedacting] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  // The whole field accepts dropped files on a desktop
  const cardRef = React.useRef<HTMLElement>(null);
  // Signed URLs for the real files (thumbnails can't play videos/documents)
  const [fullUrls, setFullUrls] = React.useState<Record<string, string>>({});

  const uploadCount = uploads.length;
  const hasMinFiles = field.minFiles ? uploadCount >= field.minFiles : uploadCount > 0;
  const hasActiveQueueItems = queue.some((q) => q.status === "pending" || q.status === "uploading" || q.status === "paused");
  const hasUploads = uploadCount > 0 && !hasActiveQueueItems;

  const submissionStatus = submission?.status || "PENDING";
  const isSubmitted = submissionStatus === "SUBMITTED";
  const isApproved = submissionStatus === "APPROVED";
  const canSubmitField = canUpload && hasUploads && hasMinFiles && !isSubmitted && !isApproved;
  // Matches the redact API: only a SUBMITTED field awaiting review can be taken back
  const canRedactField = canUpload && isSubmitted;
  const canDeleteUploads = canUpload && !isSubmitted && !isApproved;
  const canUploadMore = canUpload && !isSubmitted && !isApproved;

  const words = kindWords(field.acceptedFileTypes);
  const rejected = uploads.filter((u) => u.status === "REJECTED");
  const changesNote = submission?.status === "NEEDS_REVISION" ? submission.feedback : undefined;
  const buttonLabel =
    state === "changes" ? "Upload a new take" : uploadCount > 0 ? `Add more ${words.noun}` : words.add;

  const previewFiles: PreviewFile[] = uploads.map((u) => ({
    id: u.id,
    url: fullUrls[u.id] || (u.fileType.startsWith("image/") ? u.thumbnailUrl || "" : ""),
    fileName: u.fileName,
    originalName: u.originalName,
    fileType: u.fileType,
    fileSize: u.fileSize,
  }));

  const handlePreview = async (uploadId: string) => {
    const index = uploads.findIndex((u) => u.id === uploadId);
    if (index === -1) return;
    setPreviewIndex(index);
    setPreviewOpen(true);

    // Fetch signed URLs for the real files (the modal pages between them)
    const token = (() => {
      try {
        return localStorage.getItem("creatorToken") || "";
      } catch {
        return "";
      }
    })();
    // Preview files (template "Preview as creator") live on this device only
    const missing = uploads.filter((u) => !fullUrls[u.id] && !u.id.startsWith("preview-"));
    if (missing.length === 0) return;
    const results = await Promise.all(
      missing.map(async (u) => {
        try {
          const r = await fetch(`/api/portal/uploads/${u.id}`, { headers: { "x-creator-token": token } });
          if (!r.ok) return null;
          const d = await r.json();
          return d.url ? ([u.id, d.url as string] as const) : null;
        } catch {
          return null;
        }
      })
    );
    setFullUrls((prev) => ({
      ...prev,
      ...Object.fromEntries(results.filter((r): r is readonly [string, string] => r !== null)),
    }));
  };

  const run = async (fn: (() => Promise<void>) | undefined, set: (v: boolean) => void) => {
    if (!fn) return;
    set(true);
    try {
      await fn();
    } finally {
      set(false);
    }
  };

  const visible = showAll ? uploads : uploads.slice(0, FIRST_FILES);

  return (
    <article
      ref={cardRef}
      id={`field-${field.id}`}
      className={cn(
        "scroll-mt-20 rounded-[var(--tw-r-tile)] bg-tile p-4 transition-colors duration-200 lg:scroll-mt-6 lg:p-5",
        "data-[dragging=true]:bg-tile-hi data-[dragging=true]:outline-2 data-[dragging=true]:outline-offset-2 data-[dragging=true]:outline-dashed data-[dragging=true]:outline-acc"
      )}
      aria-label={field.label}
    >
      <FieldHeader field={field} state={state} unsent={unsent ?? !isSubmitted} spec={specLine(field)} />

      {field.helpText && <p className="mt-3 text-[15px] leading-normal">{field.helpText}</p>}

      {(changesNote || rejected.length > 0) && state === "changes" && (
        <div className="mt-3 rounded-[var(--tw-r-ctl)] bg-well p-3">
          <StateWord state="changes" audience="creator" className="flex" />
          {changesNote && <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-normal">{changesNote}</p>}
          {rejected.map((u) => (
            <p key={u.id} className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-normal text-ink-2">
              <span className="text-ink">{u.originalName}</span>
              {u.createdAt ? `, sent ${formatDay(u.createdAt, tz)}` : ""}
              {u.reviewNote ? `: ${u.reviewNote}` : ""}
            </p>
          ))}
        </div>
      )}

      {field.richContent && (
        <FieldExamplesDisplay richContent={field.richContent} fieldLabel={field.label} className="mt-3" />
      )}

      {canUploadMore && (
        <FileDropzone
          className="mt-4"
          variant="button"
          buttonLabel={buttonLabel}
          buttonTone="outline"
          hideLocationNote
          onFilesSelected={onFilesSelected}
          acceptedTypes={field.acceptedFileTypes}
          maxFileSize={field.enforceMaxFileSize ? field.maxFileSize : undefined}
          maxFiles={field.maxFiles}
          showMaxFileSize={!!field.enforceMaxFileSize}
          dropTargetRef={cardRef}
          dropHint={`or drop ${words.noun} on this field`}
        />
      )}

      {hasActiveQueueItems && (
        <UploadQueue
          className="mt-3"
          queue={queue.filter((q) => q.status !== "completed")}
          onPause={onPause}
          onResume={onResume}
          onRetry={onRetry}
          onCancel={onCancel}
          onRemove={onRemove}
          onClearCompleted={onClearCompleted}
          onPauseAll={onPauseAll}
          onResumeAll={onResumeAll}
          totalProgress={0}
          totalSize={0}
          uploadedSize={0}
          isUploading={isUploading}
          collapsible={false}
          maxVisibleItems={5}
        />
      )}

      {uploadCount > 0 && (
        <>
          <p className="mt-4 text-[14px] text-ink-2">
            {uploadCount === 1 ? `1 ${words.one} uploaded` : `${uploadCount} files uploaded`}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 xl:grid-cols-4" aria-label={`${field.label}: uploaded files`}>
            {visible.map((u) => (
              <UploadTile
                key={u.id}
                upload={u}
                revealed={previewsRevealed}
                onOpen={() => handlePreview(u.id)}
                onDelete={canDeleteUploads && onDeleteUpload ? () => onDeleteUpload(u.id) : undefined}
              />
            ))}
          </ul>
          {uploads.length > FIRST_FILES && (
            <Button type="button" variant="ghost" className="mt-2 h-11 px-2 md:h-9" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${uploads.length} files`}
            </Button>
          )}
        </>
      )}

      {(onFieldSubmit && canSubmitField) || (onFieldRedact && canRedactField) || isSubmitted ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {onFieldSubmit && canSubmitField && (
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => run(onFieldSubmit, setSubmitting)}
              disabled={submitting || isUploading}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              Submit
              <span className="sr-only"> {field.label}</span>
            </Button>
          )}
          {isSubmitted && <p className="text-[14px] text-ink-2">Submitted for review.</p>}
          {onFieldRedact && canRedactField && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 md:h-9"
              onClick={() => run(onFieldRedact, setRedacting)}
              disabled={redacting}
            >
              {redacting ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Take it back to change it
            </Button>
          )}
        </div>
      ) : null}

      {comments.length > 0 && <FeedbackThread comments={comments} onReply={onReply} />}

      <FilePreviewModal open={previewOpen} onOpenChange={setPreviewOpen} files={previewFiles} initialIndex={previewIndex} />
    </article>
  );
}

function TextFieldCard({
  field,
  state,
  unsent,
  canEdit,
  onSave,
}: {
  field: CreatorField;
  state: CreatorFieldState;
  unsent?: boolean;
  canEdit: boolean;
  onSave?: (value: string) => Promise<void>;
}) {
  const saved = field.value ?? "";
  const [draft, setDraft] = React.useState(saved);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  // Keep in step when the page reloads the request
  React.useEffect(() => setDraft(saved), [saved]);
  const dirty = draft !== saved;
  const name = field.label.toLowerCase();

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answer didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article id={`field-${field.id}`} className="scroll-mt-20 rounded-[var(--tw-r-tile)] bg-tile p-4 lg:scroll-mt-6 lg:p-5" aria-label={field.label}>
      <FieldHeader field={field} state={state} unsent={unsent} spec="Written answer" />
      {canEdit ? (
        <>
          <label htmlFor={id} className="mt-3 block text-[15px] leading-normal">
            {field.helpText || `Write your ${name} here.`}
          </label>
          <Textarea
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="mt-2"
            aria-invalid={error ? true : undefined}
          />
          {error && <p className="mt-1.5 text-[14px] text-late">{error}</p>}
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" variant="outline" className="h-11 md:h-9" onClick={save} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Save {name}
            </Button>
            {!dirty && saved.trim() && <span className="text-[14px] text-ink-2">Saved</span>}
          </div>
        </>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-normal">
          {saved.trim() ? saved : <span className="text-ink-2">No answer written.</span>}
        </p>
      )}
    </article>
  );
}

export function PerFieldUpload({
  fields,
  states,
  uploads,
  queue,
  fieldSubmissions,
  unsent,
  onFilesSelected,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
  onFieldSubmit,
  onFieldRedact,
  onDeleteUpload,
  onSaveText,
  isUploading,
  className,
  canUpload = true,
  previewsRevealed,
  comments = [],
  onReplyToField,
}: PerFieldUploadProps) {
  const fileFieldIds = new Set(fields.filter((f) => f.type === "file").map((f) => f.id));
  // Legacy uploads without a (known) field
  const unassignedUploads = uploads.filter((u) => !u.fieldId || !fileFieldIds.has(u.fieldId));
  const unassignedQueue = queue.filter((q) => !q.fieldId || !fileFieldIds.has(q.fieldId));

  return (
    <div className={cn("space-y-3", className)}>
      {fields.map((field) =>
        field.type === "text" ? (
          <TextFieldCard
            key={field.id}
            field={field}
            state={states[field.id] ?? "waiting"}
            unsent={unsent?.[field.id]}
            canEdit={canUpload && !!onSaveText}
            onSave={onSaveText ? (v) => onSaveText(field.id, v) : undefined}
          />
        ) : (
          <FileFieldCard
            key={field.id}
            field={field}
            state={states[field.id] ?? "waiting"}
            unsent={unsent?.[field.id]}
            uploads={uploads.filter((u) => u.fieldId === field.id)}
            queue={queue.filter((q) => q.fieldId === field.id)}
            submission={fieldSubmissions?.[field.id]}
            onFilesSelected={(files) => onFilesSelected(files, field.id)}
            onPause={onPause}
            onResume={onResume}
            onRetry={onRetry}
            onCancel={onCancel}
            onRemove={onRemove}
            onClearCompleted={onClearCompleted}
            onPauseAll={onPauseAll}
            onResumeAll={onResumeAll}
            onFieldSubmit={onFieldSubmit ? () => onFieldSubmit(field.id) : undefined}
            onFieldRedact={onFieldRedact ? () => onFieldRedact(field.id) : undefined}
            onDeleteUpload={onDeleteUpload}
            isUploading={isUploading}
            canUpload={canUpload}
            previewsRevealed={previewsRevealed}
            comments={comments.filter((c) => c.fieldId === field.id)}
            onReply={onReplyToField ? (content) => onReplyToField(field.id, content) : undefined}
          />
        )
      )}

      {(unassignedUploads.length > 0 || unassignedQueue.length > 0) && (
        <article className="rounded-[var(--tw-r-tile)] bg-tile p-4" aria-label="Other uploads">
          <h3 className="text-[17px] font-semibold leading-[1.4] tracking-[-0.01em]">Other uploads</h3>
          <p className="mt-0.5 text-[14px] text-ink-2">Files sent for this request without a field</p>
          {unassignedQueue.length > 0 && (
            <UploadQueue
              className="mt-3"
              queue={unassignedQueue}
              onPause={onPause}
              onResume={onResume}
              onRetry={onRetry}
              onCancel={onCancel}
              onRemove={onRemove}
              onClearCompleted={onClearCompleted}
              onPauseAll={onPauseAll}
              onResumeAll={onResumeAll}
              totalProgress={0}
              totalSize={0}
              uploadedSize={0}
              isUploading={isUploading}
              collapsible={false}
              maxVisibleItems={5}
            />
          )}
          {unassignedUploads.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
              {unassignedUploads.map((u) => (
                <UploadTile
                  key={u.id}
                  upload={u}
                  revealed={previewsRevealed}
                  onDelete={canUpload && onDeleteUpload ? () => onDeleteUpload(u.id) : undefined}
                />
              ))}
            </ul>
          )}
        </article>
      )}
    </div>
  );
}

export default PerFieldUpload;
