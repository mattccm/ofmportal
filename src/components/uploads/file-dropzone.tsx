"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Image as ImageIcon,
  Video,
  Music,
  AlertCircle,
  Clipboard,
  MapPinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  isAllowedFileType,
  resolveMimeType,
  buildAcceptAttribute,
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
  /** Whether to show the max file size limit in UI (defaults to true) */
  showMaxFileSize?: boolean;
  /**
   * "zone" (default) is the drop area; "button" is a single 44px upload
   * button that still accepts dropped files (a field card on a phone).
   */
  variant?: "zone" | "button";
  /** The button's words in the "button" variant ("Add photos", "Upload a new take") */
  buttonLabel?: string;
  /** "primary" makes the button the region's one yellow action */
  buttonTone?: "primary" | "outline";
  /** Hide the location note (when the page states it once) */
  hideLocationNote?: boolean;
  /**
   * "button" variant: a larger element (the field card) that accepts dropped
   * files instead of the button alone. It gets data-dragging="true" while
   * files are over it, for its own highlight.
   */
  dropTargetRef?: React.RefObject<HTMLElement | null>;
  /** Shown beside the button on a mouse device, e.g. "or drop photos on this field" */
  dropHint?: string;
}

interface DragPreviewInfo {
  fileCount: number;
  validCount: number;
  invalidTypes: string[];
  totalSize: number;
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
  showMaxFileSize = true,
  variant = "zone",
  buttonLabel,
  buttonTone = "outline",
  hideLocationNote = false,
  dropTargetRef,
  dropHint,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFullPageDragging, setIsFullPageDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreviewInfo | null>(null);
  const [dropTargetHighlight, setDropTargetHighlight] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const fullPageCounterRef = useRef(0);

  // Determine which file types to show based on acceptedTypes
  const showImages = acceptedTypes.some(t => t.startsWith("image") || t === "*/*");
  const showVideos = acceptedTypes.some(t => t.startsWith("video") || t === "*/*");
  // Photos have GPS stripped before upload (see stripImageLocation); videos can't be.
  const locationNote = showVideos
    ? "Location data is removed from photos automatically. For videos, turn off location in your camera settings."
    : showImages
      ? "Location data is removed from photos automatically."
      : null;
  const showAudio = acceptedTypes.some(t => t.startsWith("audio") || t === "*/*");

