"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";
import type { TemplateField } from "@/lib/template-types";

// Note: Dialog imports kept for VideoPlayer component

// Sanitize HTML to prevent XSS while keeping formatting
function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

// ============================================
// TYPES
// ============================================

interface FieldExamplesDisplayProps {
  richContent: TemplateField["richContent"];
  fieldLabel?: string;
  className?: string;
  /** Start expanded - now defaults to TRUE for better visibility */
  defaultExpanded?: boolean;
  /** Variant: 'inline' shows within field, 'card' shows as prominent card */
  variant?: "inline" | "card";
}

// ============================================
// VIDEO EMBED HELPERS
// ============================================

function getVideoEmbedUrl(url: string): { type: "youtube" | "vimeo" | "direct"; embedUrl: string } | null {
  if (!url) return null;

  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // Direct video URL
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return { type: "direct", embedUrl: url };
  }

  return null;
}

/**
 * Get a thumbnail URL for a video. For YouTube/Vimeo, uses their thumbnail APIs.
 * For direct videos, returns null (we'll use a video element to generate one).
 */
function getVideoThumbnailUrl(url: string): string | null {
  if (!url) return null;

  // YouTube - use high-quality thumbnail
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
  }

  // Vimeo - we can't get thumbnail without API call, so return null
  return null;
}

// ============================================
// VIDEO THUMBNAIL COMPONENT
// ============================================

function VideoThumbnail({ url, onClick }: { url: string; onClick: () => void }) {
  const [thumbnailSrc, setThumbnailSrc] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    // First try platform-specific thumbnails
    const platformThumb = getVideoThumbnailUrl(url);
    if (platformThumb) {
      setThumbnailSrc(platformThumb);
      return;
    }

    // For direct videos, capture a frame using a hidden video element
    const videoInfo = getVideoEmbedUrl(url);
    if (videoInfo?.type === "direct") {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = true;
      video.src = videoInfo.embedUrl;

      video.addEventListener("loadeddata", () => {
        video.currentTime = 1; // seek to 1 second
      });

      video.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            setThumbnailSrc(canvas.toDataURL("image/jpeg", 0.7));
          }
        } catch {
          // CORS or other error - leave as null
        }
      });

      return () => {
        video.src = "";
      };
    }
  }, [url]);

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
    >
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt="Video example"
          className="h-20 w-auto max-w-[140px] object-cover"
        />
      ) : (
        <div className="h-20 w-[120px] bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Play className="h-6 w-6 text-slate-500" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
          <Play className="h-4 w-4 text-white fill-white" />
        </div>
      </div>
    </button>
  );
}

// ============================================
// VIDEO PLAYER COMPONENT
// ============================================

