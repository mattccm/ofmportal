"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Image as ImageIcon,
  Video,
  Music,
  File,
  Download,
  Eye,
  Check,
  X,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { formatStamp } from "@/components/title-wall/time";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";

interface Upload {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint;
  storageKey: string;
  uploadStatus: string;
  status: string;
  uploadedAt: Date | null;
  createdAt: Date;
  fieldId?: string | null;
}

interface FieldInfo {
  id: string;
  label: string;
}

interface UploadsListProps {
  uploads: Upload[];
  requestId: string;
  fields?: FieldInfo[];
  onStatusChange?: (uploadId: string, newStatus: string) => void;
  /** Finished requests: no approve, send back or undo */
  readOnly?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

// A kind tile in place of a thumbnail: lists never load creator imagery.
// Previews open on request (the full-view button) through signed links.
function UploadKindTile({ upload }: { upload: Upload }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-well text-icon" aria-hidden="true">
      {getFileIcon(upload.fileType)}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="ready">Ready to review</Badge>;
    case "APPROVED":
      return <Badge variant="approved">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="changes">Needs changes</Badge>;
    default:
      return null;
  }
}

export function UploadsList({ uploads, requestId, fields, onStatusChange, readOnly = false }: UploadsListProps) {
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);

  // Group uploads by field
  const groupedUploads = useMemo(() => {
    if (!fields || fields.length === 0) {
      return [{ field: null, uploads }];
    }

    const groups: { field: FieldInfo | null; uploads: Upload[] }[] = [];
    const fieldMap = new Map(fields.map(f => [f.id, f]));

    // Group by field
    const byField = new Map<string | null, Upload[]>();
    for (const upload of uploads) {
      const key = upload.fieldId || null;
      if (!byField.has(key)) {
        byField.set(key, []);
      }
      byField.get(key)!.push(upload);
    }

    // Add field groups in order
    for (const field of fields) {
      const fieldUploads = byField.get(field.id);
      if (fieldUploads && fieldUploads.length > 0) {
        groups.push({ field, uploads: fieldUploads });
      }
    }

    // Add ungrouped uploads
    const ungrouped = byField.get(null);
    if (ungrouped && ungrouped.length > 0) {
      groups.push({ field: null, uploads: ungrouped });
    }

    return groups;
  }, [uploads, fields]);

  const toggleUpload = (id: string) => {
    const newSelected = new Set(selectedUploads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUploads(newSelected);
  };

  const selectAll = () => {
    if (selectedUploads.size === uploads.length) {
      setSelectedUploads(new Set());
    } else {
      setSelectedUploads(new Set(uploads.map((u) => u.id)));
    }
  };

  const handleApprove = async (uploadIds: string[]) => {
    setProcessingAction("approve");
    try {
      const response = await fetch("/api/uploads/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds, requestId }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve uploads");
      }

      toast.success(uploadIds.length === 1 ? "File approved" : `${uploadIds.length} files approved`);
      setSelectedUploads(new Set());

      // Update status locally via callback if provided, otherwise reload
      if (onStatusChange) {
        uploadIds.forEach(id => onStatusChange(id, "APPROVED"));
      } else {
        window.location.reload();
      }
    } catch {
      toast.error("Couldn't approve. Try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async () => {
    const uploadIds = Array.from(selectedUploads);
    setProcessingAction("reject");
    try {
      const response = await fetch("/api/uploads/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds, requestId, reason: rejectReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject uploads");
      }

      toast.success(uploadIds.length === 1 ? "File sent back" : `${uploadIds.length} files sent back`);
      setSelectedUploads(new Set());
      setRejectDialogOpen(false);
      setRejectReason("");

      // Update status locally via callback if provided, otherwise reload
      if (onStatusChange) {
        uploadIds.forEach(id => onStatusChange(id, "REJECTED"));
      } else {
        window.location.reload();
      }
    } catch {
      toast.error("Couldn't send the files back. Try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReset = async (uploadId: string) => {
    setProcessingAction("reset");
    try {
      const response = await fetch("/api/uploads/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, action: "reset" }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset upload");
      }

      toast.success("Decision undone; the file is waiting for review again");

      // Update status locally via callback if provided, otherwise reload
      if (onStatusChange) {
        onStatusChange(uploadId, "PENDING");
      } else {
        window.location.reload();
      }
    } catch {
      toast.error("Couldn't undo the decision. Try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePreview = async (upload: Upload, index: number) => {
    try {
      // Fetch URLs for all uploads
      const uploadUrls = await Promise.all(
        uploads.map(async (u) => {
          const response = await fetch(`/api/uploads/${u.id}/url`);
          if (!response.ok) return null;
          const { url } = await response.json();
          return {
            id: u.id,
            url,
            fileName: u.fileName,
            originalName: u.originalName,
            fileType: u.fileType,
            fileSize: Number(u.fileSize),
            uploadedAt: u.uploadedAt,
            createdAt: u.createdAt,
            status: u.status,
          } as PreviewFile;
        })
      );

      const validFiles = uploadUrls.filter((f): f is PreviewFile => f !== null);
      const adjustedIndex = validFiles.findIndex((f) => f.id === upload.id);

      setPreviewFiles(validFiles);
      setPreviewIndex(adjustedIndex >= 0 ? adjustedIndex : 0);
      setPreviewOpen(true);
    } catch {
      toast.error("The preview didn't load. Try again or download the file.");
    }
  };

  const handleDownload = (upload: Upload) => {
    // Use a hidden iframe to trigger the download without opening a new tab
    // The download endpoint redirects to a presigned URL with Content-Disposition: attachment
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/api/uploads/${upload.id}/download`;
    document.body.appendChild(iframe);
    // Clean up after download starts
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 5000);
  };

  if (uploads.length === 0) {
    return (
      <p className="rounded-[10px] bg-tile px-4 py-6 text-[14px] text-ink-2">No files uploaded yet.</p>
    );
  }

  const pendingCount = readOnly ? 0 : uploads.filter((u) => u.status === "PENDING").length;

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {pendingCount > 0 && (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-tile px-3 py-2">
          <div className="flex items-center gap-3">
            <Checkbox aria-label="Select all"
              checked={selectedUploads.size === uploads.length}
              onCheckedChange={selectAll}
            />
            <span className="text-[14px] text-ink-2">
              {selectedUploads.size > 0
                ? `${selectedUploads.size} selected`
                : "Select all"}
            </span>
          </div>
          {selectedUploads.size > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApprove(Array.from(selectedUploads))}
                disabled={!!processingAction}
              >
                {processingAction === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Approve selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                disabled={!!processingAction}
              >
                <X className="h-4 w-4 mr-1" />
                Send back selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Uploads List - Grouped by Field */}
      <div className="space-y-6">
        {groupedUploads.map((group, groupIndex) => (
          <div key={group.field?.id || "ungrouped"} className="space-y-2">
            {/* Field Section Header */}
            {(fields && fields.length > 0) && (
              <div className="flex items-center gap-2 pb-2 border-b border-line">
                <h4 className="text-sm font-medium text-ink">
                  {group.field?.label || "Other Uploads"}
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {group.uploads.length} file{group.uploads.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}

            {/* Uploads in this group */}
            <div className="divide-y divide-line rounded-[10px] bg-tile">
              {group.uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors duration-150 hover:bg-tile-hi"
                >
                  {upload.status === "PENDING" && !readOnly && (
                    <Checkbox
                      checked={selectedUploads.has(upload.id)}
                      onCheckedChange={() => toggleUpload(upload.id)}
                      aria-label={`Select ${upload.originalName}`}
                    />
                  )}

                  <UploadKindTile upload={upload} />

                  <div className="min-w-0 flex-1 basis-[160px]">
                    <p className="truncate text-[14px] font-medium text-ink">{upload.originalName}</p>
                    <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2">
                      <span>{formatFileSize(Number(upload.fileSize))}</span>
                      <span>·</span>
                      <span>
                        {upload.uploadedAt
                          ? formatStamp(upload.uploadedAt)
                          : "Uploading…"}
                      </span>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    <span className="mr-1 hidden sm:inline-flex">{getStatusBadge(upload.status)}</span>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(upload, uploads.indexOf(upload))}
                      title="Open full view"
                      aria-label={`Open ${upload.originalName} in full view`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(upload)}
                      title="Download"
                      aria-label={`Download ${upload.originalName}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    {upload.status === "PENDING" && !readOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleApprove([upload.id])}
                          disabled={!!processingAction}
                          title="Approve this file"
                          aria-label={`Approve ${upload.originalName}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUploads(new Set([upload.id]));
                            setRejectDialogOpen(true);
                          }}
                          disabled={!!processingAction}
                          title="Send this file back"
                          aria-label={`Send ${upload.originalName} back`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {(upload.status === "APPROVED" || upload.status === "REJECTED") && !readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReset(upload.id)}
                        disabled={!!processingAction}
                        title="Return this file to review"
                        aria-label={`Return ${upload.originalName} to review`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {selectedUploads.size === 1 ? "this file" : `${selectedUploads.size} files`} back</DialogTitle>
            <DialogDescription>
              Tell the creator what to change. They see this note with the file.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="What needs to change, and how"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={!!processingAction}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || !!processingAction}
            >
              {processingAction === "reject" && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Preview Modal */}
      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={previewFiles}
        initialIndex={previewIndex}
      />
    </div>
  );
}