  // Check if a file type matches the accepted types for this field
  const isFileTypeAccepted = useCallback((reportedType: string, fileName = ""): boolean => {
    // Browsers report empty/alias types for some valid media (HEIC, MKV, WAV)
    const mimeType = resolveMimeType(fileName, reportedType);

    // First check if it's a globally allowed type
    if (!isAllowedFileType(mimeType)) return false;

    // If using default ALLOWED_TYPES, accept all allowed types
    if (acceptedTypes === ALLOWED_TYPES) return true;

    // Check if mimeType matches any of the accepted patterns
    return acceptedTypes.some(accepted => {
      if (accepted === "*/*") return true;
      if (accepted === mimeType) return true;
      // Handle wildcard patterns like "image/*"
      if (accepted.endsWith("/*")) {
        const category = accepted.replace("/*", "");
        return mimeType.startsWith(category + "/");
      }
      return false;
    });
  }, [acceptedTypes]);

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
            if (isFileTypeAccepted(file.type, file.name) && file.size <= maxFileSize) {
              validCount++;
              totalSize += file.size;
            } else if (!isFileTypeAccepted(file.type, file.name)) {
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
    [maxFileSize, isFileTypeAccepted]
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
          (file) => isFileTypeAccepted(file.type, file.name) && file.size <= maxFileSize
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

  // Clipboard paste handler. A page of per-field upload buttons has one per
  // field, so the "button" variant never listens: a pasted image would
  // otherwise upload into every field at once.
  useEffect(() => {
    if (variant === "button") return;
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && isFileTypeAccepted(file.type, file.name) && file.size <= maxFileSize) {
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
  }, [disabled, onFilesSelected, maxFileSize, isFileTypeAccepted, variant]);

  // A larger drop target (the field card) given by the parent. Native
  // listeners, so a drop is handled once here and never again by React.
  const dropLatest = useRef({ onFilesSelected, isFileTypeAccepted, maxFileSize, analyzeDataTransfer });
  useEffect(() => {
    dropLatest.current = { onFilesSelected, isFileTypeAccepted, maxFileSize, analyzeDataTransfer };
  });
  useEffect(() => {
    const el = dropTargetRef?.current;
    if (!el || disabled || variant !== "button") return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const reset = () => {
      depth = 0;
      delete el.dataset.dragging;
      setIsDragging(false);
      setDragPreview(null);
    };
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      el.dataset.dragging = "true";
      setIsDragging(true);
      if (e.dataTransfer) setDragPreview(dropLatest.current.analyzeDataTransfer(e.dataTransfer));
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) reset();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      reset();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const { isFileTypeAccepted: accepts, maxFileSize: max, onFilesSelected: select } = dropLatest.current;
      const valid = Array.from(files).filter((file) => accepts(file.type, file.name) && file.size <= max);
      if (valid.length > 0) select(valid);
    };
    el.addEventListener("dragenter", onEnter);
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onEnter);
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
      delete el.dataset.dragging;
    };
  }, [dropTargetRef, disabled, variant]);

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
          (file) => isFileTypeAccepted(file.type, file.name) && file.size <= maxFileSize
        );
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    },
    [disabled, onFilesSelected, maxFileSize, isFileTypeAccepted]
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
            if (isFileTypeAccepted(file.type, file.name) && file.size <= maxFileSize) {
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
  }, [onFilesSelected, maxFileSize, isFileTypeAccepted]);

  const typeWords = getFileTypeDescription();
  const typeWordsCap = typeWords.charAt(0).toUpperCase() + typeWords.slice(1);
  const sizeWords = showMaxFileSize && maxFileSize < MAX_FILE_SIZE ? ` up to ${formatFileSize(maxFileSize)} each` : "";
  const dragOn = isDragging || dropTargetHighlight;

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept={buildAcceptAttribute(acceptedTypes)}
      onChange={handleFileSelect}
      className="hidden"
      disabled={disabled}
      tabIndex={-1}
    />
  );

  const location = locationNote && !hideLocationNote && (
    <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-2">
      <MapPinOff className="mt-0.5 size-3.5 shrink-0 text-icon" aria-hidden="true" />
      <span>{locationNote}</span>
    </p>
  );

  // Full-page overlay while files are dragged over the window
  const renderFullPageOverlay = () => {
    if (!fullPageDrop || !isFullPageDragging) return null;

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(8_9_11/0.86)] px-4" role="presentation">
        <div
          className={cn(
            "w-full max-w-md rounded-[var(--tw-r-tile)] bg-tile-hi p-8 text-center outline-2 outline-dashed",
            dropTargetHighlight ? "outline-acc" : "outline-ctl-hi"
          )}
        >
          <Upload className="mx-auto size-8 text-ink" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold text-ink">Drop to upload</h2>
          {dragPreview && (
            <p className="mt-2 text-sm text-ink-2 tabular-nums">
              {dragPreview.validCount} of {dragPreview.fileCount} files can upload
              {dragPreview.totalSize > 0 && ` · ${formatFileSize(dragPreview.totalSize)}`}
            </p>
          )}
          {dragPreview && dragPreview.invalidTypes.length > 0 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-late">
              <AlertCircle className="size-4" aria-hidden="true" />
              Not accepted here: {dragPreview.invalidTypes.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  };

  const dropHandlers = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  // A single upload button for a field card. Files can still be dropped on it.
  if (variant === "button") {
    return (
      <>
        {renderFullPageOverlay()}
        <div
          className={cn(
            "rounded-[var(--tw-r-ctl)] transition-colors duration-200",
            // with a parent drop target, the parent shows the highlight
            dragOn && !dropTargetRef && "bg-tile-hi outline-2 outline-dashed outline-offset-2 outline-acc",
            className
          )}
          {...(dropTargetRef ? {} : dropHandlers)}
        >
          {fileInput}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              type="button"
              variant={buttonTone === "primary" ? "default" : "outline"}
              className="h-11 w-full gap-2 px-4 text-[15px] sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="size-4" aria-hidden="true" />
              {dragOn ? "Drop to upload" : buttonLabel || "Upload files"}
            </Button>
            {dropHint && (
              <span className="hidden text-[14px] text-ink-2 md:pointer-fine:inline" aria-hidden="true">
                {dragOn && dragPreview
                  ? `${dragPreview.validCount} of ${dragPreview.fileCount} can upload here`
                  : dropHint}
              </span>
            )}
          </div>
          {location}
        </div>
      </>
    );
  }

  if (compact) {
    return (
      <>
        {renderFullPageOverlay()}
        <div
          className={cn(
            "rounded-[var(--tw-r-ctl)] bg-well p-3 outline-1 outline-dashed outline-ctl transition-colors duration-200",
            dragOn && "bg-tile-hi outline-2 outline-acc",
            disabled && "pointer-events-none opacity-60",
            className
          )}
          {...dropHandlers}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{dragOn ? "Drop to upload" : "Add more files"}</p>
              <p className="truncate text-[13px] text-ink-2">
                {typeWordsCap}
                {sizeWords}
              </p>
            </div>
            {fileInput}
            {showPasteButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:size-9"
                onClick={handlePasteFromClipboard}
                disabled={disabled}
                aria-label="Paste from clipboard"
                title="Paste from clipboard"
              >
                <Clipboard className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              Choose files
            </Button>
          </div>
          {location}
        </div>
      </>
    );
  }

  return (
    <>
      {renderFullPageOverlay()}
      <div
        className={cn(
          "relative cursor-pointer rounded-[var(--tw-r-tile)] bg-well px-5 py-8 text-center outline-1 outline-dashed outline-ctl transition-colors duration-200 sm:py-10",
          dragOn ? "bg-tile-hi outline-2 outline-acc" : "hover:outline-ctl-hi",
          disabled && "pointer-events-none opacity-60",
          className
        )}
        onClick={() => !disabled && fileInputRef.current?.click()}
        {...dropHandlers}
      >
        <h3 className="text-[17px] font-semibold text-ink">{dragOn ? "Drop to upload" : "Upload your files"}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
          {dragOn && dragPreview ? (
            <>
              {dragPreview.validCount} of {dragPreview.fileCount} files can upload
              {dragPreview.invalidTypes.length > 0 && (
                <span className="text-late"> (not accepted: {dragPreview.invalidTypes.join(", ")})</span>
              )}
            </>
          ) : (
            `${fullPageDrop ? "Drop files anywhere on the page" : "Drop files here"}, or choose them from your device. ${typeWordsCap}${sizeWords}.`
          )}
        </p>

        <div className="mt-4 flex items-center justify-center gap-3" aria-hidden="true">
          {showImages && <ImageIcon className="size-5 text-icon" />}
          {showVideos && <Video className="size-5 text-icon" />}
          {showAudio && <Music className="size-5 text-icon" />}
        </div>

        {fileInput}

        <div className="mt-5 flex items-center justify-center gap-2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={disabled}
            className="h-11 px-6"
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose files
          </Button>
          {showPasteButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={(e) => {
                e.stopPropagation();
                handlePasteFromClipboard();
              }}
              disabled={disabled}
              aria-label="Paste from clipboard"
              title="Paste from clipboard"
            >
              <Clipboard className="size-4" />
            </Button>
          )}
        </div>

        {showMaxFileSize && maxFileSize < MAX_FILE_SIZE && (
          <p className="mt-4 text-[13px] text-ink-2">Largest file: {formatFileSize(maxFileSize)}</p>
        )}
        {location && <div className="mx-auto max-w-sm text-left">{location}</div>}
      </div>
    </>
  );
}

export default FileDropzone;
