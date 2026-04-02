"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
  FileText,
  Quote,
  Info,
  X,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import type { TemplateField } from "@/lib/template-types";

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

// ============================================
// IMAGE LIGHTBOX COMPONENT
// ============================================

function ImageLightbox({
  src,
  alt,
  caption,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  caption?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
          {caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 text-sm">
              {caption}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Example Video</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-video">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
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
  const [lightboxImage, setLightboxImage] = React.useState<{ url: string; caption?: string } | null>(null);
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

  // Check if there's any content to display
  const hasContent = richContent?.description ||
    richContent?.exampleText ||
    allExampleImages.length > 0 ||
    richContent?.exampleVideoUrl ||
    (richContent?.referenceLinks && richContent.referenceLinks.length > 0);

  if (!hasContent) {
    return null;
  }

  // Card variant - more prominent display like ContentSnare
  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800", className)}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-amber-200/50 dark:border-amber-800/50">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-amber-900 dark:text-amber-100">Instructions & Examples</h4>
            {fieldLabel && (
              <p className="text-xs text-amber-700 dark:text-amber-300">For: {fieldLabel}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          {richContent?.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-amber-800 dark:prose-p:text-amber-200 prose-strong:text-amber-900 dark:prose-strong:text-amber-100">
              <Markdown>{richContent.description}</Markdown>
            </div>
          )}

          {/* Example Text */}
          {richContent?.exampleText && (
            <blockquote className="border-l-4 border-amber-400 pl-4 py-2 text-sm text-amber-800 dark:text-amber-200 italic bg-amber-100/50 dark:bg-amber-900/30 rounded-r-lg">
              {richContent.exampleText}
            </blockquote>
          )}

          {/* Example Images */}
          {allExampleImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Examples</p>
              <div className="flex flex-wrap gap-3">
                {allExampleImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setLightboxImage(img)}
                    className="group relative overflow-hidden rounded-lg border-2 border-amber-200 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
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
            <button
              onClick={() => setShowVideoPlayer(true)}
              className="flex items-center gap-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors w-full"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                <Play className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-medium text-amber-900 dark:text-amber-100 text-sm">Watch Example Video</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Click to play</p>
              </div>
            </button>
          )}

          {/* Reference Links */}
          {richContent?.referenceLinks && richContent.referenceLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Reference Links</p>
              <div className="flex flex-wrap gap-2">
                {richContent.referenceLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {link.label || "View Link"}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.url}
            alt={lightboxImage.caption || `Example for ${fieldLabel || "field"}`}
            caption={lightboxImage.caption}
            open={!!lightboxImage}
            onOpenChange={(open) => !open && setLightboxImage(null)}
          />
        )}

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
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Info className="h-3.5 w-3.5" />
        <span className="font-medium">
          {expanded ? "Hide" : "View"} Instructions & Examples
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50 ml-5 animate-in slide-in-from-top-1 duration-150">
          {/* Description (with markdown) */}
          {richContent?.description && (
            <div>
              <Markdown compact>{richContent.description}</Markdown>
            </div>
          )}

          {/* Example Text */}
          {richContent?.exampleText && (
            <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
              {richContent.exampleText}
            </blockquote>
          )}

          {/* Example Images */}
          {allExampleImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allExampleImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setLightboxImage(img)}
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
          )}

          {/* Example Video */}
          {richContent?.exampleVideoUrl && (
            <button
              onClick={() => setShowVideoPlayer(true)}
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <Play className="h-3.5 w-3.5" />
              Watch Example Video
            </button>
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

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.url}
          alt={lightboxImage.caption || `Example for ${fieldLabel || "field"}`}
          caption={lightboxImage.caption}
          open={!!lightboxImage}
          onOpenChange={(open) => !open && setLightboxImage(null)}
        />
      )}

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
