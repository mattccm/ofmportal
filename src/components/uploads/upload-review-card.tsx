"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Video,
  Music,
  File,
  Download,
  Maximize2,
  Check,
  X,
  Star,
  Loader2,
  AlertTriangle,
  Trash2,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";
import { DiscreetPreview } from "@/components/title-wall";
import { TagList } from "@/components/tags/tag-badge";
import { useAccess } from "@/lib/access/client";

export interface UploadTag {
  id: string;
  name: string;
  color: string;
}

export interface UploadWithCreator {
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
  tags?: UploadTag[];
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
}

interface UploadReviewCardProps {
  upload: UploadWithCreator;
  isSelected?: boolean;
  isFavorited?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onReviewComplete?: () => void;
  onFavoriteToggle?: (isFavorited: boolean) => void;
  onDelete?: () => void;
  viewMode?: "grid" | "list";
  /** Page-level "Show previews". Each preview can also be peeked or toggled on its own. */
  revealed?: boolean;
}

/**
 * For roles without "Reveal previews": the tile shows the file's kind only,
 * with no reveal control, and no image is ever requested.
 */
function LockedPreview({ caption, aspect, className }: { caption?: string; aspect: string; className?: string }) {
  return (
    <span className={cn("tw-preview", className)} data-revealed="false" style={{ aspectRatio: aspect }}>
      <EyeOff className="tw-preview-eye" aria-hidden="true" strokeWidth={1.5} />
      {caption && <span className="tw-preview-kind">{caption}</span>}
    </span>
  );
}

// Keeps a hidden preview a reveal button while its signed link loads
const HIDDEN_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
        <Badge variant="ready">Ready to review</Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="approved">Approved</Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="changes">Needs changes</Badge>
      );
    default:
      return null;
  }
}

