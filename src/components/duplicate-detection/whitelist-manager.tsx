"use client";

import * as React from "react";
import Image from "next/image";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  ShieldCheck,
  Image as ImageIcon,
  Video,
  FileText,
  File,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Upload,
  Tag,
  Calendar,
  User,
  Filter,
  MoreVertical,
  Download,
  Eye,
  Sparkles,
  Package,
  Palette,
  FileImage,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { WhitelistedContent } from "@/types/content-fingerprint";

// ============================================
// TYPES
// ============================================

type WhitelistCategory = "branding" | "stock" | "template" | "other";

interface WhitelistManagerProps {
  initialItems?: WhitelistedContent[];
  onAdd?: (item: WhitelistedContent) => void;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<WhitelistedContent>) => void;
}

interface AddWhitelistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: WhitelistFormData) => Promise<void>;
}

interface WhitelistFormData {
  name: string;
  description: string;
  category: WhitelistCategory;
  file: File | null;
}

// ============================================
// CONSTANTS
// ============================================

const CATEGORY_CONFIG: Record<
  WhitelistCategory,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  branding: {
    label: "Branding",
    icon: Palette,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-950/50",
  },
  stock: {
    label: "Stock Media",
    icon: FileImage,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-950/50",
  },
  template: {
    label: "Template",
    icon: Package,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-950/50",
  },
  other: {
    label: "Other",
    icon: Sparkles,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("text/") || mimeType.includes("document")) return FileText;
  return File;
}

// ============================================
// ADD WHITELIST DIALOG
// ============================================

function AddWhitelistDialog({ open, onOpenChange, onAdd }: AddWhitelistDialogProps) {
  const [formData, setFormData] = React.useState<WhitelistFormData>({
    name: "",
    description: "",
    category: "branding",
    file: null,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData({ ...formData, file: e.dataTransfer.files[0] });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.file) {
      setError("Please select a file");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd(formData);
      onOpenChange(false);
      setFormData({ name: "", description: "", category: "branding", file: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", category: "branding", file: null });
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) resetForm();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            Add to Whitelist
          </DialogTitle>
          <DialogDescription>
            Add content that should be allowed even if detected as a duplicate. Common uses include
            branding assets, stock media, and templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>File</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
                dragActive
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                formData.file && "border-green-500 bg-green-50 dark:bg-green-950/20"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileChange}
              />

              {formData.file ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {formData.file.name}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {formatFileSize(formData.file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({ ...formData, file: null });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports images and videos
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Company Logo, Product Photo Template"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value as WhitelistCategory })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <config.icon className={cn("h-4 w-4", config.color)} />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Why is this content whitelisted?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to Whitelist
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// WHITELIST ITEM CARD
// ============================================

function WhitelistItemCard({
  item,
  onEdit,
  onDelete,
  onView,
}: {
  item: WhitelistedContent;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const FileIcon = getFileIcon(item.mimeType);
  const categoryConfig = CATEGORY_CONFIG[item.category];

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-video bg-muted/30 relative overflow-hidden">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <FileIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Category Badge */}
        <Badge
          className={cn(
            "absolute top-2 left-2",
            categoryConfig.bgColor,
            categoryConfig.color
          )}
        >
          <categoryConfig.icon className="h-3 w-3 mr-1" />
          {categoryConfig.label}
        </Badge>

        {/* Actions Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold truncate" title={item.name}>
            {item.name}
          </h3>

          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(item.createdAt)}
            </div>
            <span>{formatFileSize(item.fileSize)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WhitelistManager({
  initialItems = [],
  onAdd,
  onRemove,
  onUpdate,
}: WhitelistManagerProps) {
  const [items, setItems] = React.useState<WhitelistedContent[]>(initialItems);
  const [isLoading, setIsLoading] = React.useState(!initialItems.length);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<WhitelistCategory | "all">("all");
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<WhitelistedContent | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Fetch items
  React.useEffect(() => {
    if (initialItems.length === 0) {
      fetchItems();
    }
  }, [initialItems]);

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/duplicate-attempts/whitelist");

      if (!response.ok) {
        throw new Error("Failed to fetch whitelist");
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (formData: WhitelistFormData) => {
    const form = new FormData();
    form.append("name", formData.name);
    form.append("description", formData.description);
    form.append("category", formData.category);
    if (formData.file) {
      form.append("file", formData.file);
    }

    const response = await fetch("/api/duplicate-attempts/whitelist", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to add item");
    }

    const newItem = await response.json();
    setItems([newItem, ...items]);
    onAdd?.(newItem);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/duplicate-attempts/whitelist/${selectedItem.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove item");
      }

      setItems(items.filter((item) => item.id !== selectedItem.id));
      onRemove?.(selectedItem.id);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter items
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, categoryFilter]);

  // Stats
  const stats = React.useMemo(() => {
    return {
      total: items.length,
      branding: items.filter((i) => i.category === "branding").length,
      stock: items.filter((i) => i.category === "stock").length,
      template: items.filter((i) => i.category === "template").length,
      other: items.filter((i) => i.category === "other").length,
    };
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading whitelist...
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchItems}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle>Whitelisted Content</CardTitle>
                <CardDescription>
                  Content that is allowed even when detected as a duplicate
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add to Whitelist
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <div
                key={key}
                className={cn("p-3 rounded-lg text-center", config.bgColor)}
              >
                <p className={cn("text-2xl font-bold", config.color)}>
                  {stats[key as keyof typeof stats]}
                </p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            ))}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search whitelisted content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as WhitelistCategory | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <config.icon className={cn("h-4 w-4", config.color)} />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No whitelisted content</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            {searchQuery || categoryFilter !== "all"
              ? "No items match your search criteria"
              : "Add branding assets, stock media, or templates that should be allowed as duplicates"}
          </p>
          {!searchQuery && categoryFilter === "all" && (
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add First Item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <WhitelistItemCard
              key={item.id}
              item={item}
              onEdit={() => {
                setSelectedItem(item);
                // TODO: Open edit dialog
              }}
              onDelete={() => {
                setSelectedItem(item);
                setDeleteDialogOpen(true);
              }}
              onView={() => {
                // TODO: Open view dialog
              }}
            />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <AddWhitelistDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAdd}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Whitelist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{selectedItem?.name}&quot; from the whitelist?
              This content will no longer be exempt from duplicate detection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default WhitelistManager;
