"use client";

import { useState, useMemo, useEffect } from "react";
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
  Link2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { FilePreviewModal, type PreviewFile } from "@/components/preview";
import { ShareButton } from "@/components/share/share-dialog";

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
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

// Thumbnail component that loads asynchronously
function UploadThumbnail({ upload }: { upload: Upload }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = upload.fileType.startsWith("image/");
  const isVideo = upload.fileType.startsWith("video/");
  const showThumbnail = isImage || isVideo;

  useEffect(() => {
    if (!showThumbnail) {
      setLoading(false);
      return;
    }

    const fetchThumbnail = async () => {
      try {
        const response = await fetch(`/api/uploads/${upload.id}/thumbnail`);
        if (!response.ok) throw new Error("Failed to fetch thumbnail");
        const data = await response.json();
        setThumbnailUrl(data.url);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchThumbnail();
  }, [upload.id, showThumbnail]);

  // Show icon for non-image/video files
  if (!showThumbnail) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        {getFileIcon(upload.fileType)}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        {isVideo ? <Video className="h-5 w-5 text-gray-400" /> : <ImageIcon className="h-5 w-5 text-gray-400" />}
      </div>
    );
  }

  // Error state or no thumbnail
  if (error || !thumbnailUrl) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        {getFileIcon(upload.fileType)}
      </div>
    );
  }

  // Show thumbnail - using regular img tag for R2 public URLs (cross-origin)
  return (
    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      <img
        src={thumbnailUrl}
        alt={upload.originalName}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setError(true)}
      />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Video className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending Review</Badge>;
    case "APPROVED":
      return <Badge variant="outline" className="bg-green-50 text-green-700">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="outline" className="bg-red-50 text-red-700">Rejected</Badge>;
    default:
      return null;
  }
}

export function UploadsList({ uploads, requestId, fields }: UploadsListProps) {
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

      toast.success(`${uploadIds.length} upload(s) approved`);
      setSelectedUploads(new Set());
      window.location.reload();
    } catch {
      toast.error("Failed to approve uploads");
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

      toast.success(`${uploadIds.length} upload(s) rejected`);
      setSelectedUploads(new Set());
      setRejectDialogOpen(false);
      setRejectReason("");
      window.location.reload();
    } catch {
      toast.error("Failed to reject uploads");
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
      toast.error("Failed to load preview");
    }
  };

  const handleDownload = async (upload: Upload) => {
    try {
      const response = await fetch(`/api/uploads/${upload.id}/url`);
      if (!response.ok) throw new Error("Failed to get download URL");
      const { url } = await response.json();

      // Create a temporary link and click it
      const link = document.createElement("a");
      link.href = url;
      link.download = upload.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Failed to download file");
    }
  };

  if (uploads.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    );
  }

  const pendingCount = uploads.filter((u) => u.status === "PENDING").length;

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedUploads.size === uploads.length}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-gray-600">
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
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => handleApprove(Array.from(selectedUploads))}
                disabled={!!processingAction}
              >
                {processingAction === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setRejectDialogOpen(true)}
                disabled={!!processingAction}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
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
              <div className="flex items-center gap-2 pb-2 border-b">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {group.field?.label || "Other Uploads"}
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {group.uploads.length} file{group.uploads.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}

            {/* Uploads in this group */}
            <div className="space-y-2">
              {group.uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {upload.status === "PENDING" && (
                    <Checkbox
                      checked={selectedUploads.has(upload.id)}
                      onCheckedChange={() => toggleUpload(upload.id)}
                    />
                  )}

                  <UploadThumbnail upload={upload} />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{upload.originalName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{formatFileSize(Number(upload.fileSize))}</span>
                      <span>·</span>
                      <span>
                        {upload.uploadedAt
                          ? format(upload.uploadedAt, "MMM d, h:mm a")
                          : "Uploading..."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(upload.status)}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(upload, uploads.indexOf(upload))}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(upload)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    {upload.status === "APPROVED" && (
                      <ShareButton
                        resourceType="UPLOAD"
                        resourceId={upload.id}
                        resourceTitle={upload.originalName}
                        variant="ghost"
                        size="icon-sm"
                      />
                    )}

                    {upload.status === "PENDING" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-600"
                          onClick={() => handleApprove([upload.id])}
                          disabled={!!processingAction}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          onClick={() => {
                            setSelectedUploads(new Set([upload.id]));
                            setRejectDialogOpen(true);
                          }}
                          disabled={!!processingAction}
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
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
            <DialogTitle>Reject Upload(s)</DialogTitle>
            <DialogDescription>
              Provide feedback for the creator about why the content needs revision.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
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
              Reject
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
