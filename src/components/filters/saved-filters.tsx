"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Filter,
  Save,
  Star,
  StarOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  Plus,
  X,
  Check,
  Loader2,
  SlidersHorizontal,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FilterBuilder, FilterSummary } from "./filter-builder";
import {
  type SavedFilter,
  type FilterGroup,
  type FilterFieldDefinition,
  createEmptyFilterGroup,
  formatFilterGroupSummary,
  getQuickFilterPresets,
  validateFilterGroup,
} from "@/lib/filter-utils";

interface SavedFiltersProps {
  entityType: "requests" | "uploads" | "creators";
  fieldDefinitions: FilterFieldDefinition[];
  relationOptions?: Record<string, { value: string; label: string }[]>;
  currentFilter: FilterGroup;
  onFilterChange: (filter: FilterGroup) => void;
  onApplyFilter?: () => void;
  className?: string;
}

export function SavedFilters({
  entityType,
  fieldDefinitions,
  relationOptions = {},
  currentFilter,
  onFilterChange,
  onApplyFilter,
  className,
}: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterDescription, setFilterDescription] = useState("");

  // Fetch saved filters on mount
  useEffect(() => {
    fetchSavedFilters();
  }, [entityType]);

  const fetchSavedFilters = async () => {
    try {
      const response = await fetch(`/api/filters?entityType=${entityType}`);
      if (response.ok) {
        const data = await response.json();
        setSavedFilters(data.filters || []);
      }
    } catch (error) {
      console.error("Failed to fetch saved filters:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast.error("Please enter a filter name");
      return;
    }

    const errors = validateFilterGroup(currentFilter, fieldDefinitions);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/filters", {
        method: editingFilter ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingFilter?.id,
          name: filterName,
          description: filterDescription,
          entityType,
          filter: currentFilter,
          isPinned: editingFilter?.isPinned || false,
          isDefault: editingFilter?.isDefault || false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save filter");
      }

      const data = await response.json();

      if (editingFilter) {
        setSavedFilters((prev) =>
          prev.map((f) => (f.id === editingFilter.id ? data.filter : f))
        );
        toast.success("Filter updated successfully");
      } else {
        setSavedFilters((prev) => [...prev, data.filter]);
        toast.success("Filter saved successfully");
      }

      setSaveDialogOpen(false);
      setFilterName("");
      setFilterDescription("");
      setEditingFilter(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save filter");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    try {
      const response = await fetch(`/api/filters?id=${filterId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete filter");
      }

      setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
      if (selectedFilterId === filterId) {
        setSelectedFilterId(null);
      }
      toast.success("Filter deleted");
    } catch (error) {
      toast.error("Failed to delete filter");
    }
  };

  const handleTogglePin = async (filter: SavedFilter) => {
    try {
      const response = await fetch("/api/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: filter.id,
          isPinned: !filter.isPinned,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update filter");
      }

      setSavedFilters((prev) =>
        prev.map((f) =>
          f.id === filter.id ? { ...f, isPinned: !f.isPinned } : f
        )
      );
      toast.success(filter.isPinned ? "Filter unpinned" : "Filter pinned");
    } catch (error) {
      toast.error("Failed to update filter");
    }
  };

  const handleSelectFilter = (filter: SavedFilter) => {
    setSelectedFilterId(filter.id);
    onFilterChange(filter.filter);
    onApplyFilter?.();
  };

  const handleEditFilter = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setFilterDescription(filter.description || "");
    onFilterChange(filter.filter);
    setSaveDialogOpen(true);
  };

  const handleClearFilter = () => {
    setSelectedFilterId(null);
    onFilterChange(createEmptyFilterGroup());
    onApplyFilter?.();
  };

  const openSaveDialog = () => {
    setEditingFilter(null);
    setFilterName("");
    setFilterDescription("");
    setSaveDialogOpen(true);
  };

  // Sort filters: pinned first, then alphabetically
  const sortedFilters = [...savedFilters].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  const pinnedFilters = sortedFilters.filter((f) => f.isPinned);
  const unpinnedFilters = sortedFilters.filter((f) => !f.isPinned);

  const quickPresets = getQuickFilterPresets(entityType);

  const hasActiveFilter = currentFilter.conditions.some(
    (c) => c.field && c.value !== null
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Saved Filters Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {selectedFilterId ? (
                <>
                  <span className="max-w-[120px] truncate">
                    {savedFilters.find((f) => f.id === selectedFilterId)?.name || "Saved Filter"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </>
              ) : (
                <>
                  Saved Filters
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                {/* Pinned Filters */}
                {pinnedFilters.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Pinned
                    </div>
                    {pinnedFilters.map((filter) => (
                      <FilterMenuItem
                        key={filter.id}
                        filter={filter}
                        isSelected={selectedFilterId === filter.id}
                        fieldDefinitions={fieldDefinitions}
                        onSelect={() => handleSelectFilter(filter)}
                        onEdit={() => handleEditFilter(filter)}
                        onDelete={() => handleDeleteFilter(filter.id)}
                        onTogglePin={() => handleTogglePin(filter)}
                      />
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Quick Presets */}
                {quickPresets.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Quick Filters
                    </div>
                    {quickPresets.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => {
                          onFilterChange(preset.filter);
                          setSelectedFilterId(null);
                          onApplyFilter?.();
                        }}
                      >
                        <Bookmark className="h-4 w-4 mr-2 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm">{preset.name}</div>
                          {preset.description && (
                            <div className="text-xs text-muted-foreground">
                              {preset.description}
                            </div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Saved Filters */}
                {unpinnedFilters.length > 0 ? (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Saved Filters
                    </div>
                    {unpinnedFilters.map((filter) => (
                      <FilterMenuItem
                        key={filter.id}
                        filter={filter}
                        isSelected={selectedFilterId === filter.id}
                        fieldDefinitions={fieldDefinitions}
                        onSelect={() => handleSelectFilter(filter)}
                        onEdit={() => handleEditFilter(filter)}
                        onDelete={() => handleDeleteFilter(filter.id)}
                        onTogglePin={() => handleTogglePin(filter)}
                      />
                    ))}
                  </>
                ) : pinnedFilters.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No saved filters yet
                  </div>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter Builder Toggle */}
        <Button
          variant={showBuilder ? "secondary" : "outline"}
          className="gap-2"
          onClick={() => setShowBuilder(!showBuilder)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {showBuilder ? "Hide Builder" : "Filter Builder"}
        </Button>

        {/* Save Current Filter */}
        {hasActiveFilter && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={openSaveDialog}
          >
            <Save className="h-4 w-4" />
            Save Filter
          </Button>
        )}

        {/* Clear Filter */}
        {hasActiveFilter && (
          <Button variant="ghost" className="gap-2" onClick={handleClearFilter}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter Builder Panel */}
      {showBuilder && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter Builder</CardTitle>
            <CardDescription>
              Create complex filter conditions to find exactly what you need
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterBuilder
              filterGroup={currentFilter}
              onChange={onFilterChange}
              fieldDefinitions={fieldDefinitions}
              relationOptions={relationOptions}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBuilder(false)}>
                Close
              </Button>
              <Button onClick={onApplyFilter}>Apply Filter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filter Summary */}
      {hasActiveFilter && !showBuilder && (
        <FilterSummary
          filterGroup={currentFilter}
          fieldDefinitions={fieldDefinitions}
          onClear={handleClearFilter}
        />
      )}

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFilter ? "Edit Filter" : "Save Filter"}
            </DialogTitle>
            <DialogDescription>
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., Overdue High Priority"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-description">Description (optional)</Label>
              <Textarea
                id="filter-description"
                placeholder="Brief description of what this filter shows"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Filter Preview</Label>
              <div className="rounded-lg bg-muted p-3">
                <FilterSummary
                  filterGroup={currentFilter}
                  fieldDefinitions={fieldDefinitions}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveFilter} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingFilter ? "Update Filter" : "Save Filter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FilterMenuItemProps {
  filter: SavedFilter;
  isSelected: boolean;
  fieldDefinitions: FilterFieldDefinition[];
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function FilterMenuItem({
  filter,
  isSelected,
  fieldDefinitions,
  onSelect,
  onEdit,
  onDelete,
  onTogglePin,
}: FilterMenuItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-sm cursor-pointer hover:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
    >
      {filter.isPinned ? (
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
      ) : (
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{filter.name}</span>
          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {formatFilterGroupSummary(filter.filter, fieldDefinitions)}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
          >
            {filter.isPinned ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Unpin
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Pin to Top
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Compact version for inline use
interface QuickFilterBarProps {
  entityType: "requests" | "uploads" | "creators";
  fieldDefinitions: FilterFieldDefinition[];
  currentFilter: FilterGroup;
  onFilterChange: (filter: FilterGroup) => void;
  onApplyFilter?: () => void;
  className?: string;
}

export function QuickFilterBar({
  entityType,
  fieldDefinitions,
  currentFilter,
  onFilterChange,
  onApplyFilter,
  className,
}: QuickFilterBarProps) {
  const quickPresets = getQuickFilterPresets(entityType);

  const handleApplyPreset = (preset: typeof quickPresets[0]) => {
    onFilterChange(preset.filter);
    onApplyFilter?.();
  };

  const handleClear = () => {
    onFilterChange(createEmptyFilterGroup());
    onApplyFilter?.();
  };

  const hasActiveFilter = currentFilter.conditions.some(
    (c) => c.field && c.value !== null
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Quick filters:</span>
      {quickPresets.map((preset) => (
        <Button
          key={preset.id}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleApplyPreset(preset)}
        >
          {preset.name}
        </Button>
      ))}
      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={handleClear}
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
