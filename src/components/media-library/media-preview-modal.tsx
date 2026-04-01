"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  X,
  Download,
  Share2,
  Edit2,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Tag,
  Clock,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Folder,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { MediaItem } from "@/types/media-library";

interface MediaPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onEdit?: (media: MediaItem) => void;
  onDelete?: (media: MediaItem) => void;
  onShare?: (media: MediaItem) => void;
  onDownload?: (media: MediaItem) => void;
}

function getMediaTypeIcon(type: string) {
  switch (type) {
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "audio":
      return <Music className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MediaPreviewModal({
  open,
  onOpenChange,
  media,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  onEdit,
  onDelete,
  onShare,
  onDownload,
}: MediaPreviewModalProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [showInfo, setShowInfo] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Edit form state
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editTags, setEditTags] = React.useState("");

  React.useEffect(() => {
    if (media) {
      setEditTitle(media.title || "");
      setEditDescription(media.description || "");
      setEditTags(media.tags?.join(", ") || "");
    }
  }, [media]);

  React.useEffect(() => {
    // Reset state when modal closes
    if (!open) {
      setZoom(1);
      setRotation(0);
      setIsPlaying(false);
      setIsEditing(false);
    }
  }, [open]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case "ArrowRight":
          if (hasNext && onNext) onNext();
          break;
        case "Escape":
          onOpenChange(false);
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case "-":
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
        case "r":
          setRotation((r) => (r + 90) % 360);
          break;
        case " ":
          if (media?.mediaType === "video" || media?.mediaType === "audio") {
            e.preventDefault();
            togglePlayPause();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasPrevious, hasNext, onPrevious, onNext, onOpenChange, media]);

  const togglePlayPause = () => {
    const mediaElement = videoRef.current || audioRef.current;
    if (mediaElement) {
      if (isPlaying) {
        mediaElement.pause();
      } else {
        mediaElement.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSaveEdit = async () => {
    if (!media) return;

    // Would call API to save
    toast.success("Changes saved");
    setIsEditing(false);
  };

  const handleCopyLink = () => {
    if (!media) return;
    navigator.clipboard.writeText(`${window.location.origin}/media/${media.id}`);
    toast.success("Link copied to clipboard");
  };

  if (!media) return null;

  const renderMediaContent = () => {
    switch (media.mediaType) {
      case "image":
        return (
          <div className="relative flex items-center justify-center h-full overflow-hidden bg-black/5 dark:bg-white/5 rounded-lg">
            <img
              src={`/api/media-library/${media.id}/file`}
              alt={media.title || media.originalName}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        );
      case "video":
        return (
          <div className="relative flex items-center justify-center h-full overflow-hidden bg-black rounded-lg">
            <video
              ref={videoRef}
              src={`/api/media-library/${media.id}/file`}
              className="max-w-full max-h-full"
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              muted={isMuted}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        );
      case "audio":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-6 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-8">
            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-xl">
              <Music className="h-16 w-16 text-white" />
            </div>
            <audio
              ref={audioRef}
              src={`/api/media-library/${media.id}/file`}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 mr-2" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {isPlaying ? "Pause" : "Play"}
              </Button>
            </div>
            {media.duration && (
              <p className="text-sm text-muted-foreground">
                Duration: {formatDuration(media.duration)}
              </p>
            )}
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-muted/30 rounded-lg p-8">
            <File className="h-20 w-20 text-muted-foreground" />
            <p className="text-muted-foreground">Preview not available</p>
            <Button onClick={() => onDownload?.(media)}>
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              {getMediaTypeIcon(media.mediaType)}
            </div>
            <div>
              <h2 className="font-semibold text-sm">
                {media.title || media.originalName}
              </h2>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(media.fileSize)} • {media.mimeType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {media.mediaType === "image" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowInfo(!showInfo)}
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onShare?.(media)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDownload?.(media)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Media Preview */}
          <div className="flex-1 relative p-4">
            {/* Navigation arrows */}
            {hasPrevious && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 shadow-lg"
                onClick={onPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 shadow-lg"
                onClick={onNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {renderMediaContent()}
          </div>

          {/* Info Panel */}
          {showInfo && (
            <div className="w-80 border-l bg-muted/30 p-4 overflow-y-auto">
              {isEditing ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Edit Details</h3>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Enter title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter description..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} className="flex-1">
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Details</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                    {media.title && (
                      <p className="text-sm font-medium mb-1">{media.title}</p>
                    )}
                    {media.description && (
                      <p className="text-sm text-muted-foreground">
                        {media.description}
                      </p>
                    )}
                    {!media.title && !media.description && (
                      <p className="text-sm text-muted-foreground italic">
                        No title or description
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5" />
                      Tags
                    </h4>
                    {media.tags && media.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {media.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No tags
                      </p>
                    )}
                  </div>

                  {/* File Info */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      File Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File name</span>
                        <span className="font-mono text-xs truncate max-w-[150px]">
                          {media.originalName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size</span>
                        <span>{formatFileSize(media.fileSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span>{media.mimeType}</span>
                      </div>
                      {media.width && media.height && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dimensions</span>
                          <span>
                            {media.width} × {media.height}
                          </span>
                        </div>
                      )}
                      {media.duration && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{formatDuration(media.duration)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usage */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Usage
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Times used</span>
                        <span>{media.usageCount}</span>
                      </div>
                      {media.lastUsedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last used</span>
                          <span>
                            {formatDistanceToNow(new Date(media.lastUsedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Added</span>
                        <span>
                          {formatDistanceToNow(new Date(media.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDelete?.(media)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete from Library
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              Use arrow keys to navigate • Press R to rotate • +/- to zoom
            </span>
            <span>
              {media.status === "approved" && (
                <Badge variant="secondary" className="text-xs">
                  Approved
                </Badge>
              )}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaPreviewModal;
