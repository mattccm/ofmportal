"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  FolderOpen,
  FolderPlus,
  Upload,
  Filter,
  SortAsc,
  MoreHorizontal,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Tag,
  Calendar,
  TrendingUp,
  Archive,
  Trash2,
  Move,
  Download,
  Eye,
  Check,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MediaItem,
  MediaFolder,
  MediaType,
  MediaStatus,
  MediaLibraryFilters,
} from "@/types/media-library";
import { MediaPreviewModal } from "./media-preview-modal";

interface MediaLibraryViewProps {
  creatorId: string;
  initialItems?: MediaItem[];
  initialFolders?: MediaFolder[];
  onUploadClick?: () => void;
  onImportClick?: () => void;
  selectionMode?: boolean;
  onSelectionChange?: (items: MediaItem[]) => void;
  maxSelection?: number;
}

// Virtualized grid constants
const ITEM_HEIGHT = 200;
const ITEM_WIDTH = 200;
const GAP = 16;
const BUFFER_SIZE = 2; // Number of rows to render above/below viewport

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getMediaTypeIcon(type: MediaType) {
  switch (type) {
    case "image":
      return <ImageIcon className="h-5 w-5" />;
    case "video":
      return <Video className="h-5 w-5" />;
    case "audio":
      return <Music className="h-5 w-5" />;
    case "document":
      return <FileText className="h-5 w-5" />;
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

function getStatusBadge(status: MediaStatus) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-yellow-600">Pending</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-green-600">Approved</Badge>;
    case "archived":
      return <Badge variant="outline" className="text-gray-500">Archived</Badge>;
  }
}

