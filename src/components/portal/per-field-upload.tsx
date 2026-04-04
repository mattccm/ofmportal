"use client";

import * as React from "react";
import { FileDropzone } from "@/components/uploads/file-dropzone";
import { UploadQueue } from "@/components/uploads/upload-queue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, Check, ChevronDown, ChevronUp, ImageIcon, Video, FileAudio, File } from "lucide-react";
import type { QueuedFile } from "@/hooks/use-file-upload";
import type { TemplateField } from "@/lib/template-types";

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fieldId?: string | null;
  thumbnailUrl?: string;
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

interface PerFieldUploadProps {
  fields: FileField[];
  uploads: UploadedFile[];
  queue: QueuedFile[];
  onFilesSelected: (files: FileList | File[], fieldId: string) => void;
  onPause: (fileId: string) => void;
  onResume: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onCancel: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearCompleted: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  isUploading: boolean;
  primaryColor?: string;
  className?: string;
}

function getFileTypeIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
  if (fileType.startsWith("audio/")) return <FileAudio className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PerFieldUpload({
  fields,
  uploads,
  queue,
  onFilesSelected,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
  isUploading,
  primaryColor = "#6366f1",
  className,
}: PerFieldUploadProps) {
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set(fields.map(f => f.id)));

  const toggleField = (fieldId: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  // Group uploads and queue items by fieldId
  const getFieldUploads = (fieldId: string) =>
    uploads.filter(u => u.fieldId === fieldId);

  const getFieldQueue = (fieldId: string) =>
    queue.filter(q => q.fieldId === fieldId);

  // Get unassigned uploads (uploads without fieldId or with unknown fieldId)
  const unassignedUploads = uploads.filter(u => !u.fieldId || !fields.some(f => f.id === u.fieldId));
  const unassignedQueue = queue.filter(q => !q.fieldId || !fields.some(f => f.id === q.fieldId));

  return (
    <div className={cn("space-y-4", className)}>
      {fields.map(field => {
        const fieldUploads = getFieldUploads(field.id);
        const fieldQueue = getFieldQueue(field.id);
        const isExpanded = expandedFields.has(field.id);
        const uploadCount = fieldUploads.length;
        const queueCount = fieldQueue.length;
        const totalCount = uploadCount + queueCount;
        const hasMinFiles = field.minFiles ? uploadCount >= field.minFiles : true;
        const isComplete = hasMinFiles && queueCount === 0;

        return (
          <Card
            key={field.id}
            className={cn(
              "transition-all duration-200",
              isComplete && "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      isComplete
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 text-sm">*</span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {field.helpText || `Upload files for ${field.label.toLowerCase()}`}
                      {field.minFiles && (
                        <span className="ml-1">
                          (minimum {field.minFiles} file{field.minFiles > 1 ? "s" : ""})
                        </span>
                      )}
                      {field.maxFiles && (
                        <span className="ml-1">
                          (maximum {field.maxFiles} file{field.maxFiles > 1 ? "s" : ""})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {totalCount > 0 && (
                    <Badge
                      variant={isComplete ? "default" : "secondary"}
                      className={cn(
                        isComplete && "bg-emerald-500"
                      )}
                    >
                      {uploadCount} file{uploadCount !== 1 ? "s" : ""}
                      {queueCount > 0 && ` (+${queueCount} uploading)`}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleField(field.id)}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                {/* Dropzone */}
                <FileDropzone
                  onFilesSelected={(files) => onFilesSelected(files, field.id)}
                  acceptedTypes={field.acceptedFileTypes}
                  maxFileSize={field.maxFileSize}
                  maxFiles={field.maxFiles}
                  compact={true}
                />

                {/* Upload queue for this field */}
                {fieldQueue.length > 0 && (
                  <UploadQueue
                    queue={fieldQueue}
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
                    maxVisibleItems={3}
                  />
                )}

                {/* Uploaded files for this field */}
                {fieldUploads.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Uploaded ({fieldUploads.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {fieldUploads.map(upload => (
                        <div
                          key={upload.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {upload.thumbnailUrl ? (
                            <img
                              src={upload.thumbnailUrl}
                              alt={upload.originalName}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-background flex items-center justify-center">
                              {getFileTypeIcon(upload.fileType)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {upload.originalName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(upload.fileSize)}
                            </p>
                          </div>
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Unassigned uploads (legacy or general uploads) */}
      {(unassignedUploads.length > 0 || unassignedQueue.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5" />
              General Uploads
            </CardTitle>
            <CardDescription>
              Files not assigned to a specific field
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="grid gap-2 sm:grid-cols-2">
                {unassignedUploads.map(upload => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    {upload.thumbnailUrl ? (
                      <img
                        src={upload.thumbnailUrl}
                        alt={upload.originalName}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-background flex items-center justify-center">
                        {getFileTypeIcon(upload.fileType)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {upload.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(upload.fileSize)}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PerFieldUpload;
