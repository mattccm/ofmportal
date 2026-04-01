"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  Users,
  GripVertical,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";

export interface Creator {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  inviteStatus?: string;
  tags?: string[];
}

interface BatchCreatorSelectorProps {
  creators: Creator[];
  selectedCreators: Creator[];
  onSelectionChange: (creators: Creator[]) => void;
  maxSelections?: number;
}

type FilterStatus = "all" | "active" | "pending" | "invited";

export function BatchCreatorSelector({
  creators,
  selectedCreators,
  onSelectionChange,
  maxSelections,
}: BatchCreatorSelectorProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Get unique tags from all creators
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    creators.forEach((creator) => {
      creator.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [creators]);

  // Filter creators based on search and filters
  const filteredCreators = useMemo(() => {
    return creators.filter((creator) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        creator.name.toLowerCase().includes(searchLower) ||
        creator.email.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && creator.inviteStatus === "ACCEPTED") ||
        (filterStatus === "pending" && creator.inviteStatus === "PENDING") ||
        (filterStatus === "invited" && creator.inviteStatus !== undefined);

      // Tag filter
      const matchesTag =
        filterTag === "all" ||
        (creator.tags && creator.tags.includes(filterTag));

      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [creators, search, filterStatus, filterTag]);

  // Check if a creator is selected
  const isSelected = useCallback(
    (creatorId: string) => {
      return selectedCreators.some((c) => c.id === creatorId);
    },
    [selectedCreators]
  );

  // Toggle creator selection
  const toggleCreator = useCallback(
    (creator: Creator) => {
      if (isSelected(creator.id)) {
        onSelectionChange(selectedCreators.filter((c) => c.id !== creator.id));
      } else {
        if (maxSelections && selectedCreators.length >= maxSelections) {
          return; // Max selections reached
        }
        onSelectionChange([...selectedCreators, creator]);
      }
    },
    [selectedCreators, onSelectionChange, isSelected, maxSelections]
  );

  // Select all filtered creators
  const selectAll = useCallback(() => {
    const newSelections = [...selectedCreators];
    filteredCreators.forEach((creator) => {
      if (!isSelected(creator.id)) {
        if (maxSelections && newSelections.length >= maxSelections) {
          return;
        }
        newSelections.push(creator);
      }
    });
    onSelectionChange(newSelections);
  }, [filteredCreators, selectedCreators, onSelectionChange, isSelected, maxSelections]);

  // Deselect all
  const deselectAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Remove single selected creator
  const removeCreator = useCallback(
    (creatorId: string) => {
      onSelectionChange(selectedCreators.filter((c) => c.id !== creatorId));
    },
    [selectedCreators, onSelectionChange]
  );

  // Drag and drop handlers for reordering selected creators
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newOrder = [...selectedCreators];
      const [draggedItem] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dropIndex, 0, draggedItem);
      onSelectionChange(newOrder);

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, selectedCreators, onSelectionChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // Calculate selection stats
  const allFilteredSelected = filteredCreators.every((c) => isSelected(c.id));
  const someFilteredSelected = filteredCreators.some((c) => isSelected(c.id));

  return (
    <div className="space-y-4">
      {/* Selected creators count and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          <span className="font-medium text-foreground">
            {selectedCreators.length} creator{selectedCreators.length !== 1 ? "s" : ""} selected
          </span>
          {maxSelections && (
            <span className="text-sm text-muted-foreground">
              (max {maxSelections})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={allFilteredSelected || (maxSelections !== undefined && selectedCreators.length >= maxSelections)}
            className="h-8"
          >
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={selectedCreators.length === 0}
            className="h-8"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Deselect All
          </Button>
        </div>
      </div>

      {/* Selected creators chips with drag to reorder */}
      {selectedCreators.length > 0 && (
        <div
          ref={dragRef}
          className="flex flex-wrap gap-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50"
        >
          {selectedCreators.map((creator, index) => (
            <div
              key={creator.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                group flex items-center gap-1.5 px-2 py-1 rounded-full
                bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800
                shadow-sm cursor-grab active:cursor-grabbing
                transition-all duration-200
                ${draggedIndex === index ? "opacity-50 scale-95" : ""}
                ${dragOverIndex === index ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
              `}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-semibold">
                  {creator.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                {creator.name}
              </span>
              <button
                onClick={() => removeCreator(creator.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creators by name or email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Creator list */}
      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
        {filteredCreators.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {search || filterStatus !== "all" || filterTag !== "all"
                ? "No creators match your filters"
                : "No creators available"}
            </p>
          </div>
        ) : (
          filteredCreators.map((creator) => {
            const selected = isSelected(creator.id);
            const disabled = !selected && maxSelections !== undefined && selectedCreators.length >= maxSelections;

            return (
              <div
                key={creator.id}
                className={`
                  flex items-center gap-3 p-3 transition-colors cursor-pointer
                  ${selected ? "bg-indigo-50/50 dark:bg-indigo-950/20" : "hover:bg-muted/50"}
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
                onClick={() => !disabled && toggleCreator(creator)}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => !disabled && toggleCreator(creator)}
                  disabled={disabled}
                  className="data-checked:bg-indigo-600 data-checked:border-indigo-600"
                />
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-semibold">
                    {creator.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {creator.name}
                    </span>
                    {creator.inviteStatus === "ACCEPTED" && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                        Active
                      </Badge>
                    )}
                    {creator.inviteStatus === "PENDING" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground truncate block">
                    {creator.email}
                  </span>
                </div>
                {creator.tags && creator.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {creator.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                    {creator.tags.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{creator.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCreators.length} of {creators.length} creators
      </div>
    </div>
  );
}