function VideoPlayer({
  url,
  open,
  onOpenChange,
}: {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoInfo = getVideoEmbedUrl(url);

  if (!videoInfo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Example Video</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-video">
          {videoInfo.type === "direct" ? (
            <video
              src={videoInfo.embedUrl}
              controls
              autoPlay
              className="w-full h-full"
            />
          ) : (
            <iframe
              src={videoInfo.embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FieldExamplesDisplay({
  richContent,
  fieldLabel,
  className,
  defaultExpanded = true, // Changed to true by default
  variant = "inline",
}: FieldExamplesDisplayProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = React.useState(false);

  // Combine legacy single image with new array format
  const allExampleImages = React.useMemo(() => {
    const images: { url: string; caption?: string }[] = [];

    // Add images from the new array format
    if (richContent?.exampleImages) {
      images.push(...richContent.exampleImages.filter(img => img.url));
    }

    // Add legacy single image if exists and not already in array
    if (richContent?.exampleImageUrl) {
      const legacyExists = images.some(img => img.url === richContent.exampleImageUrl);
      if (!legacyExists) {
        images.push({ url: richContent.exampleImageUrl });
      }
    }

    return images;
  }, [richContent?.exampleImages, richContent?.exampleImageUrl]);

  // Convert to PreviewFile format for FilePreviewModal
  const previewFiles: PreviewFile[] = React.useMemo(() =>
    allExampleImages.map((img, index) => ({
      id: `example-${index}`,
      url: img.url,
      fileName: img.caption || `Example ${index + 1}`,
      originalName: img.caption || `Example ${index + 1}`,
      fileType: "image/jpeg",
      fileSize: 0,
    }))
  , [allExampleImages]);

  const handleImageClick = (index: number) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  // Check if there's any content to display
  const hasContent = richContent?.description ||
    richContent?.exampleText ||
    allExampleImages.length > 0 ||
    richContent?.exampleVideoUrl ||
    (richContent?.referenceLinks && richContent.referenceLinks.length > 0);

  if (!hasContent) {
    return null;
  }

  const examplesLabel = richContent?.examplesLabel || "Examples";
  const canToggleExamples = richContent?.showExamplesToggle !== false;

  // Card variant - more prominent display
  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700", className)}>
        {/* Header - clickable to expand/collapse */}
        {canToggleExamples ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 p-4 w-full text-left border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-slate-900 dark:text-slate-100">{examplesLabel}</h4>
              {!expanded && (
                <p className="text-xs text-slate-600 dark:text-slate-400">Click to expand</p>
              )}
            </div>
          </button>
        ) : examplesLabel ? (
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">{examplesLabel}</h4>
          </div>
        ) : null}

        {/* Content - show when expanded or when toggle is disabled */}
        {(expanded || !canToggleExamples) && (
        <div className="p-4 space-y-4">
          {/* Description - Render HTML from WYSIWYG editor */}
          {richContent?.description && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(richContent.description) }}
            />
          )}

          {/* Example Text */}
          {richContent?.exampleText && (
            <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 py-2 text-sm text-slate-700 dark:text-slate-300 italic bg-slate-100/50 dark:bg-slate-800/50 rounded-r-lg">
              {richContent.exampleText}
            </blockquote>
          )}

          {/* Example Images */}
          {allExampleImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{examplesLabel}</p>
              <div className="flex flex-wrap gap-3">
                {allExampleImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageClick(index)}
                    className="group relative overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || `Example ${index + 1}`}
                      className="h-20 w-auto max-w-[140px] object-cover"
                      onError={(e) => {
                        e.currentTarget.parentElement!.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    {img.caption && (
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1.5 py-0.5 truncate">
                        {img.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Example Video */}
          {richContent?.exampleVideoUrl && (
            <div className="space-y-2">
              {allExampleImages.length === 0 && (
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Video</p>
              )}
              <div className="flex flex-wrap gap-3">
                <VideoThumbnail
                  url={richContent.exampleVideoUrl}
                  onClick={() => setShowVideoPlayer(true)}
                />
              </div>
            </div>
          )}

          {/* Reference Links */}
          {richContent?.referenceLinks && richContent.referenceLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Reference Links</p>
              <div className="flex flex-wrap gap-2">
                {richContent.referenceLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {link.label || "View Link"}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Preview Modal with swipe support */}
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          files={previewFiles}
          initialIndex={previewIndex}
        />

        {richContent?.exampleVideoUrl && (
          <VideoPlayer
            url={richContent.exampleVideoUrl}
            open={showVideoPlayer}
            onOpenChange={setShowVideoPlayer}
          />
        )}
      </div>
    );
  }

  // Inline variant - collapsible within field
  return (
    <div className={cn("space-y-2", className)}>
      {/* Expand/Collapse Toggle */}
      {canToggleExamples ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">
            {expanded ? "Hide" : "View"} {examplesLabel}
          </span>
        </button>
      ) : examplesLabel ? (
        <p className="text-xs font-medium text-muted-foreground">{examplesLabel}</p>
      ) : null}

      {/* Content */}
      {(expanded || !canToggleExamples) && (
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50 ml-5 animate-in slide-in-from-top-1 duration-150">
          {/* Description - Render HTML from WYSIWYG editor */}
          {richContent?.description && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(richContent.description) }}
            />
          )}

          {/* Example Text */}
          {richContent?.exampleText && (
            <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
              {richContent.exampleText}
            </blockquote>
          )}

          {/* Example Images */}
          {allExampleImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{examplesLabel}</p>
              <div className="flex flex-wrap gap-2">
                {allExampleImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageClick(index)}
                    className="group relative overflow-hidden rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || `Example ${index + 1}`}
                      className="h-16 w-auto max-w-[100px] object-cover"
                      onError={(e) => {
                        e.currentTarget.parentElement!.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Example Video */}
          {richContent?.exampleVideoUrl && (
            <div className="flex flex-wrap gap-2">
              <VideoThumbnail
                url={richContent.exampleVideoUrl}
                onClick={() => setShowVideoPlayer(true)}
              />
            </div>
          )}

          {/* Reference Links */}
          {richContent?.referenceLinks && richContent.referenceLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {richContent.referenceLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal with swipe support */}
      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={previewFiles}
        initialIndex={previewIndex}
      />

      {richContent?.exampleVideoUrl && (
        <VideoPlayer
          url={richContent.exampleVideoUrl}
          open={showVideoPlayer}
          onOpenChange={setShowVideoPlayer}
        />
      )}
    </div>
  );
}

export default FieldExamplesDisplay;
