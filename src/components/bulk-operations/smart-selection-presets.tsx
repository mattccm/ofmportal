"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  Flame,
  Calendar,
  CalendarDays,
  Clock,
  Eye,
  Users,
  ChevronDown,
  Sparkles,
  Filter,
  Tag,
  UserCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SmartSelectionPreset,
  type SmartSelectionFilter,
  SMART_SELECTION_PRESETS,
} from "@/lib/bulk-operations";

interface SmartSelectionPresetsProps<T> {
  items: T[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  // Functions to extract data from items
  getItemId: (item: T) => string;
  getItemDueDate?: (item: T) => Date | null;
  getItemPriority?: (item: T) => string;
  getItemStatus?: (item: T) => string;
  getItemCreatorId?: (item: T) => string;
  getItemGroupId?: (item: T) => string;
  getItemLastActivity?: (item: T) => Date | null;
  // Optional: Custom groups for "Select all from group X"
  groups?: { id: string; name: string; color?: string }[];
  // Optional: Custom creators for filtering
  creators?: { id: string; name: string }[];
  className?: string;
}

export function SmartSelectionPresets<T>({
  items,
  selectedIds,
  onSelectionChange,
  getItemId,
  getItemDueDate,
  getItemPriority,
  getItemStatus,
  getItemCreatorId,
  getItemGroupId,
  getItemLastActivity,
  groups = [],
  creators = [],
  className,
}: SmartSelectionPresetsProps<T>) {
  const [showGroupPopover, setShowGroupPopover] = useState(false);
  const [showCreatorPopover, setShowCreatorPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Icon mapping
  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case "AlertTriangle":
        return <AlertTriangle className="h-4 w-4" />;
      case "Flame":
        return <Flame className="h-4 w-4" />;
      case "Calendar":
        return <Calendar className="h-4 w-4" />;
      case "CalendarDays":
        return <CalendarDays className="h-4 w-4" />;
      case "Clock":
        return <Clock className="h-4 w-4" />;
      case "Eye":
        return <Eye className="h-4 w-4" />;
      case "Users":
        return <Users className="h-4 w-4" />;
      default:
        return <Filter className="h-4 w-4" />;
    }
  };

  // Calculate counts for each preset
  const presetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    items.forEach((item) => {
      // Overdue
      if (getItemDueDate) {
        const dueDate = getItemDueDate(item);
        if (dueDate && dueDate < today) {
          counts["all_overdue"] = (counts["all_overdue"] || 0) + 1;
        }
        if (dueDate && dueDate >= today && dueDate <= today) {
          counts["due_today"] = (counts["due_today"] || 0) + 1;
        }
        if (dueDate && dueDate >= today && dueDate <= weekFromNow) {
          counts["due_this_week"] = (counts["due_this_week"] || 0) + 1;
        }
      }

      // High priority
      if (getItemPriority) {
        const priority = getItemPriority(item);
        if (priority === "HIGH" || priority === "URGENT") {
          counts["high_priority"] = (counts["high_priority"] || 0) + 1;
        }
      }

      // No activity
      if (getItemLastActivity) {
        const lastActivity = getItemLastActivity(item);
        if (!lastActivity || lastActivity < sevenDaysAgo) {
          counts["no_activity_7d"] = (counts["no_activity_7d"] || 0) + 1;
        }
      }

      // Pending review
      if (getItemStatus) {
        const status = getItemStatus(item);
        if (status === "PENDING" || status === "UNDER_REVIEW") {
          counts["pending_review"] = (counts["pending_review"] || 0) + 1;
        }
      }
    });

