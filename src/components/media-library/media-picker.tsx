"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Grid3X3,
  List,
  Clock,
  Star,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Check,
  X,
  TrendingUp,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaFolder, MediaType } from "@/types/media-library";

interface MediaPickerProps {
  creatorId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: MediaItem[]) => void;
  multiple?: boolean;
  maxSelection?: number;
  allowedTypes?: MediaType[];
  initialSelection?: string[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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

// Quick preview thumbnail
function MediaThumbnail({
  item,
  isSelected,
  onClick,
  size = "md",
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden cursor-pointer transition-all",
        "border-2 hover:border-primary/50",
        isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent",
        sizeClasses[size]
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        {item.thumbnailKey && !imageError ? (
          <img
            src={`/api/media-library/thumbnail/${item.id}`}
            alt={item.title || item.originalName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className={cn("w-8 h-8 rounded flex items-center justify-center", getMediaTypeColor(item.mediaType))}>
            {getMediaTypeIcon(item.mediaType, "h-4 w-4")}
          </div>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Video duration */}
      {item.mediaType === "video" && item.duration && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}
        </div>
      )}
    </div>
  );
}

// List item view
function MediaListItem({
  item,
  isSelected,
  onClick,
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50",
        isSelected && "bg-primary/10"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
          getMediaTypeColor(item.mediaType)
        )}
      >
        {item.thumbnailKey && !imageError ? (
          <img
            src={`/api/media-library/thumbnail/${item.id}`}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          getMediaTypeIcon(item.mediaType, "h-5 w-5")
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {item.title || item.originalName}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(item.fileSize)}
          {item.duration && ` - ${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, "0")}`}
        </p>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
          <Check className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export function MediaPicker({
  creatorId,
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  maxSelection = 10,
  allowedTypes,
  initialSelection = [],
}: MediaPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [recentItems, setRecentItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelection)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MediaType | "all">("all");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"recent" | "browse">("recent");

  // Fetch data
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, creatorId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent items
      const recentResponse = await fetch(
        `/api/media-library?creatorId=${creatorId}&sortBy=lastUsedAt&sortOrder=desc&limit=20`
      );
      if (recentResponse.ok) {
        const data = await recentResponse.json();
        setRecentItems(data.items);
      }

      // Fetch all items and folders
      const allResponse = await fetch(
        `/api/media-library?creatorId=${creatorId}&limit=100`
      );
      if (allResponse.ok) {
        const data = await allResponse.json();
        setItems(data.items);
        if (data.folders) setFolders(data.folders);
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    let result = activeTab === "recent" ? recentItems : items;

    // Type filter (including allowed types restriction)
    result = result.filter((item) => {
      if (allowedTypes && !allowedTypes.includes(item.mediaType)) {
        return false;
      }
      if (filterType !== "all" && item.mediaType !== filterType) {
        return false;
      }
      return true;
    });

    // Folder filter
    if (activeFolder !== null && activeTab === "browse") {
      result = result.filter((item) => item.folderId === activeFolder);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          (item.title?.toLowerCase().includes(query) || false) ||
          item.originalName.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return result;
  }, [activeTab, recentItems, items, allowedTypes, filterType, activeFolder, searchQuery]);

  // Toggle selection
  const toggleSelect = useCallback(
    (item: MediaItem) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          if (!multiple) {
            // Single selection mode
            next.clear();
            next.add(item.id);
          } else if (next.size < maxSelection) {
            // Multi-selection mode with limit
            next.add(item.id);
          }
        }

        return next;
      });
    },
    [multiple, maxSelection]
  );

  // Handle confirm
  const handleConfirm = () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    onSelect(selectedItems);
    onClose();
  };

  // Reset and close
  const handleClose = () => {
    setSelectedIds(new Set(initialSelection));
    setSearchQuery("");
    setFilterType("all");
    setActiveFolder(null);
    setActiveTab("recent");
    onClose();
  };

  const selectedItems = items.filter((item) => selectedIds.has(item.id));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Media</DialogTitle>
          <DialogDescription>
            {multiple
              ? `Choose up to ${maxSelection} items from the media library.`
              : "Choose an item from the media library."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Search and filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as MediaType | "all")}
            >
              <SelectTrigger className="w-[130px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(!allowedTypes || allowedTypes.includes("image")) && (
                  <SelectItem value="image">Images</SelectItem>
                )}
                {(!allowedTypes || allowedTypes.includes("video")) && (
                  <SelectItem value="video">Videos</SelectItem>
                )}
                {(!allowedTypes || allowedTypes.includes("audio")) && (
                  <SelectItem value="audio">Audio</SelectItem>
                )}
                {(!allowedTypes || allowedTypes.includes("document")) && (
                  <SelectItem value="document">Documents</SelectItem>
                )}
              </SelectContent>
            </Select>

            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "recent" | "browse")}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="w-full justify-start">
              <TabsTrigger value="recent" className="gap-2">
                <Clock className="h-4 w-4" />
                Recent
              </TabsTrigger>
              <TabsTrigger value="browse" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Browse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="flex-1 mt-4">
              {loading ? (
                <div className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-6 gap-2"
                    : "space-y-1"
                )}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className={viewMode === "grid" ? "aspect-square rounded-lg" : "h-14 rounded-lg"}
                    />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No recent media</p>
                </div>
              ) : viewMode === "grid" ? (
                <ScrollArea className="h-[280px]">
                  <div className="grid grid-cols-6 gap-2">
                    {filteredItems.map((item) => (
                      <MediaThumbnail
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        onClick={() => toggleSelect(item)}
                        size="md"
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1">
                    {filteredItems.map((item) => (
                      <MediaListItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        onClick={() => toggleSelect(item)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="browse" className="flex-1 mt-4">
              <div className="flex gap-4 h-[280px]">
                {/* Folder sidebar */}
                <div className="w-40 shrink-0 border-r pr-3">
                  <ScrollArea className="h-full">
                    <div className="space-y-1">
                      <button
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm",
                          "hover:bg-accent transition-colors text-left",
                          activeFolder === null && "bg-primary/10 text-primary"
                        )}
                        onClick={() => setActiveFolder(null)}
                      >
                        <Grid3X3 className="h-4 w-4" />
                        All Files
                      </button>
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm",
                            "hover:bg-accent transition-colors text-left",
                            activeFolder === folder.id && "bg-primary/10 text-primary"
                          )}
                          onClick={() => setActiveFolder(folder.id)}
                        >
                          <FolderOpen
                            className="h-4 w-4"
                            style={{ color: folder.color || undefined }}
                          />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Items */}
                <div className="flex-1">
                  {loading ? (
                    <div className={cn(
                      viewMode === "grid"
                        ? "grid grid-cols-5 gap-2"
                        : "space-y-1"
                    )}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className={viewMode === "grid" ? "aspect-square rounded-lg" : "h-14 rounded-lg"}
                        />
                      ))}
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FolderOpen className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No media in this folder</p>
                    </div>
                  ) : viewMode === "grid" ? (
                    <ScrollArea className="h-full">
                      <div className="grid grid-cols-5 gap-2">
                        {filteredItems.map((item) => (
                          <MediaThumbnail
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.has(item.id)}
                            onClick={() => toggleSelect(item)}
                            size="md"
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-1">
                        {filteredItems.map((item) => (
                          <MediaListItem
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.has(item.id)}
                            onClick={() => toggleSelect(item)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Selection preview */}
          {selectedItems.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  Selected ({selectedItems.length}
                  {multiple && `/${maxSelection}`})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative shrink-0"
                  >
                    <MediaThumbnail
                      item={item}
                      isSelected={true}
                      onClick={() => toggleSelect(item)}
                      size="sm"
                    />
                    <button
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            {multiple
              ? `Select ${selectedItems.length} Item${selectedItems.length !== 1 ? "s" : ""}`
              : "Select"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MediaPicker;
