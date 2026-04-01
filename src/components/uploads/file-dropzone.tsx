"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CloudUpload,
  Image as ImageIcon,
  Video,
  Music,
  File as FileIcon,
  Sparkles,
  AlertCircle,
  X,
  Clipboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  ALLOWED_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  isAllowedFileType,
} from "@/lib/file-utils";

export interface FileDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
  /** Enable full-page drag overlay */
  fullPageDrop?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Show paste from clipboard button */
  showPasteButton?: boolean;
  /** Custom accepted file types (defaults to ALLOWED_TYPES) */
  acceptedTypes?: string[];
  /** Custom max file size in bytes (defaults to MAX_FILE_SIZE) */
  maxFileSize?: number;
}

interface DragPreviewInfo {
  fileCount: number;
  validCount: number;
  invalidTypes: string[];
  totalSize: number;
}

function getFileTypeInfo(mimeType: string): { icon: React.ReactNode; label: string; color: string } {
  if (mimeType.startsWith("image/")) {
    return {
      icon: <ImageIcon className="h-4 w-4" />,
      label: "Image",
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30",
    };
  }
  if (mimeType.startsWith("video/")) {
    return {
      icon: <Video className="h-4 w-4" />,
      label: "Video",
      color: "text-blue-500 bg-blue-50 dark:bg-blue-900/30",
    };
  }
  if (mimeType.startsWith("audio/")) {
    return {
      icon: <Music className="h-4 w-4" />,
      label: "Audio",
      color: "text-violet-500 bg-violet-50 dark:bg-violet-900/30",
    };
  }
  return {
    icon: <FileIcon className="h-4 w-4" />,
    label: "File",
    color: "text-gray-500 bg-gray-50 dark:bg-gray-900/30",
  };
}

