"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  Video,
  Music,
  File,
  Download,
  Check,
  X,
  Star,
  Loader2,
  Calendar,
  HardDrive,
  User,
  Clock,
  MessageSquare,
  History,
  ChevronRight,
  ExternalLink,
  Play,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import { CommentSection } from "@/components/comments/comment-section";
import { VersionHistory } from "@/components/uploads/version-history";
import { InlineNotes } from "@/components/notes/notes-panel";
import { type Note } from "@/lib/notes-utils";
import { GitCompare, StickyNote, PanelRightOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCreatorContextPanel,
  useSetCreatorContext,
} from "@/components/providers/creator-context-provider";

interface TimelineEvent {
  id: string;
  action: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string | null;
  };
  metadata?: Record<string, unknown>;
}

interface Comment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string;
  };
}

export interface UploadDetails {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint | number;
  storageKey: string;
  thumbnailKey?: string | null;
  thumbnailUrl?: string | null;
  uploadStatus: string;
  status: string;
  reviewNote?: string | null;
  rating?: number | null;
  uploadedAt: Date | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  creator: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  request: {
    id: string;
    title: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
    avatar?: string | null;
  } | null;
  comments?: Comment[];
}

interface UploadReviewPanelProps {
  upload: UploadDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewComplete?: () => void;
  currentUser?: {
    id: string;
    name: string;
  };
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="outline" className="badge-warning border">
          Pending Review
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="outline" className="badge-success border">
          Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="badge-error border">
          Rejected
        </Badge>
      );
    default:
      return null;
  }
}