function StarRating({
  rating,
  onRatingChange,
  disabled = false,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "p-0.5 transition-all duration-150",
            disabled ? "cursor-default" : "cursor-pointer"
          )}
          onMouseEnter={() => !disabled && setHoverRating(star)}
          onMouseLeave={() => !disabled && setHoverRating(0)}
          onClick={() => !disabled && onRatingChange(star)}
          aria-label={`${star} of 5`}
          tabIndex={disabled ? -1 : undefined}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              (hoverRating || rating) >= star
                ? "fill-ink text-ink"
                : "text-ctl"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function UploadReviewCard({
  upload,
  isSelected = false,
  isFavorited = false,
  onSelect,
  onReviewComplete,
  onFavoriteToggle,
  onDelete,
  viewMode = "grid",
  revealed,
}: UploadReviewCardProps) {
  const { can } = useAccess();
  const canReveal = can("review.reveal");
  const canApprove = can("review.approve");
  const canSendBack = can("review.requestChanges");
  const canDownload = can("review.download");
  const canDelete = can("review.delete");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rating, setRating] = useState(upload.rating || 0);
  const [reviewNotes, setReviewNotes] = useState(upload.reviewNote || "");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(upload.thumbnailUrl || null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  const isPending = upload.status === "PENDING";
  const fileSize = typeof upload.fileSize === "bigint" ? Number(upload.fileSize) : upload.fileSize;
  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const isAudio = upload.fileType.startsWith("audio/");

  // Fetch thumbnail URL on mount for images and videos if not provided
  React.useEffect(() => {
    if (canReveal && !thumbnailUrl && (isImage || isVideo) && !thumbnailLoading && !thumbnailError) {
      setThumbnailLoading(true);
      fetch(`/api/uploads/${upload.id}/thumbnail`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setThumbnailUrl(data.url);
          }
        })
        .catch(() => {
          setThumbnailError(true);
        })
        .finally(() => {
          setThumbnailLoading(false);
        });
    }
  }, [canReveal, upload.id, thumbnailUrl, isImage, isVideo, thumbnailLoading, thumbnailError]);

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`/api/uploads/${upload.id}/url`);
      if (!response.ok) throw new Error("Failed to get preview URL");
      const { url } = await response.json();

      setPreviewFile({
        id: upload.id,
        url,
        fileName: upload.fileName,
        originalName: upload.originalName,
        fileType: upload.fileType,
        fileSize: fileSize,
        uploadedAt: upload.uploadedAt,
        createdAt: upload.createdAt,
        status: upload.status,
        creator: upload.creator,
      });
      setPreviewOpen(true);
    } catch {
      toast.error("The preview didn't load. Try again or download the file.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = () => {
    // Use a hidden iframe to trigger the download without opening a new tab
    // The download endpoint redirects to a presigned URL with Content-Disposition: attachment
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/api/uploads/${upload.id}/download`;
    document.body.appendChild(iframe);
    toast.success("Download started");
    // Clean up after download starts
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 5000);
  };

  const handleApprove = async () => {
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

      toast.success("Approved");
      setApproveDialogOpen(false);
      onReviewComplete?.();
    } catch {
      toast.error("Couldn't approve. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Say what needs to change before sending it back");
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
          notes: rejectReason,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject upload");

      toast.success("Sent back to the creator");
      setRejectDialogOpen(false);
      onReviewComplete?.();
    } catch {
      toast.error("Couldn't send it back. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/uploads/${upload.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete upload");
      }

      toast.success("Upload deleted permanently");
      setDeleteDialogOpen(false);
      onDelete?.();
      onReviewComplete?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete upload");
    } finally {
      setIsDeleting(false);
    }
  };

  // Grid View
  if (viewMode === "grid") {
    return (
      <>
        <div
          className="group relative overflow-hidden rounded-[10px] bg-tile transition-colors duration-150 hover:bg-tile-hi data-[selected]:bg-tile-hi"
          data-selected={isSelected || undefined}
        >
          {/* Hidden until revealed: no image is requested before that */}
          {canReveal ? (
            <DiscreetPreview
              src={thumbnailUrl ?? (isImage || isVideo ? HIDDEN_SRC : null)}
              label={upload.originalName}
              kind={isVideo ? "video" : isImage ? "photo" : "text"}
              caption={isVideo ? "Video" : isImage ? "Photo" : isAudio ? "Audio" : "File"}
              revealed={revealed}
              aspect="4 / 3"
              className="w-full rounded-none"
            />
          ) : (
            <LockedPreview
              caption={isVideo ? "Video" : isImage ? "Photo" : isAudio ? "Audio" : "File"}
              aspect="4 / 3"
              className="w-full rounded-none"
            />
          )}

          {isPending && onSelect && (
            <div className="absolute left-2.5 top-2.5 z-10 rounded-[4px] bg-ground/80 p-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(upload.id, !!checked)}
                aria-label={`Select ${upload.originalName}`}
              />
            </div>
          )}

          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 truncate text-[14px] font-medium text-ink" title={upload.originalName}>
                {upload.originalName}
              </h4>
              {getStatusBadge(upload.status)}
            </div>
            <p className="text-[13px] text-ink-2">
              {formatFileSize(fileSize)} · {upload.uploadedAt ? format(new Date(upload.uploadedAt), "EEE d MMM") : "Uploading"}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
              <span className="shrink-0 text-ink">{upload.creator.name}</span>
              {upload.request?.title && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/dashboard/requests/${upload.request.id}`}
                    className="truncate underline-offset-[3px] hover:text-ink hover:underline"
                  >
                    {upload.request.title}
                  </Link>
                </>
              )}
            </p>
            {upload.tags && upload.tags.length > 0 && <TagList tags={upload.tags} size="sm" maxVisible={3} />}
            {upload.rating ? (
              <div className="flex items-center gap-1">
                <StarRating rating={upload.rating} onRatingChange={() => {}} disabled />
                <span className="text-[13px] text-ink-2">{upload.rating} of 5</span>
              </div>
            ) : null}

            <div className="flex items-center gap-1 pt-1">
              {isPending && canApprove && (
                <Button size="sm" variant="outline" onClick={() => setApproveDialogOpen(true)}>
                  <Check className="size-4" />
                  Approve
                </Button>
              )}
              {isPending && canSendBack && (
                <Button size="sm" variant="ghost" onClick={() => setRejectDialogOpen(true)}>
                  Send back
                </Button>
              )}
              <span className="ml-auto flex">
                {canReveal && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handlePreview}
                    disabled={loadingPreview}
                    aria-label={`Open ${upload.originalName} in full view`}
                    title="Full view"
                  >
                    {loadingPreview ? <Loader2 className="size-4 animate-spin" /> : <Maximize2 className="size-4" />}
                  </Button>
                )}
                {canDownload && (
                  <Button size="icon-sm" variant="ghost" onClick={handleDownload} aria-label={`Download ${upload.originalName}`} title="Download">
                    <Download className="size-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="hover:text-late"
                    onClick={() => setDeleteDialogOpen(true)}
                    aria-label={`Delete ${upload.originalName}`}
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Enhanced Preview Modal */}
        {previewFile && (
          <FilePreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            files={[previewFile]}
            initialIndex={0}
            onDownload={handleDownload}
          />
        )}

        {/* Approve Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-full bg-approved/10 p-1.5">
                  <Check className="h-4 w-4 text-approved" />
                </div>
                Approve this file
              </DialogTitle>
              <DialogDescription>
                Rate and add notes for this upload before approving.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* File preview mini */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="shrink-0 rounded-lg bg-muted p-2">
                  {getFileIcon(upload.fileType)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{upload.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileSize)} - Uploaded by {upload.creator.name}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality Rating</label>
                <StarRating rating={rating} onRatingChange={setRating} />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Review Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes about this upload..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setApproveDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="gap-1.5"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve this file
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-full bg-late/15 p-1.5">
                  <AlertTriangle className="h-4 w-4 text-late" />
                </div>
                Send this file back
              </DialogTitle>
              <DialogDescription>
                Please provide feedback to help the creator understand what needs to be changed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* File preview mini */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="shrink-0 rounded-lg bg-muted p-2">
                  {getFileIcon(upload.fileType)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{upload.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded by {upload.creator.name}
                  </p>
                </div>
              </div>

              {/* Rating (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality Rating (optional)</label>
                <StarRating rating={rating} onRatingChange={setRating} />
              </div>

              {/* Rejection Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Rejection Reason <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Please explain why this upload is being rejected and what changes are needed..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="border-destructive/30 focus-visible:ring-destructive/30"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={handleReject}
                disabled={!rejectReason.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Send this file back
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-full bg-late/15 p-1.5">
                  <Trash2 className="h-4 w-4 text-late" />
                </div>
                Delete Upload Permanently
              </DialogTitle>
              <DialogDescription>
                This will permanently delete the file from storage. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* File preview mini */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="shrink-0 rounded-lg bg-muted p-2">
                  {getFileIcon(upload.fileType)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{upload.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileSize)} - Uploaded by {upload.creator.name}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // List View
  return (
    <>
      <div
        data-selected={isSelected || undefined}
        className="flex items-center gap-3 rounded-[10px] bg-tile p-3 transition-colors duration-150 hover:bg-tile-hi data-[selected]:bg-tile-hi"
      >
        {isPending && onSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(upload.id, !!checked)}
            aria-label={`Select ${upload.originalName}`}
          />
        )}

        {canReveal ? (
          <DiscreetPreview
            src={thumbnailUrl ?? (isImage || isVideo ? HIDDEN_SRC : null)}
            label={upload.originalName}
            kind={isVideo ? "video" : isImage ? "photo" : "text"}
            revealed={revealed}
            aspect="1 / 1"
            className="w-16 shrink-0"
          />
        ) : (
          <LockedPreview aspect="1 / 1" className="w-16 shrink-0" />
        )}

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm" title={upload.originalName}>
              {upload.originalName}
            </h4>
            {getStatusBadge(upload.status)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
            <span>{formatFileSize(fileSize)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {upload.uploadedAt
                ? format(new Date(upload.uploadedAt), "EEE d MMM, HH:mm")
                : "Uploading"}
            </span>
            {upload.request?.title && (
              <Link
                href={`/dashboard/requests/${upload.request.id}`}
                className="max-w-[220px] truncate underline-offset-[3px] hover:text-ink hover:underline"
              >
                {upload.request.title}
              </Link>
            )}
          </div>
          {/* Tags in list view */}
          {upload.tags && upload.tags.length > 0 && (
            <div className="mt-1.5">
              <TagList tags={upload.tags} size="sm" maxVisible={4} />
            </div>
          )}
        </div>

        {/* Creator */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Avatar user={upload.creator} size="sm" />
          <div className="text-sm">
            <p className="font-medium truncate max-w-[120px]">{upload.creator.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
              {upload.creator.email}
            </p>
          </div>
        </div>

        {/* Rating */}
        {upload.rating && (
          <div className="hidden lg:flex items-center shrink-0">
            <StarRating rating={upload.rating} onRatingChange={() => {}} disabled />
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canReveal && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreview}
              disabled={loadingPreview}
              title="Full view"
              aria-label={`Open ${upload.originalName} in full view`}
            >
              {loadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
          {canDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              title="Download"
              aria-label={`Download ${upload.originalName}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}

          {isPending && canApprove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setApproveDialogOpen(true)}
              title="Approve"
              aria-label={`Approve ${upload.originalName}`}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {isPending && canSendBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRejectDialogOpen(true)}
              title="Send back"
              aria-label={`Send ${upload.originalName} back`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-late"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete"
              aria-label={`Delete ${upload.originalName}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          files={[previewFile]}
          initialIndex={0}
          onDownload={handleDownload}
        />
      )}

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-approved/10 p-1.5">
                <Check className="h-4 w-4 text-approved" />
              </div>
              Approve this file
            </DialogTitle>
            <DialogDescription>
              Rate and add notes for this upload before approving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="shrink-0 rounded-lg bg-muted p-2">
                {getFileIcon(upload.fileType)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{upload.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileSize)} - Uploaded by {upload.creator.name}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quality Rating</label>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes (optional)</label>
              <Textarea
                placeholder="Add any notes about this upload..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve this file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-late/15 p-1.5">
                <AlertTriangle className="h-4 w-4 text-late" />
              </div>
              Send this file back
            </DialogTitle>
            <DialogDescription>
              Please provide feedback to help the creator understand what needs to be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="shrink-0 rounded-lg bg-muted p-2">
                {getFileIcon(upload.fileType)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{upload.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded by {upload.creator.name}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quality Rating (optional)</label>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Please explain why this upload is being rejected and what changes are needed..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="border-destructive/30 focus-visible:ring-destructive/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Send this file back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-late/15 p-1.5">
                <Trash2 className="h-4 w-4 text-late" />
              </div>
              Delete Upload Permanently
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the file from storage. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="shrink-0 rounded-lg bg-muted p-2">
                {getFileIcon(upload.fileType)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{upload.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileSize)} - Uploaded by {upload.creator.name}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
