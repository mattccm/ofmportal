"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Tag as TagIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Hash,
  BarChart3,
  Palette,
  X,
  Tags,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TagBadge, TagList } from "./tag-badge";
import {
  Tag,
  TagInput,
  PRESET_TAG_COLORS,
  getContrastColor,
  isValidHexColor,
  getRandomPresetColor,
  BulkTagAction,
} from "@/lib/tag-types";

// ============================================
// TAG INPUT WITH AUTOCOMPLETE
// ============================================

interface TagInputAutocompleteProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  availableTags: Tag[];
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  allowCreate?: boolean;
  onCreateTag?: (name: string) => Promise<Tag | null>;
  className?: string;
}

export function TagInputAutocomplete({
  value,
  onChange,
  availableTags,
  placeholder = "Add tags...",
  disabled = false,
  maxTags,
  allowCreate = true,
  onCreateTag,
  className,
}: TagInputAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const suggestions = useMemo(() => {
    const selectedIds = new Set(value.map((t) => t.id));
    const filtered = availableTags.filter(
      (tag) =>
        !selectedIds.has(tag.id) &&
        tag.name.toLowerCase().includes(inputValue.toLowerCase())
    );
    return filtered.slice(0, 10);
  }, [availableTags, value, inputValue]);

  // Check if we can create a new tag
  const canCreateNew = useMemo(() => {
    if (!allowCreate || !inputValue.trim()) return false;
    const normalizedInput = inputValue.trim().toLowerCase();
    return !availableTags.some((t) => t.name.toLowerCase() === normalizedInput);
  }, [allowCreate, inputValue, availableTags]);

  const handleSelectTag = (tag: Tag) => {
    if (maxTags && value.length >= maxTags) {
      toast.error(`Maximum ${maxTags} tags allowed`);
      return;
    }
    onChange([...value, tag]);
    setInputValue("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(value.filter((t) => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !inputValue.trim()) return;

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(inputValue.trim());
      if (newTag) {
        handleSelectTag(newTag);
      }
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (canCreateNew ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectTag(suggestions[highlightedIndex]);
        } else if (highlightedIndex === suggestions.length && canCreateNew) {
          handleCreateTag();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case "Backspace":
        if (!inputValue && value.length > 0) {
          handleRemoveTag(value[value.length - 1].id);
        }
        break;
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-10 p-2 rounded-xl border bg-background",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            size="sm"
            removable
            onRemove={() => handleRemoveTag(tag.id)}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
          className={cn(
            "flex-1 min-w-[100px] bg-transparent outline-none text-sm",
            "placeholder:text-muted-foreground"
          )}
        />
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || canCreateNew) && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg",
            "max-h-60 overflow-auto"
          )}
        >
          {suggestions.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-left text-sm",
                "hover:bg-muted/50 focus:bg-muted/50 outline-none",
                highlightedIndex === index && "bg-muted/50"
              )}
              onClick={() => handleSelectTag(tag)}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="truncate">{tag.name}</span>
              {tag.usageCount !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {tag.usageCount}
                </span>
              )}
            </button>
          ))}

          {canCreateNew && (
            <>
              {suggestions.length > 0 && (
                <div className="border-t border-border" />
              )}
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-left text-sm",
                  "hover:bg-muted/50 focus:bg-muted/50 outline-none",
                  "text-primary",
                  highlightedIndex === suggestions.length && "bg-muted/50"
                )}
                onClick={handleCreateTag}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Create &quot;{inputValue}&quot;</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// COLOR PICKER
// ============================================

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let color = e.target.value;
    if (!color.startsWith("#")) {
      color = "#" + color;
    }
    setCustomColor(color);
    if (isValidHexColor(color)) {
      onChange(color);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_TAG_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={cn(
              "w-8 h-8 rounded-lg transition-all duration-150",
              "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
              value === preset.value && "ring-2 ring-offset-2 ring-indigo-500"
            )}
            style={{ backgroundColor: preset.value }}
            onClick={() => onChange(preset.value)}
            title={preset.name}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className="gap-1.5"
        >
          <Palette className="h-4 w-4" />
          Custom
        </Button>
        {showCustom && (
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="text"
              placeholder="#6366f1"
              value={customColor}
              onChange={handleCustomColorChange}
              className="h-8 w-24 font-mono text-sm"
            />
            <input
              type="color"
              value={isValidHexColor(value) ? value : "#6366f1"}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange(e.target.value);
              }}
              className="w-8 h-8 rounded-lg cursor-pointer border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CREATE/EDIT TAG DIALOG
// ============================================

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  onSave: (tag: TagInput) => Promise<void>;
}

function TagDialog({ open, onOpenChange, tag, onSave }: TagDialogProps) {
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || getRandomPresetColor());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tag?.name || "");
      setColor(tag?.color || getRandomPresetColor());
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    if (!isValidHexColor(color)) {
      toast.error("Invalid color format");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), color });
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-1.5">
              <TagIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {tag ? "Edit Tag" : "Create New Tag"}
          </DialogTitle>
          <DialogDescription>
            {tag
              ? "Update the tag name and color."
              : "Create a new tag to organize your content."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Tag Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Featured, Priority, Review"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <TagBadge
                name={name || "Tag Name"}
                color={color}
                size="md"
              />
              <TagBadge
                name={name || "Tag Name"}
                color={color}
                size="sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {tag ? "Save Changes" : "Create Tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// TAG FILTER SIDEBAR
// ============================================

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
  filterMode: "any" | "all";
  onFilterModeChange: (mode: "any" | "all") => void;
  className?: string;
}

