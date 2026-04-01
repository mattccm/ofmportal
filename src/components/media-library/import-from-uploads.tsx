"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Folder,
  Tag,
  Plus,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Filter,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaFolder, MediaType, ImportableUpload } from "@/types/media-library";

interface ImportFromUploadsProps {
  creatorId: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  folders?: MediaFolder[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function getMediaTypeIcon(type: MediaType, className?: string) {
  switch (type) {
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "document":
      return <FileText className={className} />;
  }
}

function getMediaTypeColor(type: MediaType) {
  switch (type) {
    case "image":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "video":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "audio":
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
    case "document":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  }
}

export function ImportFromUploads({
  creatorId,
  isOpen,
  onClose,
  onImportComplete,
  folders = [],
}: ImportFromUploadsProps) {
  const [uploads, setUploads] = useState<ImportableUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MediaType | "all">("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [globalTags, setGlobalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [showImported, setShowImported] = useState(false);

  // Fetch approved uploads
  useEffect(() => {
    if (isOpen) {
      fetchUploads();
    }
  }, [isOpen, creatorId]);

  const fetchUploads = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/creators/${creatorId}/uploads?status=APPROVED&includeImported=true`
      );
      if (response.ok) {
        const data = await response.json();
        setUploads(
          data.uploads.map((u: {
            id: string;
            fileName: string;
            originalName?: string;
            fileType: string;
            mimeType: string;
            fileSize: number | bigint;
            storageKey: string;
            thumbnailUrl?: string;
            requestId: string;
            request?: { title: string };
            reviewedAt: string | Date;
            importedToLibrary?: boolean;
          }) => ({
            id: u.id,
            fileName: u.fileName,
            originalName: u.originalName || u.fileName,
            fileType: u.fileType,
            mimeType: u.mimeType,
            fileSize: Number(u.fileSize),
            storageKey: u.storageKey,
            thumbnailUrl: u.thumbnailUrl,
            requestId: u.requestId,
            requestTitle: u.request?.title || "Unknown Request",
            approvedAt: new Date(u.reviewedAt),
            alreadyImported: u.importedToLibrary || false,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch uploads:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter uploads
  const filteredUploads = uploads.filter((upload) => {
    // Hide already imported unless showImported is true
    if (upload.alreadyImported && !showImported) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !upload.originalName.toLowerCase().includes(query) &&
        !upload.requestTitle.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Type filter
    if (filterType !== "all") {
      const mediaType = getMediaType(upload.mimeType);
      if (mediaType !== filterType) return false;
    }

    return true;
  });

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all filtered
  const selectAll = useCallback(() => {
    const availableIds = filteredUploads
      .filter((u) => !u.alreadyImported)
      .map((u) => u.id);
    if (selectedIds.size === availableIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableIds));
    }
  }, [filteredUploads, selectedIds]);

  // Add tag
  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !globalTags.includes(tag)) {
      setGlobalTags((prev) => [...prev, tag]);
    }
    setTagInput("");
  }, [tagInput, globalTags]);

  // Remove tag
  const removeTag = useCallback((tag: string) => {
    setGlobalTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // Import selected uploads
  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: selectedIds.size });

    try {
      const response = await fetch("/api/media-library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          uploadIds: Array.from(selectedIds),
          folderId: selectedFolder,
          tags: globalTags,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setImportProgress({ current: data.imported, total: selectedIds.size });

        // Clear selection and refresh
        setSelectedIds(new Set());
        await fetchUploads();
        onImportComplete();
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    if (!importing) {
      setSelectedIds(new Set());
      setSearchQuery("");
      setFilterType("all");
      setSelectedFolder(null);
      setGlobalTags([]);
      onClose();
    }
  };

  const availableUploads = filteredUploads.filter((u) => !u.alreadyImported);
  const importedCount = filteredUploads.filter((u) => u.alreadyImported).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import from Approved Uploads
          </DialogTitle>
          <DialogDescription>
            Select approved uploads to add to this creator&apos;s media library.
            Imported media will be linked to the original upload.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search uploads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as MediaType | "all")}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showImported}
                onCheckedChange={(c) => setShowImported(c === true)}
              />
              Show imported ({importedCount})
            </label>
          </div>

          {/* Selection bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-primary/10 rounded-lg px-4 py-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedIds.size} upload{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Upload list */}
          <div className="flex-1 border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Download className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No uploads available</h3>
                <p className="text-muted-foreground max-w-md">
                  {showImported
                    ? "No approved uploads found for this creator."
                    : "All approved uploads have been imported. Enable 'Show imported' to see them."}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="p-2">
                  {/* Select all */}
                  {availableUploads.length > 0 && (
                    <div className="flex items-center gap-2 p-2 border-b mb-2">
                      <Checkbox
                        checked={
                          selectedIds.size === availableUploads.length &&
                          availableUploads.length > 0
                        }
                        onCheckedChange={selectAll}
                      />
                      <span className="text-sm text-muted-foreground">
                        Select all ({availableUploads.length})
                      </span>
                    </div>
                  )}

                  {/* Upload items */}
                  <div className="space-y-2">
                    {filteredUploads.map((upload) => {
                      const mediaType = getMediaType(upload.mimeType);
                      const isSelected = selectedIds.has(upload.id);

                      return (
                        <div
                          key={upload.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border transition-all",
                            upload.alreadyImported
                              ? "bg-muted/50 opacity-60"
                              : "hover:bg-accent/50 cursor-pointer",
                            isSelected && "bg-primary/10 border-primary"
                          )}
                          onClick={() => {
                            if (!upload.alreadyImported) {
                              toggleSelect(upload.id);
                            }
                          }}
                        >
                          {/* Checkbox */}
                          <div onClick={(e) => e.stopPropagation()}>
                            {upload.alreadyImported ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(upload.id)}
                              />
                            )}
                          </div>

                          {/* Thumbnail */}
                          <div
                            className={cn(
                              "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                              getMediaTypeColor(mediaType)
                            )}
                          >
                            {upload.thumbnailUrl ? (
                              <img
                                src={upload.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getMediaTypeIcon(mediaType, "h-5 w-5")
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {upload.originalName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              From: {upload.requestTitle}
                            </p>
                          </div>

                          {/* Meta */}
                          <div className="text-right shrink-0">
                            <p className="text-sm">{formatFileSize(upload.fileSize)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(upload.approvedAt)}
                            </p>
                          </div>

                          {/* Status */}
                          {upload.alreadyImported && (
                            <Badge variant="secondary" className="shrink-0">
                              Imported
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Import options */}
          {selectedIds.size > 0 && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              {/* Folder selection */}
              <div className="space-y-2">
                <Label>Destination Folder</Label>
                <Select
                  value={selectedFolder || "none"}
                  onValueChange={(v) => setSelectedFolder(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <Folder className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder (root)</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags (applied to all)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addTag}>
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                {globalTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {globalTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <span className="animate-spin mr-2">
                  <Sparkles className="h-4 w-4" />
                </span>
                Importing {importProgress.current}/{importProgress.total}...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Import {selectedIds.size} Upload{selectedIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportFromUploads;
