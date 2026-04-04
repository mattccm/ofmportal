"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import {
  Upload,
  File,
  Image as ImageIcon,
  Video,
  Music,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  CloudUpload,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, ALLOWED_TYPES, MAX_FILE_SIZE } from "@/lib/file-utils";

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  uploadId?: string;
}

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  uploadingFiles: UploadingFile[];
  onRetry?: (file: UploadingFile) => void;
  onRemove?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
  /** Restrict to specific file types (e.g., ["image/*", "video/*"]) */
  acceptedTypes?: string[];
}

function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("h-5 w-5", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  return <File className={iconClass} />;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return "File";
}

export function UploadZone({
  onFilesSelected,
  uploadingFiles,
  onRetry,
  onRemove,
  onCancel,
  disabled = false,
  className,
  acceptedTypes,
}: UploadZoneProps) {
  // Determine which file types to show based on acceptedTypes
  const showImages = !acceptedTypes || acceptedTypes.some(t => t.startsWith("image"));
  const showVideos = !acceptedTypes || acceptedTypes.some(t => t.startsWith("video"));
  const showAudio = !acceptedTypes || acceptedTypes.some(t => t.startsWith("audio"));
  const acceptString = acceptedTypes?.join(",") || ALLOWED_TYPES.join(",");

  // Generate file type description text
  const getFileTypeDescription = () => {
    const types: string[] = [];
    if (showImages) types.push("images");
    if (showVideos) types.push("videos");
    if (showAudio) types.push("audio");
    if (types.length === 0) return "files";
    if (types.length === 1) return types[0];
    if (types.length === 2) return types.join(" and ");
    return types.slice(0, -1).join(", ") + ", and " + types[types.length - 1];
  };
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onFilesSelected]
  );

  const activeUploads = uploadingFiles.filter(
    (f) => f.status === "uploading" || f.status === "pending"
  );
  const completedUploads = uploadingFiles.filter(
    (f) => f.status === "completed"
  );
  const errorUploads = uploadingFiles.filter((f) => f.status === "error");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 hover:border-primary/50 hover:bg-accent/30",
          disabled && "opacity-50 pointer-events-none"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Animated background for drag state */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300",
            isDragging && "opacity-100"
          )}
        />

        <div className="relative p-8 sm:p-12 text-center">
          {/* Icon */}
          <div
            className={cn(
              "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
              isDragging
                ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                : "bg-violet-50 text-violet-500 dark:bg-violet-900/30"
            )}
          >
            {isDragging ? (
              <Sparkles className="h-8 w-8 animate-pulse" />
            ) : (
              <CloudUpload className="h-8 w-8" />
            )}
          </div>

          {/* Text */}
          <div className="space-y-2 mb-6">
            <h3 className="text-lg font-semibold">
              {isDragging ? "Drop files here" : "Upload your content"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Drag and drop your files here, or click to browse. We support {getFileTypeDescription()} up to 5GB each.
            </p>
          </div>

          {/* File types */}
          <div className="flex items-center justify-center gap-6 mb-6">
            {showImages && (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-emerald-500" />
                </div>
                <span className="text-xs font-medium">Images</span>
              </div>
            )}
            {showVideos && (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Video className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-xs font-medium">Videos</span>
              </div>
            )}
            {showAudio && (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                  <Music className="h-5 w-5 text-violet-500" />
                </div>
                <span className="text-xs font-medium">Audio</span>
              </div>
            )}
          </div>

          {/* Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptString}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="btn-gradient px-8"
          >
            <Upload className="mr-2 h-4 w-4" />
            Select Files
          </Button>

          {/* Max size note */}
          <p className="text-xs text-muted-foreground mt-4">
            Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </div>
      </div>

      {/* Upload Progress List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {/* Summary stats */}
          {(activeUploads.length > 0 ||
            completedUploads.length > 0 ||
            errorUploads.length > 0) && (
            <div className="flex items-center gap-4 text-sm px-1">
              {activeUploads.length > 0 && (
                <span className="text-blue-600 font-medium">
                  {activeUploads.length} uploading
                </span>
              )}
              {completedUploads.length > 0 && (
                <span className="text-emerald-600 font-medium">
                  {completedUploads.length} complete
                </span>
              )}
              {errorUploads.length > 0 && (
                <span className="text-red-600 font-medium">
                  {errorUploads.length} failed
                </span>
              )}
            </div>
          )}

          {/* File list */}
          <div className="space-y-2">
            {uploadingFiles.map((file) => (
              <UploadFileItem
                key={file.id}
                file={file}
                onRetry={onRetry}
                onRemove={onRemove}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual file upload item
function UploadFileItem({
  file,
  onRetry,
  onRemove,
  onCancel,
}: {
  file: UploadingFile;
  onRetry?: (file: UploadingFile) => void;
  onRemove?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
}) {
  const isActive = file.status === "uploading" || file.status === "pending";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all",
        file.status === "completed" && "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10",
        file.status === "error" && "bg-red-50/50 border-red-200 dark:bg-red-900/10",
        file.status === "uploading" && "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10",
        file.status === "pending" && "bg-muted/50 border-border"
      )}
    >
      {/* File icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          file.status === "completed" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30",
          file.status === "error" && "bg-red-100 text-red-600 dark:bg-red-900/30",
          file.status === "uploading" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
          file.status === "pending" && "bg-muted text-muted-foreground"
        )}
      >
        {getFileIcon(file.file.type)}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {getFileTypeLabel(file.file.type)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.file.size)}
          </span>
          {file.status === "uploading" && (
            <>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="text-xs text-blue-600 font-medium">
                {file.progress}%
              </span>
            </>
          )}
          {file.status === "error" && file.error && (
            <>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="text-xs text-red-600">{file.error}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {file.status === "uploading" && (
          <div className="mt-2">
            <Progress value={file.progress}>
              <ProgressTrack className="h-1.5">
                <ProgressIndicator className="bg-gradient-to-r from-blue-500 to-violet-500" />
              </ProgressTrack>
            </Progress>
          </div>
        )}
      </div>

      {/* Status/Actions */}
      <div className="shrink-0">
        {file.status === "completed" && (
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
        )}

        {file.status === "error" && (
          <div className="flex items-center gap-1">
            {onRetry && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                onClick={() => onRetry(file)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                onClick={() => onRemove(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {isActive && onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onCancel(file.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {file.status === "pending" && !onCancel && (
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// Compact uploaded files grid
interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  thumbnailUrl?: string;
}

interface UploadedFilesGridProps {
  files: UploadedFile[];
  onFileClick?: (file: UploadedFile) => void;
  className?: string;
}

export function UploadedFilesGrid({
  files,
  onFileClick,
  className,
}: UploadedFilesGridProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3",
        className
      )}
    >
      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onFileClick?.(file)}
          className={cn(
            "group relative aspect-square rounded-xl border bg-muted/30 overflow-hidden cursor-pointer hover:shadow-md transition-all",
            file.status === "APPROVED" && "ring-2 ring-emerald-500/30",
            file.status === "REJECTED" && "ring-2 ring-red-500/30"
          )}
        >
          {/* Thumbnail or icon */}
          {file.thumbnailUrl && file.fileType.startsWith("image/") ? (
            <img
              src={file.thumbnailUrl}
              alt={file.originalName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {getFileIcon(file.fileType, "h-8 w-8 text-muted-foreground")}
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* File name on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-xs text-white font-medium truncate">
              {file.originalName}
            </p>
            <p className="text-xs text-white/70">
              {formatFileSize(file.fileSize)}
            </p>
          </div>

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            {file.status === "APPROVED" && (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            {file.status === "REJECTED" && (
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                <X className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            {file.status === "PENDING" && (
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                <AlertCircle className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
