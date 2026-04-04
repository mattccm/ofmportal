"use client";

import * as React from "react";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import type { QueuedFile } from "@/hooks/use-file-upload";
import type { TemplateField } from "@/lib/template-types";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fieldId?: string | null;
  thumbnailUrl?: string;
  storageKey?: string;
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
  const [imageError, setImageError] = React.useState(false);

  // Use thumbnailUrl from API (already resolved to public URL or presigned)
  const previewUrl = upload.thumbnailUrl || null;

  return (
    <div className="group relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600">
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
            <video
              src={previewUrl}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor || "#6366f1" }}
              >
                <Play className="h-5 w-5 text-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor || "#6366f1"}20` }}
            >
              {getFileTypeIcon(upload.fileType, "h-7 w-7")}
            </div>
            <p className="text-xs text-center text-muted-foreground line-clamp-2 px-2">
              {upload.originalName}
            </p>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onPreview && (
            <button
              onClick={onPreview}
              className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <Eye className="h-5 w-5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 w-10 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Success indicator */}
        <div className="absolute top-2 right-2">
          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>

      {/* File info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm font-medium truncate">{upload.originalName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(upload.fileSize)}</p>
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
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [redacting, setRedacting] = React.useState(false);
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
  const canRedactField = canUpload && (isSubmitted || needsRevision) && !isApproved;
  const canDeleteUploads = canUpload && !isSubmitted && !isApproved;
  const canUploadMore = canUpload && !isSubmitted && !isApproved;

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

  // Get icon and color based on status
  const getStatusIcon = () => {
    if (isApproved) return <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    if (isSubmitted) return <Send className="h-5 w-5 text-violet-600 dark:text-violet-400" />;
    if (needsRevision) return <X className="h-5 w-5 text-red-600 dark:text-red-400" />;
    if (hasUploads) return <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    return <Upload className="h-5 w-5" style={{ color: primaryColor }} />;
  };

  const getStatusBgClass = () => {
    if (isApproved) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (isSubmitted) return "bg-violet-100 dark:bg-violet-900/30";
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
            style={!hasUploads && !isSubmitted && !isApproved && !needsRevision ? { backgroundColor: `${primaryColor || "#6366f1"}15` } : undefined}
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
              {field.minFiles && field.minFiles > 1 && (
                <span className="ml-1">(min {field.minFiles})</span>
              )}
              {field.maxFiles && (
                <span className="ml-1">(max {field.maxFiles})</span>
              )}
            </p>
          </div>
        </div>

        {/* Status badge & action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badges */}
          {isApproved && (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs">
              <Check className="h-3 w-3 mr-1" />
              Approved
            </Badge>
          )}
          {isSubmitted && (
            <Badge className="bg-violet-500 hover:bg-violet-600 text-xs">
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
          maxFileSize={field.maxFileSize}
          maxFiles={field.maxFiles}
          compact={uploads.length > 0}
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
  primaryColor = "#6366f1",
  className,
  canUpload = true,
}: PerFieldUploadProps) {
  // Group uploads and queue items by fieldId
  const getFieldUploads = (fieldId: string) =>
    uploads.filter(u => u.fieldId === fieldId);

  const getFieldQueue = (fieldId: string) =>
    queue.filter(q => q.fieldId === fieldId);

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