    return counts;
  }, [items, getItemDueDate, getItemPriority, getItemStatus, getItemLastActivity]);

  // Group counts
  const groupCounts = useMemo(() => {
    if (!getItemGroupId) return {};
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const groupId = getItemGroupId(item);
      if (groupId) {
        counts[groupId] = (counts[groupId] || 0) + 1;
      }
    });
    return counts;
  }, [items, getItemGroupId]);

  // Creator counts
  const creatorCounts = useMemo(() => {
    if (!getItemCreatorId) return {};
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const creatorId = getItemCreatorId(item);
      if (creatorId) {
        counts[creatorId] = (counts[creatorId] || 0) + 1;
      }
    });
    return counts;
  }, [items, getItemCreatorId]);

  // Apply a preset filter
  const applyPreset = useCallback((preset: SmartSelectionPreset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const matchingIds = new Set<string>();

    items.forEach((item) => {
      const id = getItemId(item);
      let matches = false;

      switch (preset.filter.type) {
        case "overdue":
          if (getItemDueDate) {
            const dueDate = getItemDueDate(item);
            matches = dueDate !== null && dueDate < today;
          }
          break;

        case "priority":
          if (getItemPriority) {
            const priority = getItemPriority(item);
            const priorities = (preset.filter.params?.priorities as string[]) || ["HIGH", "URGENT"];
            matches = priorities.includes(priority);
          }
          break;

        case "date_range":
          if (getItemDueDate) {
            const dueDate = getItemDueDate(item);
            const daysFromNow = (preset.filter.params?.daysFromNow as number) || 0;
            const rangeEnd = new Date(today.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            matches = dueDate !== null && dueDate >= today && dueDate <= rangeEnd;
          }
          break;

        case "no_activity":
          if (getItemLastActivity) {
            const lastActivity = getItemLastActivity(item);
            const days = (preset.filter.params?.days as number) || 7;
            const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            matches = !lastActivity || lastActivity < cutoff;
          }
          break;

        case "status":
          if (getItemStatus) {
            const status = getItemStatus(item);
            const statuses = (preset.filter.params?.statuses as string[]) || [];
            matches = statuses.includes(status);
          }
          break;
      }

      if (matches) {
        matchingIds.add(id);
      }
    });

    onSelectionChange(matchingIds);
  }, [items, getItemId, getItemDueDate, getItemPriority, getItemStatus, getItemLastActivity, onSelectionChange]);

  // Select all from a specific group
  const selectGroup = useCallback((groupId: string) => {
    if (!getItemGroupId) return;

    const matchingIds = new Set<string>();
    items.forEach((item) => {
      if (getItemGroupId(item) === groupId) {
        matchingIds.add(getItemId(item));
      }
    });

    onSelectionChange(matchingIds);
    setShowGroupPopover(false);
  }, [items, getItemId, getItemGroupId, onSelectionChange]);

  // Select all from a specific creator
  const selectCreator = useCallback((creatorId: string) => {
    if (!getItemCreatorId) return;

    const matchingIds = new Set<string>();
    items.forEach((item) => {
      if (getItemCreatorId(item) === creatorId) {
        matchingIds.add(getItemId(item));
      }
    });

    onSelectionChange(matchingIds);
    setShowCreatorPopover(false);
  }, [items, getItemId, getItemCreatorId, onSelectionChange]);

  // Select all / clear all
  const selectAll = useCallback(() => {
    onSelectionChange(new Set(items.map(getItemId)));
  }, [items, getItemId, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  // Filtered creators for search
  const filteredCreators = useMemo(() => {
    if (!searchQuery.trim()) return creators;
    const search = searchQuery.toLowerCase();
    return creators.filter((c) => c.name.toLowerCase().includes(search));
  }, [creators, searchQuery]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={selectAll}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Select All ({items.length})
        </Button>

        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear Selection ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Smart presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground flex items-center gap-1 mr-2">
          <Sparkles className="h-4 w-4" />
          Quick Select:
        </span>

        {SMART_SELECTION_PRESETS.map((preset) => {
          const count = presetCounts[preset.id] || 0;
          if (count === 0) return null;

          return (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
              className="gap-2"
            >
              {getPresetIcon(preset.icon)}
              {preset.name}
              <Badge variant={preset.badgeVariant || "secondary"} className="ml-1">
                {count}
              </Badge>
            </Button>
          );
        })}

        {/* Group selector */}
        {groups.length > 0 && getItemGroupId && (
          <Popover open={showGroupPopover} onOpenChange={setShowGroupPopover}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Tag className="h-4 w-4" />
                By Group
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1">
                {groups.map((group) => {
                  const count = groupCounts[group.id] || 0;
                  if (count === 0) return null;

                  return (
                    <Button
                      key={group.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => selectGroup(group.id)}
                    >
                      <span className="flex items-center gap-2">
                        {group.color && (
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                        )}
                        {group.name}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Creator selector */}
        {creators.length > 0 && getItemCreatorId && (
          <Popover open={showCreatorPopover} onOpenChange={setShowCreatorPopover}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UserCircle className="h-4 w-4" />
                By Creator
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search creators..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCreators.map((creator) => {
                    const count = creatorCounts[creator.id] || 0;
                    if (count === 0) return null;

                    return (
                      <Button
                        key={creator.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => selectCreator(creator.id)}
                      >
                        <span className="truncate">{creator.name}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </Button>
                    );
                  })}

                  {filteredCreators.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No creators found
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Selection info */}
      {selectedIds.size > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedIds.size} of {items.length} items selected
        </div>
      )}
    </div>
  );
}

// Compact version for use in toolbars
interface CompactSmartSelectionProps<T> {
  items: T[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  getItemId: (item: T) => string;
  getItemDueDate?: (item: T) => Date | null;
  getItemPriority?: (item: T) => string;
  getItemStatus?: (item: T) => string;
  getItemCreatorId?: (item: T) => string;
  creators?: { id: string; name: string }[];
}

export function CompactSmartSelection<T>({
  items,
  selectedIds,
  onSelectionChange,
  getItemId,
  getItemDueDate,
  getItemPriority,
  getItemStatus,
  getItemCreatorId,
  creators = [],
}: CompactSmartSelectionProps<T>) {
  // Calculate quick counts
  const counts = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let overdue = 0;
    let highPriority = 0;

    items.forEach((item) => {
      if (getItemDueDate) {
        const dueDate = getItemDueDate(item);
        if (dueDate && dueDate < today) overdue++;
      }
      if (getItemPriority) {
        const priority = getItemPriority(item);
        if (priority === "HIGH" || priority === "URGENT") highPriority++;
      }
    });

    return { overdue, highPriority };
  }, [items, getItemDueDate, getItemPriority]);

  const selectOverdue = useCallback(() => {
    if (!getItemDueDate) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ids = new Set<string>();
    items.forEach((item) => {
      const dueDate = getItemDueDate(item);
      if (dueDate && dueDate < today) {
        ids.add(getItemId(item));
      }
    });
    onSelectionChange(ids);
  }, [items, getItemId, getItemDueDate, onSelectionChange]);

  const selectHighPriority = useCallback(() => {
    if (!getItemPriority) return;
    const ids = new Set<string>();
    items.forEach((item) => {
      const priority = getItemPriority(item);
      if (priority === "HIGH" || priority === "URGENT") {
        ids.add(getItemId(item));
      }
    });
    onSelectionChange(ids);
  }, [items, getItemId, getItemPriority, onSelectionChange]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Quick Select
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Smart Selection</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onSelectionChange(new Set(items.map(getItemId)))}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Select All
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </DropdownMenuItem>

        {counts.overdue > 0 && (
          <DropdownMenuItem onClick={selectOverdue}>
            <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
            All Overdue
            <Badge variant="destructive" className="ml-auto">{counts.overdue}</Badge>
          </DropdownMenuItem>
        )}

        {counts.highPriority > 0 && (
          <DropdownMenuItem onClick={selectHighPriority}>
            <Flame className="mr-2 h-4 w-4 text-orange-500" />
            High Priority
            <Badge variant="default" className="ml-auto">{counts.highPriority}</Badge>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onSelectionChange(new Set())}>
          Clear Selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SmartSelectionPresets;
