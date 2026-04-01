"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Users,
  UserPlus,
  X,
  Check,
  Mail,
  Filter,
  ChevronDown,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Creator type
export interface Creator {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  inviteStatus: "PENDING" | "ACCEPTED" | "EXPIRED";
  tags?: { id: string; name: string; color: string }[];
  lastLoginAt?: Date | null;
  _count?: {
    requests: number;
    uploads: number;
  };
}

// Filter options
export type CreatorFilter = "all" | "active" | "pending" | "inactive" | "with-requests";

interface RecipientPickerProps {
  creators: Creator[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  className?: string;
}

export function RecipientPicker({
  creators,
  selectedIds,
  onSelectionChange,
  className,
}: RecipientPickerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CreatorFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique tags from all creators
  const allTags = useMemo(() => {
    const tagMap = new Map<string, { id: string; name: string; color: string }>();
    creators.forEach((creator) => {
      creator.tags?.forEach((tag) => {
        tagMap.set(tag.id, tag);
      });
    });
    return Array.from(tagMap.values());
  }, [creators]);

  // Filter creators based on search and filters
  const filteredCreators = useMemo(() => {
    return creators.filter((creator) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          creator.name.toLowerCase().includes(searchLower) ||
          creator.email.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      switch (filter) {
        case "active":
          if (creator.inviteStatus !== "ACCEPTED") return false;
          break;
        case "pending":
          if (creator.inviteStatus !== "PENDING") return false;
          break;
        case "inactive":
          // Consider inactive if no login in 30 days
          if (creator.lastLoginAt) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (new Date(creator.lastLoginAt) > thirtyDaysAgo) return false;
          }
          break;
        case "with-requests":
          if (!creator._count?.requests || creator._count.requests === 0) return false;
          break;
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const creatorTagIds = creator.tags?.map((t) => t.id) || [];
        const hasMatchingTag = selectedTags.some((tagId) =>
          creatorTagIds.includes(tagId)
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [creators, search, filter, selectedTags]);

  // Selection helpers
  const isAllSelected = filteredCreators.length > 0 &&
    filteredCreators.every((c) => selectedIds.includes(c.id));

  const isSomeSelected = filteredCreators.some((c) => selectedIds.includes(c.id)) && !isAllSelected;

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // Deselect all filtered creators
      const filteredIds = new Set(filteredCreators.map((c) => c.id));
      onSelectionChange(selectedIds.filter((id) => !filteredIds.has(id)));
    } else {
      // Select all filtered creators
      const newIds = new Set([...selectedIds, ...filteredCreators.map((c) => c.id)]);
      onSelectionChange(Array.from(newIds));
    }
  }, [filteredCreators, selectedIds, isAllSelected, onSelectionChange]);

  const toggleCreator = useCallback(
    (creatorId: string) => {
      if (selectedIds.includes(creatorId)) {
        onSelectionChange(selectedIds.filter((id) => id !== creatorId));
      } else {
        onSelectionChange([...selectedIds, creatorId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  // Get selected creators
  const selectedCreators = creators.filter((c) => selectedIds.includes(c.id));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with selection count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Recipients</h3>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedIds.length} selected
            </Badge>
          )}
        </div>
        {selectedIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear all
          </Button>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creators by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as CreatorFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="pending">Pending Invite</SelectItem>
            <SelectItem value="inactive">Inactive (30+ days)</SelectItem>
            <SelectItem value="with-requests">With Requests</SelectItem>
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-muted")}
          >
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tag filters */}
      {showFilters && allTags.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">Filter by Tags</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
                  selectedTags.includes(tag.id)
                    ? "ring-2 ring-primary ring-offset-2"
                    : "hover:opacity-80"
                )}
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                }}
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="h-7 text-xs"
              >
                Clear tags
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Select all checkbox */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            {isAllSelected
              ? `All ${filteredCreators.length} creators selected`
              : isSomeSelected
              ? `${selectedIds.filter((id) => filteredCreators.some((c) => c.id === id)).length} of ${filteredCreators.length} selected`
              : `Select all (${filteredCreators.length})`}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredCreators.length} creator{filteredCreators.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Creator list */}
      <div className="max-h-[400px] overflow-y-auto rounded-lg border divide-y">
        {filteredCreators.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search || filter !== "all" || selectedTags.length > 0
                ? "No creators match your filters"
                : "No creators found"}
            </p>
          </div>
        ) : (
          filteredCreators.map((creator) => (
            <CreatorRow
              key={creator.id}
              creator={creator}
              isSelected={selectedIds.includes(creator.id)}
              onToggle={() => toggleCreator(creator.id)}
            />
          ))
        )}
      </div>

      {/* Selected recipients summary */}
      {selectedCreators.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Selected Recipients ({selectedCreators.length})
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCreators.slice(0, 10).map((creator) => (
              <Badge
                key={creator.id}
                variant="secondary"
                className="gap-1.5 pl-1"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-primary/20">
                    {creator.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[100px] truncate">{creator.name}</span>
                <button
                  onClick={() => toggleCreator(creator.id)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedCreators.length > 10 && (
              <Badge variant="outline">
                +{selectedCreators.length - 10} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual creator row
function CreatorRow({
  creator,
  isSelected,
  onToggle,
}: {
  creator: Creator;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const getStatusIcon = () => {
    switch (creator.inviteStatus) {
      case "ACCEPTED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "EXPIRED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <label
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50",
        isSelected && "bg-primary/5"
      )}
    >
      <Checkbox checked={isSelected} onCheckedChange={onToggle} />
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-sm">
          {creator.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{creator.name}</span>
          {getStatusIcon()}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span className="truncate">{creator.email}</span>
        </div>
      </div>
      {creator.tags && creator.tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1">
          {creator.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: tag.color }}
              title={tag.name}
            />
          ))}
          {creator.tags.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{creator.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </label>
  );
}

export default RecipientPicker;