// Media Item Card Component
function MediaItemCard({
  item,
  isSelected,
  onSelect,
  onClick,
  viewMode,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  item: MediaItem;
  isSelected: boolean;
  onSelect: (item: MediaItem, selected: boolean) => void;
  onClick: (item: MediaItem) => void;
  viewMode: "grid" | "list";
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "flex items-center gap-4 p-3 rounded-lg border transition-all",
          "hover:bg-accent/50 cursor-pointer",
          isSelected && "bg-primary/10 border-primary",
          isDragging && "opacity-50"
        )}
        onClick={() => onClick(item)}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item, !isSelected);
          }}
        >
          <Checkbox checked={isSelected} />
        </div>

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
              alt={item.title || item.originalName}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            getMediaTypeIcon(item.mediaType)
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {item.title || item.originalName}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(item.fileSize)} - {item.mediaType}
          </p>
        </div>

        {/* Tags */}
        <div className="hidden md:flex items-center gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{item.tags.length - 2}
            </Badge>
          )}
        </div>

        {/* Usage */}
        <div className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          {item.usageCount}
        </div>

        {/* Status */}
        {getStatusBadge(item.status)}

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onClick(item)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Move className="mr-2 h-4 w-4" />
              Move to Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={cn(
        "group relative rounded-xl border overflow-hidden transition-all",
        "hover:shadow-lg hover:border-primary/50 cursor-pointer",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-50"
      )}
      style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT }}
      onClick={() => onClick(item)}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "absolute top-2 left-2 z-10 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item, !isSelected);
        }}
      >
        <div className="bg-white dark:bg-gray-900 rounded-md shadow p-0.5">
          <Checkbox checked={isSelected} />
        </div>
      </div>

      {/* Thumbnail */}
      <div className="w-full h-[140px] bg-muted flex items-center justify-center">
        {item.thumbnailKey && !imageError ? (
          <img
            src={`/api/media-library/thumbnail/${item.id}`}
            alt={item.title || item.originalName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center", getMediaTypeColor(item.mediaType))}>
            {getMediaTypeIcon(item.mediaType)}
          </div>
        )}

        {/* Video duration overlay */}
        {item.mediaType === "video" && item.duration && (
          <div className="absolute bottom-[64px] right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="font-medium text-sm truncate" title={item.title || item.originalName}>
          {item.title || item.originalName}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(item.fileSize)}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {item.usageCount}
          </div>
        </div>
      </div>

      {/* Hover overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 flex items-center justify-center gap-2",
          "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      >
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10"
          onClick={(e) => {
            e.stopPropagation();
            onClick(item);
          }}
        >
          <Eye className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// Folder Card Component
function FolderCard({
  folder,
  isActive,
  onClick,
  onDragOver,
  onDrop,
}: {
  folder: MediaFolder;
  isActive: boolean;
  onClick: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent",
        isActive && "bg-primary/10 text-primary"
      )}
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={onDrop}
    >
      <FolderOpen
        className="h-5 w-5 shrink-0"
        style={{ color: folder.color || undefined }}
      />
      <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
      <span className="text-xs text-muted-foreground">{folder.itemCount}</span>
    </div>
  );
}

export function MediaLibraryView({
  creatorId,
  initialItems = [],
  initialFolders = [],
  onUploadClick,
  onImportClick,
  selectionMode = false,
  onSelectionChange,
  maxSelection,
}: MediaLibraryViewProps) {
  // State
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState<MediaLibraryFilters>({
    creatorId,
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // Virtualization
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate columns based on container width
  const columns = useMemo(() => {
    if (viewMode === "list") return 1;
    return Math.max(1, Math.floor((containerWidth + GAP) / (ITEM_WIDTH + GAP)));
  }, [containerWidth, viewMode]);

  // Calculate visible items for virtualization
  const { visibleItems, totalHeight, offsetTop } = useMemo(() => {
    if (viewMode === "list") {
      return {
        visibleItems: items.slice(visibleRange.start, visibleRange.end),
        totalHeight: items.length * 60, // List item height
        offsetTop: visibleRange.start * 60,
      };
    }

    const rows = Math.ceil(items.length / columns);
    const rowHeight = ITEM_HEIGHT + GAP;
    const totalHeight = rows * rowHeight;

    const startRow = Math.floor(visibleRange.start / columns);
    const endRow = Math.ceil(visibleRange.end / columns);
    const startIndex = Math.max(0, (startRow - BUFFER_SIZE) * columns);
    const endIndex = Math.min(items.length, (endRow + BUFFER_SIZE) * columns);

    return {
      visibleItems: items.slice(startIndex, endIndex),
      totalHeight,
      offsetTop: Math.floor(startIndex / columns) * rowHeight,
    };
  }, [items, columns, visibleRange, viewMode]);

  // Handle scroll for virtualization
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, clientHeight } = containerRef.current;
    const itemsPerRow = viewMode === "list" ? 1 : columns;
    const rowHeight = viewMode === "list" ? 60 : ITEM_HEIGHT + GAP;

    const startRow = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(clientHeight / rowHeight);
    const endRow = startRow + visibleRows;

    setVisibleRange({
      start: startRow * itemsPerRow,
      end: (endRow + 1) * itemsPerRow,
    });
  }, [columns, viewMode]);

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Fetch data
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        creatorId,
        page: filters.page?.toString() || "1",
        limit: filters.limit?.toString() || "50",
        sortBy: filters.sortBy || "createdAt",
        sortOrder: filters.sortOrder || "desc",
      });

      if (activeFolder) params.set("folderId", activeFolder);
      if (searchQuery) params.set("search", searchQuery);
      if (filters.mediaType) params.set("mediaType", filters.mediaType);
      if (filters.status) params.set("status", filters.status);

      const response = await fetch(`/api/media-library?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        if (data.folders) setFolders(data.folders);
      }
    } catch (error) {
      console.error("Failed to fetch media items:", error);
    } finally {
      setLoading(false);
    }
  }, [creatorId, filters, activeFolder, searchQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Selection handlers
  const handleSelect = useCallback(
    (item: MediaItem, selected: boolean) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (selected) {
          if (maxSelection && next.size >= maxSelection) return prev;
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
        return next;
      });
    },
    [maxSelection]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedItems]);

  // Notify selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selected = items.filter((i) => selectedItems.has(i.id));
      onSelectionChange(selected);
    }
  }, [selectedItems, items, onSelectionChange]);

  // Drag and drop
  const [draggedItem, setDraggedItem] = useState<MediaItem | null>(null);

  const handleDragStart = useCallback((item: MediaItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const handleFolderDrop = useCallback(
    async (folderId: string) => {
      if (!draggedItem) return;

      try {
        await fetch(`/api/media-library/${draggedItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        fetchItems();
      } catch (error) {
        console.error("Failed to move item:", error);
      }
    },
    [draggedItem, fetchItems]
  );

  // Create new folder
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch("/api/media-library/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          name: newFolderName.trim(),
        }),
      });

      if (response.ok) {
        setNewFolderName("");
        setIsCreatingFolder(false);
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedItems.size === 0) return;

    try {
      await fetch("/api/media-library/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems),
          action,
        }),
      });
      setSelectedItems(new Set());
      fetchItems();
    } catch (error) {
      console.error("Bulk action failed:", error);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Folders */}
      <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3">Folders</h3>
          <div className="space-y-1">
            {/* All Items */}
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
                "hover:bg-accent",
                activeFolder === null && "bg-primary/10 text-primary"
              )}
              onClick={() => setActiveFolder(null)}
            >
              <Grid3X3 className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-sm font-medium">All Items</span>
              <span className="text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>

            {/* Folder list */}
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                isActive={activeFolder === folder.id}
                onClick={() => setActiveFolder(folder.id)}
                onDrop={() => handleFolderDrop(folder.id)}
              />
            ))}

            {/* New folder input */}
            {isCreatingFolder ? (
              <div className="flex items-center gap-2 px-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") setIsCreatingFolder(false);
                  }}
                />
                <Button size="icon-sm" variant="ghost" onClick={handleCreateFolder}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setIsCreatingFolder(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setIsCreatingFolder(true)}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            )}
          </div>
        </div>

        {/* Quick filters */}
        <div className="p-4">
          <h4 className="text-sm font-medium mb-2">Media Type</h4>
          <div className="space-y-1">
            {(["image", "video", "audio", "document"] as MediaType[]).map(
              (type) => (
                <button
                  key={type}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-accent",
                    filters.mediaType === type && "bg-primary/10 text-primary"
                  )}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      mediaType: f.mediaType === type ? undefined : type,
                    }))
                  }
                >
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center", getMediaTypeColor(type))}>
                    {getMediaTypeIcon(type)}
                  </div>
                  <span className="capitalize">{type}s</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center border rounded-lg p-1">
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

            {/* Sort */}
            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split("-") as [
                  MediaLibraryFilters["sortBy"],
                  MediaLibraryFilters["sortOrder"]
                ];
                setFilters((f) => ({ ...f, sortBy, sortOrder }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SortAsc className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Newest First</SelectItem>
                <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                <SelectItem value="fileName-asc">Name A-Z</SelectItem>
                <SelectItem value="fileName-desc">Name Z-A</SelectItem>
                <SelectItem value="fileSize-desc">Largest First</SelectItem>
                <SelectItem value="fileSize-asc">Smallest First</SelectItem>
                <SelectItem value="usageCount-desc">Most Used</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter toggle */}
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={() => fetchItems()}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onImportClick}>
                <Download className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button onClick={onUploadClick}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          {/* Selection bar */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3 bg-muted rounded-lg px-4 py-2">
              <Checkbox
                checked={selectedItems.size === items.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">
                {selectedItems.size} selected
              </span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("move")}>
                <Move className="mr-2 h-4 w-4" />
                Move
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("tag")}>
                <Tag className="mr-2 h-4 w-4" />
                Tag
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("archive")}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleBulkAction("delete")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItems(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Extended filters */}
          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters((f) => ({
                    ...f,
                    status: value === "all" ? undefined : (value as MediaStatus),
                  }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    creatorId,
                    page: 1,
                    limit: 50,
                    sortBy: "createdAt",
                    sortOrder: "desc",
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4"
          onScroll={handleScroll}
        >
          {loading && items.length === 0 ? (
            // Loading skeleton
            <div className={cn(
              viewMode === "grid"
                ? "grid gap-4"
                : "space-y-2"
            )} style={{
              gridTemplateColumns: viewMode === "grid" ? `repeat(${columns || 4}, ${ITEM_WIDTH}px)` : undefined
            }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={viewMode === "grid" ? "h-[200px] w-[200px] rounded-xl" : "h-[60px] rounded-lg"}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No media files yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Upload your first media files or import from approved uploads to
                build your creator&apos;s portfolio.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onImportClick}>
                  <Download className="mr-2 h-4 w-4" />
                  Import from Uploads
                </Button>
                <Button onClick={onUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            </div>
          ) : (
            // Virtualized content
            <div
              style={{ height: totalHeight, position: "relative" }}
            >
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid gap-4"
                    : "space-y-2"
                )}
                style={{
                  position: "absolute",
                  top: offsetTop,
                  left: 0,
                  right: 0,
                  display: viewMode === "grid" ? "grid" : "flex",
                  flexDirection: viewMode === "list" ? "column" : undefined,
                  gap: viewMode === "grid" ? GAP : 8,
                  gridTemplateColumns: viewMode === "grid" ? `repeat(${columns || 4}, ${ITEM_WIDTH}px)` : undefined,
                }}
              >
                {visibleItems.map((item) => (
                  <MediaItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    onSelect={handleSelect}
                    onClick={setPreviewItem}
                    viewMode={viewMode}
                    isDragging={draggedItem?.id === item.id}
                    onDragStart={() => handleDragStart(item)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <MediaPreviewModal
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          media={previewItem}
          onEdit={() => fetchItems()}
          onDelete={() => {
            fetchItems();
            setPreviewItem(null);
          }}
          onDownload={(media) => {
            window.open(`/api/media-library/${media.id}/download`, "_blank");
          }}
        />
      )}
    </div>
  );
}

export default MediaLibraryView;
