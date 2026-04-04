"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  Eye,
  Check,
  X,
  Star,
  Loader2,
  PenLine,
  Play,
  Calendar,
  HardDrive,
  User,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";
import { TagList } from "@/components/tags/tag-badge";

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
  viewMode?: "grid" | "list";
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
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
          )}
          onMouseEnter={() => !disabled && setHoverRating(star)}
          onMouseLeave={() => !disabled && setHoverRating(0)}
          onClick={() => !disabled && onRatingChange(star)}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
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

export function UploadReviewCard({
  upload,
  isSelected = false,
  isFavorited = false,
  onSelect,
  onReviewComplete,
  onFavoriteToggle,
  viewMode = "grid",
}: UploadReviewCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rating, setRating] = useState(upload.rating || 0);
  const [reviewNotes, setReviewNotes] = useState(upload.reviewNote || "");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(upload.thumbnailUrl || null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  const isPending = upload.status === "PENDING";
  const fileSize = typeof upload.fileSize === "bigint" ? Number(upload.fileSize) : upload.fileSize;
  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const isAudio = upload.fileType.startsWith("audio/");

  // Fetch thumbnail URL on mount for images if not provided
  React.useEffect(() => {
    if (!thumbnailUrl && isImage && !thumbnailLoading && !thumbnailError) {
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
  }, [upload.id, thumbnailUrl, isImage, thumbnailLoading, thumbnailError]);

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
      toast.error("Failed to load preview");
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

      toast.success("Upload approved successfully");
      setApproveDialogOpen(false);
      onReviewComplete?.();
    } catch {
      toast.error("Failed to approve upload");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
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
          notes: rejectReason,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject upload");

      toast.success("Upload rejected");
      setRejectDialogOpen(false);
      onReviewComplete?.();
    } catch {
      toast.error("Failed to reject upload");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grid View
  if (viewMode === "grid") {
    return (
      <>
        <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
          {/* Selection Checkbox */}
          {isPending && onSelect && (
            <div className="absolute left-3 top-3 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(upload.id, !!checked)}
                className="bg-white/90 backdrop-blur-sm"
              />
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            {getStatusBadge(upload.status)}
          </div>

          {/* Large Preview Area */}
          <div
            className="relative aspect-square bg-muted/30 cursor-pointer overflow-hidden"
            onClick={handlePreview}
          >
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt={upload.originalName}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : thumbnailLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="rounded-xl bg-muted/50 p-4">
                  {getFileIcon(upload.fileType)}
                </div>
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
                      <Play className="h-8 w-8" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview();
                }}
                disabled={loadingPreview}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <CardContent className="space-y-3 p-4">
            {/* File Info */}
            <div>
              <h4 className="font-medium truncate text-sm" title={upload.originalName}>
                {upload.originalName}
              </h4>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(fileSize)}
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {upload.uploadedAt
                    ? format(new Date(upload.uploadedAt), "MMM d")
                    : "Uploading"}
                </span>
              </div>
            </div>

            {/* Tags */}
            {upload.tags && upload.tags.length > 0 && (
              <div className="pt-2 border-t">
                <TagList tags={upload.tags} size="sm" maxVisible={3} />
              </div>
            )}

            {/* Creator & Request Info */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar user={upload.creator} size="xs" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground truncate block">
                  {upload.creator.name}
                </span>
                {upload.request?.title && (
                  <span className="text-xs text-muted-foreground/70 truncate block">
                    {upload.request.title}
                  </span>
                )}
              </div>
            </div>

            {/* Rating (if reviewed) */}
            {upload.rating && (
              <div className="flex items-center gap-1 pt-2 border-t">
                <StarRating rating={upload.rating} onRatingChange={() => {}} disabled />
                <span className="text-xs text-muted-foreground ml-1">
                  {upload.rating}/5
                </span>
              </div>
            )}

            {/* Action Buttons for Pending */}
            {isPending && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 btn-gradient"
                  onClick={() => setApproveDialogOpen(true)}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
                <div className="rounded-full bg-emerald-100 p-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                Approve Upload
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
                className="gap-1.5 btn-gradient"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-full bg-red-100 p-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                Reject Upload
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
                Reject Upload
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
        className={cn(
          "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
          "hover:bg-muted/30 hover:shadow-sm",
          isSelected && "bg-primary/5 border-primary/30"
        )}
      >
        {/* Selection Checkbox */}
        {isPending && onSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(upload.id, !!checked)}
          />
        )}

        {/* Thumbnail */}
        <div
          className="shrink-0 relative h-16 w-16 rounded-lg bg-muted/50 overflow-hidden cursor-pointer group"
          onClick={handlePreview}
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={upload.originalName}
              className="h-full w-full object-cover"
            />
          ) : thumbnailLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {getFileIcon(upload.fileType)}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm" title={upload.originalName}>
              {upload.originalName}
            </h4>
            {getStatusBadge(upload.status)}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatFileSize(fileSize)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {upload.uploadedAt
                ? format(new Date(upload.uploadedAt), "MMM d, h:mm a")
                : "Uploading"}
            </span>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreview}
            disabled={loadingPreview}
            title="Preview"
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>

          {isPending && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => setApproveDialogOpen(true)}
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setRejectDialogOpen(true)}
                title="Reject"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
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
              <div className="rounded-full bg-emerald-100 p-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
              </div>
              Approve Upload
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
              className="gap-1.5 btn-gradient"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-red-100 p-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              Reject Upload
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
              Reject Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
