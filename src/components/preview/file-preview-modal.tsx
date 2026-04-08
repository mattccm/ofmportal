"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  Info,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Calendar,
  HardDrive,
  FileType,
  User,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { ImageViewer } from "./image-viewer";
import { VideoPlayer } from "./video-player";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import { format } from "date-fns";
import { toast } from "sonner";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export interface PreviewFile {
  id: string;
  url: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number | bigint;
  uploadedAt?: Date | null;
  createdAt?: Date;
  status?: string;
  creator?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: PreviewFile[];
  initialIndex?: number;
  onDownload?: (file: PreviewFile) => void;
  onShare?: (file: PreviewFile) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    case "APPROVED":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
    default:
      return null;
  }
}

export function FilePreviewModal({
  open,
  onOpenChange,
  files,
  initialIndex = 0,
  onDownload,
  onShare,
}: FilePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [isDismissing, setIsDismissing] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeDirectionRef = useRef<"horizontal" | "vertical" | null>(null);

  const currentFile = files[currentIndex];
  const hasMultipleFiles = files.length > 1;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
      setSwipeOffset({ x: 0, y: 0 });
      setIsDismissing(false);
      setIsSwiping(false);
    }
  }, [open, initialIndex]);

  // Handle image load
  const handleContentLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
    setIsLoading(true);
  }, [files.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
    setIsLoading(true);
  }, [files.length]);

  // Swipe gesture handlers for mobile - only activate for single touch outside of zoomed images
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't handle multi-touch (pinch-to-zoom) - let ImageViewer handle it
    if (e.touches.length > 1) return;

    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipeDirectionRef.current = null;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Don't interfere with multi-touch gestures
    if (e.touches.length > 1) {
      touchStartRef.current = null;
      swipeDirectionRef.current = null;
      setIsSwiping(false);
      setSwipeOffset({ x: 0, y: 0 });
      return;
    }

    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Determine swipe direction if not yet set
    if (!swipeDirectionRef.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      swipeDirectionRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    // Apply appropriate offset based on direction
    if (swipeDirectionRef.current === "vertical" && deltaY > 0) {
      // Only allow downward swipe for dismiss (positive Y)
      setSwipeOffset({ x: 0, y: deltaY });
    } else if (swipeDirectionRef.current === "horizontal" && hasMultipleFiles) {
      setSwipeOffset({ x: deltaX, y: 0 });
    }
  }, [hasMultipleFiles]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) {
      setIsSwiping(false);
      return;
    }

    const { x: offsetX, y: offsetY } = swipeOffset;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocityX = Math.abs(offsetX) / elapsed;
    const velocityY = Math.abs(offsetY) / elapsed;

    // Dismiss threshold: swipe down > 100px or fast swipe > 0.5 velocity
    if (swipeDirectionRef.current === "vertical" && offsetY > 0 && (offsetY > 100 || velocityY > 0.5)) {
      setIsDismissing(true);
      setTimeout(() => onOpenChange(false), 150);
      return;
    }

    // Horizontal navigation threshold: > 50px or fast swipe > 0.3 velocity
    if (swipeDirectionRef.current === "horizontal" && hasMultipleFiles) {
      if (offsetX < -50 || (velocityX > 0.3 && offsetX < 0)) {
        goToNext();
      } else if (offsetX > 50 || (velocityX > 0.3 && offsetX > 0)) {
        goToPrevious();
      }
    }

    // Reset
    setSwipeOffset({ x: 0, y: 0 });
    touchStartRef.current = null;
    swipeDirectionRef.current = null;
    setIsSwiping(false);
  }, [swipeOffset, hasMultipleFiles, goToNext, goToPrevious, onOpenChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          if (hasMultipleFiles) {
            e.preventDefault();
            goToPrevious();
          }
          break;
        case "ArrowRight":
          if (hasMultipleFiles) {
            e.preventDefault();
            goToNext();
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
        case "i":
          e.preventDefault();
          setShowMetadata((prev) => !prev);
          break;
        case "d":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleDownload();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasMultipleFiles, goToPrevious, goToNext, onOpenChange]);

  const handleDownload = useCallback(() => {
    if (onDownload && currentFile) {
      onDownload(currentFile);
    } else if (currentFile?.url) {
      // Default download behavior
      const link = document.createElement("a");
      link.href = currentFile.url;
      link.download = currentFile.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    }
  }, [currentFile, onDownload]);

  const handleShare = useCallback(async () => {
    if (onShare && currentFile) {
      onShare(currentFile);
    } else if (currentFile?.url) {
      // Default share behavior - copy URL to clipboard
      try {
        await navigator.clipboard.writeText(currentFile.url);
        setCopiedLink(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        toast.error("Failed to copy link");
      }
    }
  }, [currentFile, onShare]);

  if (!currentFile) return null;

  const isImage = currentFile.fileType.startsWith("image/");
  const isVideo = currentFile.fileType.startsWith("video/");
  const isAudio = currentFile.fileType.startsWith("audio/");
  const isPdf = currentFile.fileType === "application/pdf";
  const fileSize = typeof currentFile.fileSize === "bigint"
    ? Number(currentFile.fileSize)
    : currentFile.fileSize;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-0 border-0 bg-black/95 gap-0 pb-safe pt-safe overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        hideCloseButton
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isDismissing
            ? `translateY(100%)`
            : swipeOffset.y > 0
            ? `translateY(${swipeOffset.y}px)`
            : swipeOffset.x !== 0
            ? `translateX(${swipeOffset.x}px)`
            : undefined,
          opacity: swipeOffset.y > 0 ? Math.max(0.3, 1 - swipeOffset.y / 300) : 1,
          transition: isSwiping ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out",
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>File Preview: {currentFile.originalName}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 text-white min-w-0">
              {getFileIcon(currentFile.fileType)}
              <span className="font-medium truncate max-w-[120px] sm:max-w-[300px] text-sm sm:text-base">
                {currentFile.originalName}
              </span>
            </div>
            {currentFile.status && getStatusBadge(currentFile.status)}
            {hasMultipleFiles && (
              <span className="text-white/60 text-xs sm:text-sm shrink-0">
                {currentIndex + 1}/{files.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={() => setShowMetadata(!showMetadata)}
              title="File info (I)"
            >
              <Info className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={handleShare}
              title="Share"
            >
              {copiedLink ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
              title="Download (Ctrl+D)"
            >
              <Download className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-white/20 mx-1" />

            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={() => onOpenChange(false)}
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex h-full pt-16 pb-4">
          {/* Preview area */}
          <div
            className={cn(
              "flex-1 flex items-center justify-center px-4 sm:px-16 transition-all",
              showMetadata ? "sm:pr-80" : "",
              hasMultipleFiles ? "pb-24" : "pb-4"
            )}
          >
            {/* Navigation arrows */}
            {hasMultipleFiles && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12"
                  onClick={goToPrevious}
                  title="Previous (Left arrow)"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12",
                    showMetadata && "sm:right-84"
                  )}
                  onClick={goToNext}
                  title="Next (Right arrow)"
                >
                  <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                </Button>
              </>
            )}

            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              </div>
            )}

            {/* Content preview - constrained container */}
            <div className="w-full h-full flex items-center justify-center max-w-[min(100%,1400px)] max-h-full mx-auto">
              {isImage && (
                <ImageViewer
                  src={currentFile.url}
                  alt={currentFile.originalName}
                  onLoad={handleContentLoad}
                />
              )}

              {isVideo && (
                <VideoPlayer
                  src={currentFile.url}
                  onLoad={handleContentLoad}
                />
              )}

              {isAudio && (
                <div className="flex flex-col items-center gap-6 p-8 bg-white/5 rounded-2xl backdrop-blur-sm">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <Music className="h-16 w-16 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-medium text-lg">
                      {currentFile.originalName}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {formatFileSize(fileSize)}
                    </p>
                  </div>
                  <audio
                    src={currentFile.url}
                    controls
                    className="w-full max-w-md"
                    onLoadedMetadata={handleContentLoad}
                  />
                </div>
              )}

              {isPdf && (
                <div className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-2xl backdrop-blur-sm">
                  <div className="w-24 h-24 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <File className="h-12 w-12 text-red-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-medium text-lg">
                      {currentFile.originalName}
                    </h3>
                    <p className="text-white/60 text-sm mb-4">
                      PDF Document - {formatFileSize(fileSize)}
                    </p>
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() => window.open(currentFile.url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in new tab
                    </Button>
                  </div>
                </div>
              )}

              {!isImage && !isVideo && !isAudio && !isPdf && (
                <div className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-2xl backdrop-blur-sm">
                  <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center">
                    <File className="h-12 w-12 text-white/60" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-medium text-lg">
                      {currentFile.originalName}
                    </h3>
                    <p className="text-white/60 text-sm mb-4">
                      {currentFile.fileType} - {formatFileSize(fileSize)}
                    </p>
                    <p className="text-white/40 text-sm">
                      Preview not available for this file type
                    </p>
                    <Button
                      variant="secondary"
                      className="gap-2 mt-4"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                      Download file
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata panel */}
          <div
            className={cn(
              "fixed right-0 top-16 bottom-0 w-80 bg-black/80 backdrop-blur-sm border-l border-white/10 p-6 overflow-y-auto transition-transform duration-300 z-30",
              showMetadata ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold text-lg mb-4">
                  File Information
                </h3>

                <div className="space-y-4">
                  {/* File name */}
                  <div className="space-y-1">
                    <label className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <File className="h-3 w-3" />
                      File Name
                    </label>
                    <p className="text-white text-sm break-all">
                      {currentFile.originalName}
                    </p>
                  </div>

                  {/* File type */}
                  <div className="space-y-1">
                    <label className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <FileType className="h-3 w-3" />
                      File Type
                    </label>
                    <p className="text-white text-sm">{currentFile.fileType}</p>
                  </div>

                  {/* File size */}
                  <div className="space-y-1">
                    <label className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <HardDrive className="h-3 w-3" />
                      File Size
                    </label>
                    <p className="text-white text-sm">
                      {formatFileSize(fileSize)}
                    </p>
                  </div>

                  {/* Upload date */}
                  {(currentFile.uploadedAt || currentFile.createdAt) && (
                    <div className="space-y-1">
                      <label className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        Uploaded
                      </label>
                      <p className="text-white text-sm">
                        {format(
                          new Date(currentFile.uploadedAt || currentFile.createdAt!),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </p>
                    </div>
                  )}

                  {/* Status */}
                  {currentFile.status && (
                    <div className="space-y-1">
                      <label className="text-white/50 text-xs uppercase tracking-wide">
                        Status
                      </label>
                      <div>{getStatusBadge(currentFile.status)}</div>
                    </div>
                  )}

                  {/* Creator */}
                  {currentFile.creator && (
                    <div className="space-y-1">
                      <label className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        Uploaded By
                      </label>
                      <div className="flex items-center gap-2">
                        {currentFile.creator.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentFile.creator.avatar}
                            alt={currentFile.creator.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-medium">
                            {currentFile.creator.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm">
                            {currentFile.creator.name}
                          </p>
                          <p className="text-white/50 text-xs">
                            {currentFile.creator.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-2"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-white hover:bg-white/10"
                  onClick={handleShare}
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail strip for multiple files */}
        {hasMultipleFiles && (
          <div className="absolute bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
              {files.map((file, index) => (
                <button
                  key={file.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsLoading(true);
                  }}
                  className={cn(
                    "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    index === currentIndex
                      ? "border-white scale-110"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {file.fileType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      {getFileIcon(file.fileType)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
