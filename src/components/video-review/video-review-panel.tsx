"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Video,
  Clock,
  MessageSquare,
  AlertCircle,
  ThumbsUp,
  Check,
  Loader2,
  Keyboard,
  Sidebar,
  SidebarClose,
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type VideoTimestamp,
  type CreateTimestampPayload,
  formatTimestamp,
} from "@/types/video-timestamps";
import {
  VideoPlayerWithTimestamps,
  type VideoPlayerRef,
} from "./video-player-with-timestamps";
import { TimestampList } from "./timestamp-list";
import { TimestampForm } from "./timestamp-form";

// ============================================
// TYPES
// ============================================

interface VideoReviewPanelProps {
  uploadId: string;
  videoSrc: string;
  videoPoster?: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: () => void;
  currentUser?: {
    id: string;
    name: string;
  };
}

// ============================================
// VIDEO REVIEW PANEL
// ============================================

export function VideoReviewPanel({
  uploadId,
  videoSrc,
  videoPoster,
  fileName,
  open,
  onOpenChange,
  onDownload,
  currentUser = { id: "", name: "Unknown" },
}: VideoReviewPanelProps) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [timestamps, setTimestamps] = useState<VideoTimestamp[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<VideoTimestamp | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [showTimestampForm, setShowTimestampForm] = useState(false);
  const [timestampFormTime, setTimestampFormTime] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Load timestamps when panel opens
  useEffect(() => {
    if (open) {
      loadTimestamps();
    }
  }, [open, uploadId]);

  // Keyboard shortcuts for panel
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "?":
          e.preventDefault();
          setShowShortcuts(true);
          break;

        case "escape":
          if (showTimestampForm) {
            setShowTimestampForm(false);
          } else if (selectedTimestamp) {
            setSelectedTimestamp(null);
          } else {
            onOpenChange(false);
          }
          break;

        case "b":
          e.preventDefault();
          setIsSidebarVisible((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, showTimestampForm, selectedTimestamp, onOpenChange]);

  const loadTimestamps = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/timestamps`);
      if (!response.ok) throw new Error("Failed to load timestamps");
      const data = await response.json();
      setTimestamps(data.timestamps || []);
    } catch (error) {
      console.error("Failed to load timestamps:", error);
      toast.error("Failed to load video timestamps");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTimestamp = async (payload: CreateTimestampPayload) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/timestamps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to create timestamp");

      const data = await response.json();
      setTimestamps((prev) => [...prev, data.timestamp]);
      toast.success("Timestamp added");
    } catch (error) {
      console.error("Failed to create timestamp:", error);
      toast.error("Failed to add timestamp");
      throw error;
    }
  };

  const handleResolveTimestamp = async (id: string, resolved: boolean) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/timestamps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved }),
      });

      if (!response.ok) throw new Error("Failed to update timestamp");

      setTimestamps((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                resolved,
                resolvedAt: resolved ? new Date() : undefined,
                resolvedById: resolved ? currentUser.id : undefined,
              }
            : t
        )
      );

      toast.success(resolved ? "Timestamp resolved" : "Timestamp reopened");
    } catch (error) {
      console.error("Failed to update timestamp:", error);
      toast.error("Failed to update timestamp");
    }
  };

  const handleBulkResolve = async (ids: string[], resolved: boolean) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/timestamps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, resolved }),
      });

      if (!response.ok) throw new Error("Failed to update timestamps");

      setTimestamps((prev) =>
        prev.map((t) =>
          ids.includes(t.id)
            ? {
                ...t,
                resolved,
                resolvedAt: resolved ? new Date() : undefined,
                resolvedById: resolved ? currentUser.id : undefined,
              }
            : t
        )
      );

      toast.success(`${ids.length} timestamps ${resolved ? "resolved" : "reopened"}`);
    } catch (error) {
      console.error("Failed to update timestamps:", error);
      toast.error("Failed to update timestamps");
    }
  };

  const handleReply = async (timestampId: string, comment: string) => {
    try {
      const response = await fetch(
        `/api/uploads/${uploadId}/timestamps/${timestampId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        }
      );

      if (!response.ok) throw new Error("Failed to add reply");

      const data = await response.json();
      setTimestamps((prev) =>
        prev.map((t) =>
          t.id === timestampId
            ? { ...t, replies: [...(t.replies || []), data.reply] }
            : t
        )
      );

      toast.success("Reply added");
    } catch (error) {
      console.error("Failed to add reply:", error);
      toast.error("Failed to add reply");
      throw error;
    }
  };

  const handleDeleteTimestamp = async (id: string) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}/timestamps?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete timestamp");

      setTimestamps((prev) => prev.filter((t) => t.id !== id));
      if (selectedTimestamp?.id === id) {
        setSelectedTimestamp(null);
      }

      toast.success("Timestamp deleted");
    } catch (error) {
      console.error("Failed to delete timestamp:", error);
      toast.error("Failed to delete timestamp");
    }
  };

  const handleJumpTo = useCallback((time: number) => {
    playerRef.current?.seek(time);
  }, []);

  const handleAddTimestamp = useCallback((time: number) => {
    setTimestampFormTime(time);
    setShowTimestampForm(true);
  }, []);

  const handleTimestampSelect = useCallback((timestamp: VideoTimestamp | null) => {
    setSelectedTimestamp(timestamp);
    if (timestamp) {
      handleJumpTo(timestamp.timestamp);
    }
  }, [handleJumpTo]);

  // Stats
  const stats = {
    total: timestamps.length,
    issues: timestamps.filter((t) => t.type === "issue" && !t.resolved).length,
    resolved: timestamps.filter((t) => t.resolved).length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-6xl sm:max-w-6xl p-0 gap-0" side="right">
        <SheetHeader className="sr-only">
          <SheetTitle>Video Review - {fileName}</SheetTitle>
          <SheetDescription>
            Review video with timestamp comments and annotations
          </SheetDescription>
        </SheetHeader>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold truncate max-w-md">{fileName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {stats.total} timestamps
                </Badge>
                {stats.issues > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {stats.issues} open issues
                  </Badge>
                )}
                {stats.resolved > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  >
                    <Check className="h-3 w-3" />
                    {stats.resolved} resolved
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">Shortcuts</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            >
              {isSidebarVisible ? (
                <SidebarClose className="h-4 w-4" />
              ) : (
                <Sidebar className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isSidebarVisible ? "Hide" : "Show"} sidebar
              </span>
            </Button>

            {onDownload && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onDownload}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 h-[calc(100vh-80px)]">
          <ResizablePanelGroup direction="horizontal">
            {/* Video Player */}
            <ResizablePanel defaultSize={isSidebarVisible ? 65 : 100} minSize={50}>
              <div className="h-full flex flex-col bg-black">
                <VideoPlayerWithTimestamps
                  ref={playerRef}
                  src={videoSrc}
                  poster={videoPoster}
                  timestamps={timestamps}
                  onTimeUpdate={setCurrentTime}
                  onAddTimestamp={handleAddTimestamp}
                  onTimestampSelect={handleTimestampSelect}
                  onTimestampResolve={handleResolveTimestamp}
                  selectedTimestampId={selectedTimestamp?.id}
                  className="flex-1"
                />
              </div>
            </ResizablePanel>

            {/* Sidebar */}
            {isSidebarVisible && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
                  <div className="h-full bg-background">
                    <TimestampList
                      timestamps={timestamps}
                      currentTime={currentTime}
                      onJumpTo={handleJumpTo}
                      onResolve={handleResolveTimestamp}
                      onBulkResolve={handleBulkResolve}
                      onReply={handleReply}
                      onDelete={handleDeleteTimestamp}
                      selectedTimestampId={selectedTimestamp?.id}
                      onSelectTimestamp={handleTimestampSelect}
                      currentUserId={currentUser.id}
                      isLoading={isLoading}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* Add Timestamp Form */}
        <TimestampForm
          uploadId={uploadId}
          currentTime={timestampFormTime}
          duration={playerRef.current?.getDuration() || 0}
          onSubmit={handleCreateTimestamp}
          onCancel={() => setShowTimestampForm(false)}
          open={showTimestampForm}
          onOpenChange={setShowTimestampForm}
          videoElement={playerRef.current?.getVideoElement()}
        />

        {/* Keyboard Shortcuts Modal */}
        {showShortcuts && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
            onClick={() => setShowShortcuts(false)}
          >
            <div
              className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowShortcuts(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Playback
                  </h4>
                  <div className="space-y-1 text-sm">
                    <ShortcutItem keys={["Space", "K"]} description="Play / Pause" />
                    <ShortcutItem keys={["Left Arrow"]} description="Rewind 5 seconds" />
                    <ShortcutItem keys={["Right Arrow"]} description="Forward 5 seconds" />
                    <ShortcutItem keys={["J"]} description="Rewind 10 seconds" />
                    <ShortcutItem keys={["L"]} description="Forward 10 seconds" />
                    <ShortcutItem keys={[","]} description="Previous frame" />
                    <ShortcutItem keys={["."]} description="Next frame" />
                    <ShortcutItem keys={["0-9"]} description="Jump to 0-90%" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Markers
                  </h4>
                  <div className="space-y-1 text-sm">
                    <ShortcutItem keys={["Shift", "M"]} description="Add marker" />
                    <ShortcutItem keys={["M"]} description="Toggle mute" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    View
                  </h4>
                  <div className="space-y-1 text-sm">
                    <ShortcutItem keys={["F"]} description="Toggle fullscreen" />
                    <ShortcutItem keys={["B"]} description="Toggle sidebar" />
                    <ShortcutItem keys={["?"]} description="Show shortcuts" />
                    <ShortcutItem keys={["Esc"]} description="Close panel" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ShortcutItem({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index}>
            {index > 0 && <span className="text-muted-foreground mx-1">+</span>}
            <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
              {key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

export default VideoReviewPanel;