export function FileDropzone({
  onFilesSelected,
  disabled = false,
  className,
  fullPageDrop = false,
  compact = false,
  showPasteButton = true,
  acceptedTypes = ALLOWED_TYPES,
  maxFileSize = MAX_FILE_SIZE,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFullPageDragging, setIsFullPageDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreviewInfo | null>(null);
  const [dropTargetHighlight, setDropTargetHighlight] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const fullPageCounterRef = useRef(0);

  // Analyze files during drag to show preview
  const analyzeDataTransfer = useCallback(
    (dataTransfer: DataTransfer): DragPreviewInfo => {
      const items = Array.from(dataTransfer.items);
      let validCount = 0;
      let totalSize = 0;
      const invalidTypes: string[] = [];

      items.forEach((item) => {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            if (isAllowedFileType(file.type) && file.size <= maxFileSize) {
              validCount++;
              totalSize += file.size;
            } else if (!isAllowedFileType(file.type)) {
              const ext = file.name.split(".").pop() || file.type;
              if (!invalidTypes.includes(ext)) {
                invalidTypes.push(ext);
              }
            }
          }
        }
      });

      return {
        fileCount: items.filter((i) => i.kind === "file").length,
        validCount,
        invalidTypes,
        totalSize,
      };
    },
    [maxFileSize]
  );

  // Full-page drag handlers
  useEffect(() => {
    if (!fullPageDrop || disabled) return;

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      fullPageCounterRef.current++;

      if (e.dataTransfer?.types.includes("Files")) {
        setIsFullPageDragging(true);
        if (e.dataTransfer) {
          setDragPreview(analyzeDataTransfer(e.dataTransfer));
        }
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      fullPageCounterRef.current--;

      if (fullPageCounterRef.current === 0) {
        setIsFullPageDragging(false);
        setDragPreview(null);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      fullPageCounterRef.current = 0;
      setIsFullPageDragging(false);
      setDragPreview(null);
      setDropTargetHighlight(false);

      if (e.dataTransfer?.files.length) {
        const validFiles = Array.from(e.dataTransfer.files).filter(
          (file) => isAllowedFileType(file.type) && file.size <= maxFileSize
        );
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [fullPageDrop, disabled, onFilesSelected, analyzeDataTransfer, maxFileSize]);

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && isAllowedFileType(file.type) && file.size <= maxFileSize) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onFilesSelected(files);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [disabled, onFilesSelected, maxFileSize]);

  // Local dropzone drag handlers
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;

      if (!disabled) {
        setIsDragging(true);
        setDropTargetHighlight(true);
        if (e.dataTransfer) {
          setDragPreview(analyzeDataTransfer(e.dataTransfer));
        }
      }
    },
    [disabled, analyzeDataTransfer]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
      setDropTargetHighlight(false);
      setDragPreview(null);
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
      setDropTargetHighlight(false);
      setDragPreview(null);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const validFiles = Array.from(files).filter(
          (file) => isAllowedFileType(file.type) && file.size <= maxFileSize
        );
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    },
    [disabled, onFilesSelected, maxFileSize]
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

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];

      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/")) {
            const blob = await item.getType(type);
            const file = new File([blob], `pasted-${Date.now()}.${type.split("/")[1]}`, { type });
            if (isAllowedFileType(file.type) && file.size <= maxFileSize) {
              files.push(file);
            }
          }
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      }
    } catch {
      // Clipboard API not available or permission denied - silently fail
    }
  }, [onFilesSelected, maxFileSize]);

  // Render full-page overlay
  const renderFullPageOverlay = () => {
    if (!fullPageDrop || !isFullPageDragging) return null;

    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center",
          "bg-background/80 backdrop-blur-sm",
          "animate-in fade-in duration-200"
        )}
      >
        <div
          className={cn(
            "max-w-lg w-full mx-4 p-8 rounded-2xl",
            "bg-card border-2 border-dashed",
            "shadow-2xl shadow-primary/10",
            dropTargetHighlight ? "border-primary bg-primary/5" : "border-border",
            "transition-all duration-200"
          )}
        >
          <div className="text-center space-y-4">
            {/* Icon */}
            <div
              className={cn(
                "mx-auto w-20 h-20 rounded-2xl flex items-center justify-center",
                "bg-primary text-white",
                "shadow-lg shadow-primary/30",
                "animate-bounce"
              )}
            >
              <Sparkles className="h-10 w-10" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold">Drop files to upload</h2>

            {/* Preview info */}
            {dragPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {dragPreview.validCount} of {dragPreview.fileCount} files valid
                  </Badge>
                  {dragPreview.totalSize > 0 && (
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {formatFileSize(dragPreview.totalSize)}
                    </Badge>
                  )}
                </div>

                {dragPreview.invalidTypes.length > 0 && (
                  <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      Unsupported: {dragPreview.invalidTypes.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Accepted types */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Video className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                  <Music className="h-4 w-4 text-violet-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <>
        {renderFullPageOverlay()}
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-300",
            isDragging || dropTargetHighlight
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border/60 hover:border-primary/50 hover:bg-accent/30",
            disabled && "opacity-50 pointer-events-none",
            className
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="p-4 flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                isDragging
                  ? "bg-primary text-white"
                  : "bg-violet-50 text-violet-500 dark:bg-violet-900/30"
              )}
            >
              {isDragging ? (
                <Sparkles className="h-6 w-6 animate-pulse" />
              ) : (
                <CloudUpload className="h-6 w-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {isDragging ? "Drop files here" : "Drag files or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Images, videos, audio up to {formatFileSize(maxFileSize)}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(",")}
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled}
            />

            <div className="flex items-center gap-2 shrink-0">
              {showPasteButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePasteFromClipboard}
                  disabled={disabled}
                  title="Paste from clipboard"
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                Browse
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderFullPageOverlay()}
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
          isDragging || dropTargetHighlight
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 hover:border-primary/50 hover:bg-accent/30",
          disabled && "opacity-50 pointer-events-none",
          className
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
            (isDragging || dropTargetHighlight) && "opacity-100"
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
              {isDragging && dragPreview ? (
                <>
                  {dragPreview.validCount} of {dragPreview.fileCount} files ready
                  {dragPreview.invalidTypes.length > 0 && (
                    <span className="text-destructive">
                      {" "}(unsupported: {dragPreview.invalidTypes.join(", ")})
                    </span>
                  )}
                </>
              ) : fullPageDrop ? (
                "Drag files anywhere on the page, paste from clipboard, or click to browse. We support images, videos, and audio up to 5GB each."
              ) : (
                "Drag and drop your files here, paste from clipboard, or click to browse. We support images, videos, and audio up to 5GB each."
              )}
            </p>
          </div>

          {/* File types */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-xs font-medium">Images</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Video className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-xs font-medium">Videos</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                <Music className="h-5 w-5 text-violet-500" />
              </div>
              <span className="text-xs font-medium">Audio</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(",")}
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
            {showPasteButton && (
              <Button
                variant="outline"
                onClick={handlePasteFromClipboard}
                disabled={disabled}
              >
                <Clipboard className="mr-2 h-4 w-4" />
                Paste
              </Button>
            )}
          </div>

          {/* Max size note */}
          <p className="text-xs text-muted-foreground mt-4">
            Maximum file size: {formatFileSize(maxFileSize)}
            {fullPageDrop && " • Drop anywhere on the page"}
          </p>
        </div>
      </div>
    </>
  );
}

export default FileDropzone;