function StarRating({
  rating,
  onRatingChange,
  disabled = false,
  size = "md",
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "p-0.5 transition-all duration-150",
            disabled ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
          )}
          onMouseEnter={() => !disabled && setHoverRating(star)}
          onMouseLeave={() => !disabled && setHoverRating(0)}
          onClick={() => !disabled && onRatingChange(star)}
        >
          <Star
            className={cn(
              iconSize,
              "transition-colors",
              (hoverRating || rating) >= star
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function UploadReviewPanel({
  upload,
  open,
  onOpenChange,
  onReviewComplete,
  currentUser = { id: "", name: "Unknown" },
}: UploadReviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  // Creator context panel integration
  const { openCreatorContext } = useCreatorContextPanel();
  useSetCreatorContext(upload?.creator?.id || null);

  // Reset state when upload changes
  useEffect(() => {
    if (upload) {
      setRating(upload.rating || 0);
      setReviewNotes(upload.reviewNote || "");
      setPreviewUrl(null);
      setNotes([]);
      loadPreview();
      loadTimeline();
      loadNotes();
    }
  }, [upload?.id]);

  const loadNotes = async () => {
    if (!upload) return;

    try {
      const response = await fetch(
        `/api/notes?entityType=upload&entityId=${upload.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch {
      console.error("Failed to load notes");
    }
  };

  // Note handlers
  const handleAddNote = async (content: string, isPinned: boolean) => {
    if (!upload) return;

    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "upload",
        entityId: upload.id,
        content,
        isPinned,
        isInternal: true,
      }),
    });

    if (!response.ok) throw new Error("Failed to add note");

    const { note } = await response.json();
    setNotes([note, ...notes]);
  };

  const handleEditNote = async (noteId: string, content: string) => {
    const response = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, content }),
    });

    if (!response.ok) throw new Error("Failed to update note");

    const { note: updatedNote } = await response.json();
    setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
  };

  const handleDeleteNote = async (noteId: string) => {
    const response = await fetch(`/api/notes?noteId=${noteId}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete note");

    setNotes(notes.filter((n) => n.id !== noteId));
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    const response = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, isPinned }),
    });

    if (!response.ok) throw new Error("Failed to update note");

    const { note: updatedNote } = await response.json();
    setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
  };

  const loadPreview = async () => {
    if (!upload) return;

    setLoadingPreview(true);
    try {
      const response = await fetch(`/api/uploads/${upload.id}/url`);
      if (!response.ok) throw new Error("Failed to get preview URL");
      const { url } = await response.json();
      setPreviewUrl(url);
    } catch {
      console.error("Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadTimeline = async () => {
    if (!upload) return;

    setLoadingTimeline(true);
    try {
      const response = await fetch(`/api/uploads/${upload.id}/timeline`);
      if (response.ok) {
        const data = await response.json();
        setTimeline(data.timeline || []);
      }
    } catch {
      console.error("Failed to load timeline");
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleDownload = async () => {
    if (!upload) return;

    try {
      const url = previewUrl || (await fetchPreviewUrl());
      if (!url) throw new Error("No URL available");

      const link = document.createElement("a");
      link.href = url;
      link.download = upload.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download file");
    }
  };

  const fetchPreviewUrl = async (): Promise<string | null> => {
    if (!upload) return null;

    try {
      const response = await fetch(`/api/uploads/${upload.id}/url`);
      if (!response.ok) return null;
      const { url } = await response.json();
      return url;
    } catch {
      return null;
    }
  };

  const handleApprove = async () => {
    if (!upload) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/uploads/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: upload.id,
          action: "approve",
          rating,
          notes: reviewNotes,
        }),
      });

      if (!response.ok) throw new Error("Failed to approve upload");

      toast.success("Upload approved successfully");
      onOpenChange(false);
      onReviewComplete?.();
    } catch {
      toast.error("Failed to approve upload");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!upload) return;

    if (!reviewNotes.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/uploads/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: upload.id,
          action: "reject",
          rating,
          notes: reviewNotes,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject upload");

      toast.success("Upload rejected");
      onOpenChange(false);
      onReviewComplete?.();
    } catch {
      toast.error("Failed to reject upload");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!upload) return null;

  const fileSize = typeof upload.fileSize === "bigint" ? Number(upload.fileSize) : upload.fileSize;
  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const isAudio = upload.fileType.startsWith("audio/");
  const isPending = upload.status === "PENDING";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg font-semibold truncate pr-4">
                  {upload.originalName}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  {getStatusBadge(upload.status)}
                  <span className="text-muted-foreground">
                    {formatFileSize(fileSize)}
                  </span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="sticky top-[85px] z-10 bg-background border-b px-6">
            <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
              <TabsTrigger
                value="preview"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                Preview
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Comments
                {upload.comments && upload.comments.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                    {upload.comments.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <History className="h-4 w-4 mr-1.5" />
                History
              </TabsTrigger>
              <TabsTrigger
                value="versions"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:border-indigo-500 data-[state=active]:text-foreground"
              >
                <GitCompare className="h-4 w-4 mr-1.5" />
                Versions
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-medium data-[state=active]:border-amber-500 data-[state=active]:text-foreground"
              >
                <StickyNote className="h-4 w-4 mr-1.5" />
                Notes
                {notes.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 text-xs">
                    {notes.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Preview Tab */}
          <TabsContent value="preview" className="m-0 p-6 space-y-6">
            {/* File Preview */}
            <div className="rounded-xl bg-muted/30 overflow-hidden">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="relative">
                  {isImage && previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={upload.originalName}
                      className="w-full max-h-[400px] object-contain"
                    />
                  )}
                  {isVideo && previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      className="w-full max-h-[400px]"
                      poster={upload.thumbnailUrl || undefined}
                    />
                  )}
                  {isAudio && previewUrl && (
                    <div className="p-8 flex flex-col items-center gap-4">
                      <div className="rounded-full bg-muted p-6">
                        <Music className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <audio src={previewUrl} controls className="w-full" />
                    </div>
                  )}
                  {!previewUrl && !loadingPreview && (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                      <div className="rounded-full bg-muted p-4">
                        {getFileIcon(upload.fileType)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Preview not available
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                disabled={!previewUrl}
              >
                <ExternalLink className="h-4 w-4" />
                Open Full
              </Button>
            </div>

            <Separator />

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">File Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <File className="h-3.5 w-3.5" />
                    Type
                  </p>
                  <p className="font-medium">{upload.fileType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" />
                    Size
                  </p>
                  <p className="font-medium">{formatFileSize(fileSize)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Uploaded
                  </p>
                  <p className="font-medium">
                    {upload.uploadedAt
                      ? format(new Date(upload.uploadedAt), "MMM d, yyyy h:mm a")
                      : "In progress"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Status
                  </p>
                  <p className="font-medium capitalize">
                    {upload.uploadStatus.toLowerCase().replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Creator Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Creator</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar user={upload.creator} size="md" />
                  <div>
                    <p className="font-medium">{upload.creator.name}</p>
                    <p className="text-sm text-muted-foreground">{upload.creator.email}</p>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCreatorContext(upload.creator.id)}
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View creator context (C)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Separator />

            {/* Request Link */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Content Request</h3>
              <a
                href={`/dashboard/requests/${upload.request.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium">{upload.request.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>

            {/* Review Section (only for pending) */}
            {isPending && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Review</h3>

                  {/* Rating */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Quality Rating
                    </label>
                    <StarRating rating={rating} onRatingChange={setRating} />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Review Notes
                      {!isPending || (isPending && upload.status === "REJECTED") ? (
                        <span className="text-destructive ml-1">*</span>
                      ) : (
                        " (optional)"
                      )}
                    </label>
                    <Textarea
                      placeholder={
                        isPending
                          ? "Add notes for this review..."
                          : "Provide feedback for the creator..."
                      }
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Existing Review (if already reviewed) */}
            {!isPending && upload.reviewNote && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Review Notes</h3>
                  {upload.rating && (
                    <div className="flex items-center gap-2">
                      <StarRating rating={upload.rating} onRatingChange={() => {}} disabled />
                      <span className="text-sm text-muted-foreground">
                        {upload.rating}/5
                      </span>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
                    {upload.reviewNote}
                  </div>
                  {upload.reviewedBy && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar user={upload.reviewedBy} size="xs" />
                      Reviewed by {upload.reviewedBy.name}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="m-0 p-6">
            <CommentSection
              requestId={upload.request.id}
              uploadId={upload.id}
              comments={upload.comments || []}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="m-0 p-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Status History</h3>

              {loadingTimeline ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No history available</p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />

                  {timeline.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          "relative z-10 mt-1.5 h-6 w-6 rounded-full border-2 bg-background flex items-center justify-center",
                          event.action.includes("approved")
                            ? "border-emerald-500"
                            : event.action.includes("rejected")
                            ? "border-red-500"
                            : event.action.includes("version")
                            ? "border-indigo-500"
                            : "border-muted-foreground"
                        )}
                      >
                        {event.action.includes("approved") ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : event.action.includes("rejected") ? (
                          <X className="h-3 w-3 text-red-500" />
                        ) : event.action.includes("version") ? (
                          <GitCompare className="h-3 w-3 text-indigo-500" />
                        ) : (
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm font-medium">
                          {event.action
                            .replace("upload.", "")
                            .replace(/_/g, " ")
                            .replace(/^\w/, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(event.timestamp), {
                            addSuffix: true,
                          })}
                          {event.user && (
                            <span className="ml-1">by {event.user.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="m-0 p-6">
            <VersionHistory
              uploadId={upload.id}
              onVersionRestore={() => {
                // Reload the upload data after restoring
                loadPreview();
                loadTimeline();
                onReviewComplete?.();
              }}
            />
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="m-0 p-6">
            <InlineNotes
              entityType="upload"
              entityId={upload.id}
              notes={notes}
              currentUser={currentUser}
              onAddNote={handleAddNote}
              onEditNote={handleEditNote}
              onDeleteNote={handleDeleteNote}
              onTogglePin={handleTogglePin}
            />
          </TabsContent>
        </Tabs>

        {/* Footer Actions (only for pending) */}
        {isPending && (
          <SheetFooter className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t p-6 gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject
            </Button>
            <Button
              className="flex-1 gap-1.5 btn-gradient"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
