"use client";

import * as React from "react";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import {
  Upload,
  Check,
  ImageIcon,
  Video,
  FileAudio,
  File,
  X,
  Play,
  Eye,
  Send,
  Loader2,
  MessageCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { QueuedFile } from "@/hooks/use-file-upload";
import type { TemplateField } from "@/lib/template-types";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";

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
}

interface FileField {
  id: string;
  label: string;
  type: "file";
  required?: boolean;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  minFiles?: number;
  maxFileSize?: number;
  helpText?: string;
  richContent?: TemplateField["richContent"];
  // Enforcement flags
  enforceFileTypes?: boolean;
  enforceMaxFileSize?: boolean;
  enforceFileCount?: boolean;
}

interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
}

interface PerFieldUploadProps {
  fields: FileField[];
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
  isUploading: boolean;
  primaryColor?: string;
  className?: string;
  canUpload?: boolean;
  comments?: SectionComment[];
  creatorName?: string;
  creatorImage?: string;
  onReplyToField?: (fieldId: string, content: string) => Promise<void>;
}

function getFileTypeIcon(fileType: string, className = "h-5 w-5") {
  if (fileType.startsWith("image/")) return <ImageIcon className={className} />;
  if (fileType.startsWith("video/")) return <Video className={className} />;
  if (fileType.startsWith("audio/")) return <FileAudio className={className} />;
  return <File className={className} />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Individual upload preview card
function UploadPreviewCard({
  upload,
  onDelete,
  onPreview,
  primaryColor,
}: {
  upload: UploadedFile;
  onDelete?: () => void;
  onPreview?: () => void;
  primaryColor?: string;
}) {
  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const isRejected = upload.status === "REJECTED";
  const isApprovedFile = upload.status === "APPROVED";
  const [imageError, setImageError] = React.useState(false);

  // Use thumbnailUrl from API (already resolved to public URL or presigned)
  const previewUrl = upload.thumbnailUrl || null;

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600",
        isRejected && "ring-2 ring-red-500/60 border-red-300"
      )}
    >
      {/* Preview area */}
      <div className="aspect-square relative">
        {isImage && previewUrl && !imageError ? (
          <img
            src={previewUrl}
            alt={upload.originalName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : isVideo && previewUrl && !imageError ? (
          <div className="w-full h-full relative">
            <img
              src={previewUrl}
              alt={upload.originalName}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor || BRAND.primaryColor }}
              >
                <Play className="h-5 w-5 text-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor || BRAND.primaryColor}20` }}
            >
              {getFileTypeIcon(upload.fileType, "h-7 w-7")}
            </div>
            <p className="text-xs text-center text-muted-foreground line-clamp-2 px-2">
              {upload.originalName}
            </p>
          </div>
        )}

        {/* Hover overlay: always visible on touch devices; on hover devices it
            is not clickable until shown, so a tap can't hit a hidden button */}
        <div className="absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto">
          {onPreview && (
            <button
              type="button"
              aria-label="Preview file"
              onClick={onPreview}
              className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <Eye className="h-5 w-5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete file"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${upload.originalName}"? This cannot be undone.`)) onDelete();
              }}
              className="h-10 w-10 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Review status indicator */}
        <div className="absolute top-2 right-2">
          {isRejected ? (
            <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <X className="h-3.5 w-3.5 text-white" />
            </div>
          ) : isApprovedFile ? (
            <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-slate-400 flex items-center justify-center shadow-lg">
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* File info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm font-medium truncate">{upload.originalName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(upload.fileSize)}</p>
        {isRejected && <p className="text-xs font-medium text-red-600">Rejected – please replace</p>}
      </div>
    </div>
  );
}