export function TagFilter({
  tags,
  selectedTagIds,
  onSelectionChange,
  filterMode,
  onFilterModeChange,
  className,
}: TagFilterProps) {
  const [search, setSearch] = useState("");

  const filteredTags = useMemo(() => {
    if (!search) return tags;
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [tags, search]);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filter by Tags
        </h3>
        {selectedTagIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelectionChange([])}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Filter Mode */}
      {selectedTagIds.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Match:</span>
          <button
            type="button"
            className={cn(
              "px-2 py-1 rounded-md transition-colors",
              filterMode === "any"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onFilterModeChange("any")}
          >
            Any
          </button>
          <button
            type="button"
            className={cn(
              "px-2 py-1 rounded-md transition-colors",
              filterMode === "all"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onFilterModeChange("all")}
          >
            All
          </button>
        </div>
      )}

      {/* Tag List */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filteredTags.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No tags found
          </p>
        ) : (
          filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-left",
                  "transition-colors hover:bg-muted/50",
                  isSelected && "bg-indigo-50 dark:bg-indigo-900/20"
                )}
                onClick={() => toggleTag(tag.id)}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center",
                    isSelected
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate flex-1">{tag.name}</span>
                {tag.usageCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {tag.usageCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================
// BULK TAG DIALOG
// ============================================

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  selectedCount: number;
  onApply: (action: BulkTagAction, tagIds: string[]) => Promise<void>;
}

export function BulkTagDialog({
  open,
  onOpenChange,
  tags,
  selectedCount,
  onApply,
}: BulkTagDialogProps) {
  const [action, setAction] = useState<BulkTagAction>("add");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (selectedTagIds.length === 0) {
      toast.error("Please select at least one tag");
      return;
    }

    setIsApplying(true);
    try {
      await onApply(action, selectedTagIds);
      onOpenChange(false);
      setSelectedTagIds([]);
    } catch {
      // Error handled by parent
    } finally {
      setIsApplying(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-1.5">
              <Tags className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Bulk Tag {selectedCount} Item{selectedCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Apply tag changes to all selected items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={action === "add" ? "default" : "outline"}
              size="sm"
              onClick={() => setAction("add")}
              className="flex-1 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Button
              type="button"
              variant={action === "remove" ? "default" : "outline"}
              size="sm"
              onClick={() => setAction("remove")}
              className="flex-1 gap-1.5"
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
            <Button
              type="button"
              variant={action === "replace" ? "default" : "outline"}
              size="sm"
              onClick={() => setAction("replace")}
              className="flex-1 gap-1.5"
            >
              <Hash className="h-4 w-4" />
              Replace
            </Button>
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <Label>
              {action === "add"
                ? "Tags to add"
                : action === "remove"
                ? "Tags to remove"
                : "Replace with these tags"}
            </Label>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tags available
                </p>
              ) : (
                tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm",
                        "transition-colors hover:bg-muted/50",
                        isSelected && "bg-indigo-50 dark:bg-indigo-900/20"
                      )}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTag(tag.id)}
                        className="pointer-events-none"
                      />
                      <TagBadge name={tag.name} color={tag.color} size="sm" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Tags Preview */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-lg">
              {selectedTagIds.map((id) => {
                const tag = tags.find((t) => t.id === id);
                return tag ? (
                  <TagBadge
                    key={id}
                    name={tag.name}
                    color={tag.color}
                    size="sm"
                    removable
                    onRemove={() => toggleTag(id)}
                  />
                ) : null;
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedTagIds.length === 0 || isApplying}
            className="gap-1.5"
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Apply to {selectedCount} Item{selectedCount !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// TAG MANAGER (FULL ADMIN VIEW)
// ============================================

interface TagManagerProps {
  className?: string;
}

export function TagManager({ className }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      const data = await response.json();
      setTags(data.tags);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Filter tags
  const filteredTags = useMemo(() => {
    if (!search) return tags;
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [tags, search]);

  // Create/Update tag
  const handleSaveTag = async (input: TagInput) => {
    try {
      const response = await fetch("/api/tags", {
        method: editingTag ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTag ? { id: editingTag.id, ...input } : input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save tag");
      }

      toast.success(editingTag ? "Tag updated" : "Tag created");
      setEditingTag(null);
      fetchTags();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save tag");
      throw error;
    }
  };

  // Delete tag
  const handleDeleteTag = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete tag");
      toast.success("Tag deleted");
      setDeleteConfirmId(null);
      fetchTags();
    } catch {
      toast.error("Failed to delete tag");
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats
  const totalUsage = useMemo(
    () => tags.reduce((sum, tag) => sum + (tag.usageCount || 0), 0),
    [tags]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tag Manager</h2>
          <p className="text-muted-foreground">
            Create and manage tags to organize your content
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Tag
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2">
                <Tags className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tags.length}</p>
                <p className="text-xs text-muted-foreground">Total Tags</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 dark:bg-violet-900/30 p-2">
                <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUsage}</p>
                <p className="text-xs text-muted-foreground">Total Usage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tags List */}
      {filteredTags.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <TagIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {search ? "No tags found" : "No tags yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                {search
                  ? "Try adjusting your search to find what you're looking for."
                  : "Create your first tag to start organizing your content."}
              </p>
              {!search && (
                <Button onClick={() => setDialogOpen(true)} className="mt-6 gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create Tag
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Tags</CardTitle>
            <CardDescription>
              {filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TagBadge name={tag.name} color={tag.color} size="md" />
                    <span className="text-sm text-muted-foreground">
                      Used {tag.usageCount || 0} time{(tag.usageCount || 0) !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingTag(tag);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirmId(tag.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <TagDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTag(null);
        }}
        tag={editingTag}
        onSave={handleSaveTag}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? It will be removed from
              all uploads and requests. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteTag(deleteConfirmId)}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
