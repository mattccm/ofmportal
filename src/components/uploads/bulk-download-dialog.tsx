"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Archive,
  Download,
  FileText,
  Folder,
  Loader2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  FolderTree,
  File,
  Image as ImageIcon,
  Video,
  Music,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";

export interface UploadForDownload {
  id: string;
  originalName: string;
  fileType: string;
  fileSize: number | bigint;
  status: string;
  uploadedAt: Date | null;
  creator: {
    id: string;
    name: string;
  };
  request: {
    id: string;
    title: string;
  };
}

type DownloadFormat = "zip" | "individual" | "folder";
type FolderOrganization = "flat" | "by-creator" | "by-request" | "by-date";

interface BulkDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploads: UploadForDownload[];
  selectedIds: Set<string>;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "REJECTED":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  }
}

export function BulkDownloadDialog({
  open,
  onOpenChange,
  uploads,
  selectedIds,
}: BulkDownloadDialogProps) {
  // Filter state
  const [filterCreator, setFilterCreator] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRequest, setFilterRequest] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Download options state
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("zip");
  const [folderOrganization, setFolderOrganization] = useState<FolderOrganization>("by-creator");
  const [includeMetadata, setIncludeMetadata] = useState(true);

  // Download progress state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  // Local selection state (starts from parent selectedIds but can be modified)
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    new Set(selectedIds)
  );

  // Sync with parent selection when dialog opens
  useMemo(() => {
    if (open) {
      setLocalSelectedIds(new Set(selectedIds));
    }
  }, [open, selectedIds]);

  // Extract unique creators and requests from uploads
  const uniqueCreators = useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string }>();
    uploads.forEach((u) => {
      if (!creatorMap.has(u.creator.id)) {
        creatorMap.set(u.creator.id, u.creator);
      }
    });
    return Array.from(creatorMap.values());
  }, [uploads]);

  const uniqueRequests = useMemo(() => {
    const requestMap = new Map<string, { id: string; title: string }>();
    uploads.forEach((u) => {
      if (!requestMap.has(u.request.id)) {
        requestMap.set(u.request.id, u.request);
      }
    });
    return Array.from(requestMap.values());
  }, [uploads]);

  // Filter uploads based on criteria
  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) => {
      // Filter by creator
      if (filterCreator !== "all" && upload.creator.id !== filterCreator) {
        return false;
      }

      // Filter by status
      if (filterStatus !== "all" && upload.status !== filterStatus.toUpperCase()) {
        return false;
      }

      // Filter by request
      if (filterRequest !== "all" && upload.request.id !== filterRequest) {
        return false;
      }

      // Filter by date range
      if (filterDateFrom && upload.uploadedAt) {
        const fromDate = new Date(filterDateFrom);
        if (new Date(upload.uploadedAt) < fromDate) {
          return false;
        }
      }

      if (filterDateTo && upload.uploadedAt) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(upload.uploadedAt) > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [uploads, filterCreator, filterStatus, filterRequest, filterDateFrom, filterDateTo]);

  // Selected uploads (intersection of localSelectedIds and filteredUploads)
  const selectedUploads = useMemo(() => {
    return filteredUploads.filter((u) => localSelectedIds.has(u.id));
  }, [filteredUploads, localSelectedIds]);

  // Calculate total size
  const totalSize = useMemo(() => {
    return selectedUploads.reduce((sum, upload) => {
      const size = typeof upload.fileSize === "bigint"
        ? Number(upload.fileSize)
        : upload.fileSize;
      return sum + size;
    }, 0);
  }, [selectedUploads]);

  // Selection handlers
  const handleSelectUpload = (id: string, checked: boolean) => {
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = new Set(filteredUploads.map((u) => u.id));
    setLocalSelectedIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setLocalSelectedIds(new Set());
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilterCreator("all");
    setFilterStatus("all");
    setFilterRequest("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // Download handler
  const handleDownload = async () => {
    if (selectedUploads.length === 0) {
      toast.error("Please select at least one file to download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus("Preparing download...");

    try {
      if (downloadFormat === "individual") {
        // Download files individually
        setDownloadStatus("Downloading files...");
        let completed = 0;

        for (const upload of selectedUploads) {
          setDownloadStatus(`Downloading ${upload.originalName}...`);

          const response = await fetch(`/api/uploads/${upload.id}/url`);
          if (!response.ok) {
            console.error(`Failed to get URL for ${upload.originalName}`);
            continue;
          }

          const { url } = await response.json();

          // Create a download link
          const link = document.createElement("a");
          link.href = url;
          link.download = upload.originalName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          completed++;
          setDownloadProgress((completed / selectedUploads.length) * 100);

          // Small delay between downloads to prevent browser blocking
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        toast.success(`Downloaded ${completed} file(s)`);
      } else {
        // ZIP download
        setDownloadStatus("Creating ZIP archive...");
        setDownloadProgress(10);

        const response = await fetch("/api/uploads/bulk-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadIds: selectedUploads.map((u) => u.id),
            format: downloadFormat,
            organization: folderOrganization,
            includeMetadata,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create download");
        }

        setDownloadProgress(80);
        setDownloadStatus("Preparing file...");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        // Generate filename based on selection
        const dateStr = format(new Date(), "yyyy-MM-dd");
        const filename = `uploads-${dateStr}.zip`;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setDownloadProgress(100);
        toast.success(`Downloaded ${selectedUploads.length} file(s) as ZIP`);
      }

      // Close dialog after successful download
      setTimeout(() => {
        onOpenChange(false);
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadStatus("");
      }, 1000);
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download files");
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadStatus("");
    }
  };

  const allSelected = localSelectedIds.size === filteredUploads.length && filteredUploads.length > 0;
  const someSelected = localSelectedIds.size > 0 && localSelectedIds.size < filteredUploads.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-1.5">
              <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Bulk Download
          </DialogTitle>
          <DialogDescription>
            Select files and configure download options. Total size:{" "}
            <span className="font-medium text-foreground">{formatFileSize(totalSize)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Download Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-xl border">
            {/* Download Format */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Download Format</Label>
              <Select
                value={downloadFormat}
                onValueChange={(value: DownloadFormat) => setDownloadFormat(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zip">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      <span>ZIP Archive</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="folder">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span>ZIP with Folders</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      <span>Individual Files</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Folder Organization (only for ZIP with folders) */}
            {downloadFormat === "folder" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Organize By</Label>
                <Select
                  value={folderOrganization}
                  onValueChange={(value: FolderOrganization) => setFolderOrganization(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4" />
                        <span>Flat (No Folders)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="by-creator">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>By Creator</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="by-request">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4" />
                        <span>By Request</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="by-date">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>By Date</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Include Metadata */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Metadata</Label>
              <div className="flex items-center gap-3 h-10 px-3 py-2 rounded-md border bg-background">
                <Checkbox
                  id="include-metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(!!checked)}
                />
                <label
                  htmlFor="include-metadata"
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Include CSV
                </label>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleSelectAll();
                  } else {
                    handleDeselectAll();
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">
                {localSelectedIds.size > 0 ? (
                  <span>
                    <span className="font-medium text-foreground">{localSelectedIds.size}</span>
                    {" "}of {filteredUploads.length} selected
                  </span>
                ) : (
                  "Select all"
                )}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Filters"}
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/20 rounded-lg border animate-fade-in">
              {/* Creator Filter */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select value={filterCreator} onValueChange={setFilterCreator}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Creators</SelectItem>
                    {uniqueCreators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Request Filter */}
              <Select value={filterRequest} onValueChange={setFilterRequest}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Requests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requests</SelectItem>
                  {uniqueRequests.map((request) => (
                    <SelectItem key={request.id} value={request.id}>
                      {request.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-[140px] h-9"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-[140px] h-9"
                  placeholder="To"
                />
              </div>

              {/* Clear Filters */}
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          )}

          {/* File List */}
          <div className="flex-1 overflow-y-auto border rounded-lg bg-background">
            {filteredUploads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <File className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No files match your filters
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredUploads.map((upload) => {
                  const fileSize = typeof upload.fileSize === "bigint"
                    ? Number(upload.fileSize)
                    : upload.fileSize;
                  const isSelected = localSelectedIds.has(upload.id);

                  return (
                    <div
                      key={upload.id}
                      className={cn(
                        "flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer",
                        isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20"
                      )}
                      onClick={() => handleSelectUpload(upload.id, !isSelected)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectUpload(upload.id, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="shrink-0 p-2 rounded-lg bg-muted/50">
                        {getFileIcon(upload.fileType)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {upload.originalName}
                          </span>
                          {getStatusIcon(upload.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{formatFileSize(fileSize)}</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{upload.creator.name}</span>
                          {upload.uploadedAt && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{format(new Date(upload.uploadedAt), "MMM d, yyyy")}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                        {upload.request.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Download Progress */}
          {isDownloading && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {downloadStatus}
                </span>
                <span className="text-sm text-indigo-600 dark:text-indigo-400">
                  {Math.round(downloadProgress)}%
                </span>
              </div>
              <Progress value={downloadProgress} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDownloading}
          >
            Cancel
          </Button>
          <Button
            className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            onClick={handleDownload}
            disabled={isDownloading || selectedUploads.length === 0}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading
              ? "Downloading..."
              : `Download ${selectedUploads.length} File${selectedUploads.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