// Single field upload section
function FieldUploadSection({
  field,
  uploads,
  queue,
  fieldSubmission,
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
  primaryColor,
  canUpload = true,
  comments,
  creatorName,
  creatorImage,
  onReply,
}: {
  field: FileField;
  uploads: UploadedFile[];
  queue: QueuedFile[];
  fieldSubmission?: FieldSubmission;
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
  primaryColor?: string;
  canUpload?: boolean;
  comments: SectionComment[];
  creatorName?: string;
  creatorImage?: string;
  onReply?: (content: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [redacting, setRedacting] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [replying, setReplying] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  // Signed URLs for the real files (thumbnails can't play videos/documents)
  const [fullUrls, setFullUrls] = React.useState<Record<string, string>>({});
  const uploadCount = uploads.length;
  const hasMinFiles = field.minFiles ? uploadCount >= field.minFiles : uploadCount > 0;
  // Check if there are any pending/uploading items (not just any items in queue)
  const hasActiveQueueItems = queue.some(q => q.status === "pending" || q.status === "uploading" || q.status === "paused");
  const hasUploads = uploadCount > 0 && !hasActiveQueueItems;

  // Determine field state based on submission status
  const submissionStatus = fieldSubmission?.status || "PENDING";
  const isSubmitted = submissionStatus === "SUBMITTED";
  const isApproved = submissionStatus === "APPROVED";
  const needsRevision = submissionStatus === "NEEDS_REVISION";
  // Only allow submit if canUpload is true (request is in an editable state) AND field isn't already submitted/approved
  const canSubmitField = canUpload && hasUploads && hasMinFiles && !isSubmitted && !isApproved;
  // Matches the redact API: only a SUBMITTED field awaiting review can be redacted
  const canRedactField = canUpload && isSubmitted;
  const canDeleteUploads = canUpload && !isSubmitted && !isApproved;
  const canUploadMore = canUpload && !isSubmitted && !isApproved;

  // Convert uploads to preview files
  const previewFiles: PreviewFile[] = uploads.map(upload => ({
    id: upload.id,
    url: fullUrls[upload.id] || (upload.fileType.startsWith("image/") ? upload.thumbnailUrl || "" : ""),
    fileName: upload.fileName,
    originalName: upload.originalName,
    fileType: upload.fileType,
    fileSize: upload.fileSize,
  }));

  const handlePreview = async (uploadId: string) => {
    const index = uploads.findIndex(u => u.id === uploadId);
    if (index === -1) return;
    setPreviewIndex(index);
    setPreviewOpen(true);

    // Fetch real file URLs for every upload (the modal pages between them)
    const token = (() => { try { return localStorage.getItem("creatorToken") || ""; } catch { return ""; } })();
    const missing = uploads.filter(u => !fullUrls[u.id]);
    if (missing.length === 0) return;
    const results = await Promise.all(missing.map(async u => {
      try {
        const r = await fetch(`/api/portal/uploads/${u.id}`, { headers: { "x-creator-token": token } });
        if (!r.ok) return null;
        const d = await r.json();
        return d.url ? ([u.id, d.url as string] as const) : null;
      } catch {
        return null;
      }
    }));
    setFullUrls(prev => ({
      ...prev,
      ...Object.fromEntries(results.filter((r): r is readonly [string, string] => r !== null)),
    }));
  };

  const handleSubmit = async () => {
    if (!onFieldSubmit) return;
    setSubmitting(true);
    try {
      await onFieldSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedact = async () => {
    if (!onFieldRedact) return;
    setRedacting(true);
    try {
      await onFieldRedact();
    } finally {
      setRedacting(false);
    }
  };

  const handleReply = async () => {
    if (!onReply || !reply.trim()) return;
    setReplying(true);
    try {
      await onReply(reply.trim());
      setReply("");
    } finally {
      setReplying(false);
    }
  };

  // Get icon and color based on status
  const getStatusIcon = () => {
    if (isApproved) return <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    if (isSubmitted) return <Send className="h-5 w-5 text-primary" />;
    if (needsRevision) return <X className="h-5 w-5 text-red-600 dark:text-red-400" />;
    if (hasUploads) return <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    return <Upload className="h-5 w-5" style={{ color: primaryColor }} />;
  };

  const getStatusBgClass = () => {
    if (isApproved) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (isSubmitted) return "bg-primary/10";
    if (needsRevision) return "bg-red-100 dark:bg-red-900/30";
    if (hasUploads) return "bg-emerald-100 dark:bg-emerald-900/30";
    return "bg-slate-100 dark:bg-slate-800";
  };

  return (
    <div className="space-y-4">
      {/* Field header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              getStatusBgClass()
            )}
            style={!hasUploads && !isSubmitted && !isApproved && !needsRevision ? { backgroundColor: `${primaryColor || BRAND.primaryColor}15` } : undefined}
          >
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {field.label}
              {field.required && (
                <span className="text-red-500 text-sm">*</span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {field.helpText || "Drag and drop or click to upload"}
              {field.enforceFileCount && field.minFiles && field.minFiles > 1 && (
                <span className="ml-1">(min {field.minFiles})</span>
              )}
              {field.enforceFileCount && field.maxFiles && (
                <span className="ml-1">(max {field.maxFiles})</span>
              )}
            </p>
          </div>
        </div>

        {/* Status badge & action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Feedback indicator */}
          {comments.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <MessageCircle className="h-3 w-3" />
              {comments.length} feedback
            </Badge>
          )}
          {/* Status badges */}
          {isApproved && (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs">
              <Check className="h-3 w-3 mr-1" />
              Approved
            </Badge>
          )}
          {isSubmitted && (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
              <Send className="h-3 w-3 mr-1" />
              Submitted
            </Badge>
          )}
          {needsRevision && (
            <Badge variant="destructive" className="text-xs">
              Needs Revision
            </Badge>
          )}
          {!isSubmitted && !isApproved && !needsRevision && uploadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {uploadCount} file{uploadCount !== 1 ? "s" : ""}
            </Badge>
          )}

          {/* Submit button */}
          {onFieldSubmit && canSubmitField && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || isUploading}
              style={{ backgroundColor: primaryColor }}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit
            </Button>
          )}

          {/* Redact button */}
          {onFieldRedact && canRedactField && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRedact}
              disabled={redacting}
              className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              {redacting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Redact
            </Button>
          )}
        </div>
      </div>

      {/* Revision feedback */}
      {needsRevision && fieldSubmission?.feedback && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">
            <span className="font-medium">Feedback:</span> {fieldSubmission.feedback}
          </p>
        </div>
      )}

      {/* Field instructions/examples */}
      {field.richContent && (
        <FieldExamplesDisplay
          richContent={field.richContent}
          fieldLabel={field.label}
        />
      )}

      {/* Upload dropzone */}
      {canUploadMore && (
        <FileDropzone
          onFilesSelected={onFilesSelected}
          acceptedTypes={field.acceptedFileTypes}
          maxFileSize={field.enforceMaxFileSize ? field.maxFileSize : undefined}
          maxFiles={field.maxFiles}
          compact={uploads.length > 0}
          showMaxFileSize={!!field.enforceMaxFileSize}
        />
      )}

      {/* Upload queue - only show if there are active (non-completed) items */}
      {hasActiveQueueItems && (
        <UploadQueue
          queue={queue.filter(q => q.status !== "completed")}
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

      {/* Uploaded files grid */}
      {uploads.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {uploads.map(upload => (
            <UploadPreviewCard
              key={upload.id}
              upload={upload}
              primaryColor={primaryColor}
              onPreview={() => handlePreview(upload.id)}
              onDelete={canDeleteUploads && onDeleteUpload ? () => onDeleteUpload(upload.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Submitted state message */}
      {isSubmitted && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Waiting for review. You can redact your submission if you need to make changes.
        </p>
      )}

      {/* Section feedback thread + reply */}
      {comments.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" style={{ color: primaryColor }} />
            <p className="text-sm font-semibold">Feedback</p>
          </div>
          <div className="space-y-3">
            {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn("flex gap-3", !comment.isAgency && "flex-row-reverse")}
                  >
                    <Avatar
                      size="sm"
                      user={{
                        name: comment.isAgency
                          ? comment.user?.name || "Agency"
                          : creatorName || "You",
                        image: comment.isAgency ? comment.user?.image : creatorImage,
                      }}
                    />
                    <div
                      className={cn(
                        "flex-1 min-w-0 max-w-[80%]",
                        !comment.isAgency && "text-right"
                      )}
                    >
                      <div
                        className={cn(
                          "inline-block rounded-2xl px-4 py-2",
                          comment.isAgency
                            ? "bg-muted rounded-tl-none"
                            : "rounded-tr-none text-white"
                        )}
                        style={
                          !comment.isAgency ? { backgroundColor: primaryColor } : undefined
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.isAgency ? `${comment.user?.name || "Agency"} · ` : ""}
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
            ))}
          </div>
          {onReply && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Reply to this feedback..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-[44px] resize-none"
              />
              <Button
                onClick={handleReply}
                disabled={!reply.trim() || replying}
                className="shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {replying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={previewFiles}
        initialIndex={previewIndex}
      />
    </div>
  );
}

export function PerFieldUpload({
  fields,
  uploads,
  queue,
  fieldSubmissions,
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
  primaryColor = BRAND.primaryColor,
  className,
  canUpload = true,
  comments = [],
  creatorName,
  creatorImage,
  onReplyToField,
}: PerFieldUploadProps) {
  // Group uploads and queue items by fieldId
  const getFieldUploads = (fieldId: string) =>
    uploads.filter(u => u.fieldId === fieldId);

  const getFieldQueue = (fieldId: string) =>
    queue.filter(q => q.fieldId === fieldId);

  const getFieldComments = (fieldId: string) =>
    comments.filter(c => c.fieldId === fieldId);

  // Get unassigned uploads (legacy uploads without fieldId)
  const unassignedUploads = uploads.filter(u => !u.fieldId || !fields.some(f => f.id === u.fieldId));
  const unassignedQueue = queue.filter(q => !q.fieldId || !fields.some(f => f.id === q.fieldId));

  return (
    <div className={cn("space-y-8", className)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          {index > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 mb-8" />
          )}
          <FieldUploadSection
            field={field}
            uploads={getFieldUploads(field.id)}
            queue={getFieldQueue(field.id)}
            fieldSubmission={fieldSubmissions?.[field.id]}
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
            primaryColor={primaryColor}
            canUpload={canUpload}
            comments={getFieldComments(field.id)}
            creatorName={creatorName}
            creatorImage={creatorImage}
            onReply={
              onReplyToField ? (content) => onReplyToField(field.id, content) : undefined
            }
          />
        </div>
      ))}

      {/* Legacy/unassigned uploads - only show if there are some */}
      {(unassignedUploads.length > 0 || unassignedQueue.length > 0) && (
        <>
          {fields.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700" />
          )}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Upload className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Other Uploads</h3>
                <p className="text-sm text-muted-foreground">
                  Additional files for this request
                </p>
              </div>
            </div>

            {unassignedQueue.length > 0 && (
              <UploadQueue
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {unassignedUploads.map(upload => (
                  <UploadPreviewCard
                    key={upload.id}
                    upload={upload}
                    primaryColor={primaryColor}
                    onDelete={onDeleteUpload ? () => onDeleteUpload(upload.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PerFieldUpload;
