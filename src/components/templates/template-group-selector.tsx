"use client";

import * as React from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  Layers,
  Check,
  Folder,
  Instagram,
  Twitter,
  Youtube,
  Heart,
  Music,
  MessageCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Platform,
  TemplateGroup,
  TemplateGroupWithTemplates,
  TemplateInGroup,
  PLATFORM_CONFIG,
  getAllPlatforms,
} from "@/types/template-groups";

// ============================================
// ICON MAP
// ============================================

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Instagram,
  Twitter,
  Youtube,
  Heart,
  Star: Heart,
  Music,
  MessageCircle,
  Folder,
};

function getPlatformIcon(iconName: string) {
  return PLATFORM_ICONS[iconName] || Folder;
}

// ============================================
// TYPES
// ============================================

interface TemplateGroupSelectorProps {
  value?: string;
  onChange?: (groupId: string | undefined, templateId?: string) => void;
  onTemplateSelect?: (template: TemplateInGroup, group: TemplateGroupWithTemplates) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showTemplates?: boolean;
  mode?: "dropdown" | "modal";
}

interface RecentlyUsed {
  id: string;
  type: "group" | "template";
  groupId?: string;
  name: string;
  platform: Platform;
  usedAt: Date;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TemplateGroupSelector({
  value,
  onChange,
  onTemplateSelect,
  placeholder = "Select template group...",
  disabled = false,
  className,
  showTemplates = true,
  mode = "dropdown",
}: TemplateGroupSelectorProps) {
  // State
  const [open, setOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<TemplateGroupWithTemplates[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "recent" | "favorites">("all");
  const [expandedPlatforms, setExpandedPlatforms] = React.useState<Set<Platform>>(new Set());
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [recentlyUsed, setRecentlyUsed] = React.useState<RecentlyUsed[]>([]);

  // Selected group/template state
  const selectedGroup = React.useMemo(
    () => groups.find((g) => g.id === value),
    [groups, value]
  );

  // Fetch groups on mount
  React.useEffect(() => {
    if (open) {
      fetchGroups();
      loadRecentAndFavorites();
    }
  }, [open]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/template-groups?includeTemplates=true");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentAndFavorites = () => {
    // Load from localStorage
    try {
      const recentData = localStorage.getItem("templateGroupRecent");
      const favoritesData = localStorage.getItem("templateGroupFavorites");

      if (recentData) {
        const parsed = JSON.parse(recentData) as RecentlyUsed[];
        setRecentlyUsed(
          parsed.map((r) => ({ ...r, usedAt: new Date(r.usedAt) })).slice(0, 10)
        );
      }

      if (favoritesData) {
        setFavorites(new Set(JSON.parse(favoritesData)));
      }
    } catch (error) {
      console.error("Failed to load recent/favorites:", error);
    }
  };

  const saveRecent = (item: RecentlyUsed) => {
    const updated = [
      item,
      ...recentlyUsed.filter(
        (r) => !(r.id === item.id && r.type === item.type)
      ),
    ].slice(0, 10);

    setRecentlyUsed(updated);
    localStorage.setItem("templateGroupRecent", JSON.stringify(updated));
  };

  const toggleFavorite = (groupId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        toast.success("Removed from favorites");
      } else {
        next.add(groupId);
        toast.success("Added to favorites");
      }
      localStorage.setItem("templateGroupFavorites", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Filter groups based on search
  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups.filter((group) => {
      const matchesGroup =
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query) ||
        PLATFORM_CONFIG[group.platform].label.toLowerCase().includes(query);

      const matchesTemplate = group.templates.some(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );

      return matchesGroup || matchesTemplate;
    });
  }, [groups, searchQuery]);

  // Group by platform
  const groupsByPlatform = React.useMemo(() => {
    const result: Record<Platform, TemplateGroupWithTemplates[]> = {} as Record<Platform, TemplateGroupWithTemplates[]>;

    getAllPlatforms().forEach((platform) => {
      result[platform] = [];
    });

    filteredGroups.forEach((group) => {
      if (result[group.platform]) {
        result[group.platform].push(group);
      }
    });

    return result;
  }, [filteredGroups]);

  // Favorite groups
  const favoriteGroups = React.useMemo(
    () => groups.filter((g) => favorites.has(g.id)),
    [groups, favorites]
  );

  // Toggle platform expansion
  const togglePlatform = (platform: Platform) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  // Handle group selection
  const handleSelectGroup = (group: TemplateGroupWithTemplates) => {
    onChange?.(group.id);
    saveRecent({
      id: group.id,
      type: "group",
      name: group.name,
      platform: group.platform,
      usedAt: new Date(),
    });
    if (!showTemplates) {
      setOpen(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: TemplateInGroup, group: TemplateGroupWithTemplates) => {
    onTemplateSelect?.(template, group);
    saveRecent({
      id: template.id,
      type: "template",
      groupId: group.id,
      name: template.name,
      platform: group.platform,
      usedAt: new Date(),
    });
    setOpen(false);
  };

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  // Render content
  const renderContent = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups and templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="px-3 pt-2 border-b">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="all" className="flex-1">
              <Layers className="h-4 w-4 mr-1.5" />
              All Groups
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex-1">
              <Clock className="h-4 w-4 mr-1.5" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">
              <Star className="h-4 w-4 mr-1.5" />
              Favorites
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="all" className="m-0 p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No groups found</p>
              </div>
            ) : (
              <PlatformGroupList
                groupsByPlatform={groupsByPlatform}
                expandedPlatforms={expandedPlatforms}
                favorites={favorites}
                selectedGroupId={value}
                showTemplates={showTemplates}
                onTogglePlatform={togglePlatform}
                onSelectGroup={handleSelectGroup}
                onSelectTemplate={handleSelectTemplate}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </TabsContent>

          <TabsContent value="recent" className="m-0 p-2">
            {recentlyUsed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No recent items</p>
              </div>
            ) : (
              <RecentList
                items={recentlyUsed}
                groups={groups}
                onSelectGroup={handleSelectGroup}
                onSelectTemplate={handleSelectTemplate}
              />
            )}
          </TabsContent>

          <TabsContent value="favorites" className="m-0 p-2">
            {favoriteGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No favorite groups</p>
                <p className="text-xs mt-1">Star groups to access them quickly</p>
              </div>
            ) : (
              <FavoritesList
                groups={favoriteGroups}
                showTemplates={showTemplates}
                selectedGroupId={value}
                onSelectGroup={handleSelectGroup}
                onSelectTemplate={handleSelectTemplate}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );

  // Trigger button
  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn("w-full justify-between", className)}
    >
      {selectedGroup ? (
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            const config = PLATFORM_CONFIG[selectedGroup.platform];
            const Icon = getPlatformIcon(config.icon);
            return (
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: selectedGroup.color || config.color }}
              />
            );
          })()}
          <span className="truncate">{selectedGroup.name}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
      <div className="flex items-center gap-1 ml-2">
        {selectedGroup && (
          <span
            role="button"
            className="rounded-sm hover:bg-muted p-0.5"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>
    </Button>
  );

  // Render dropdown or modal
  if (mode === "modal") {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>Select Template Group</DialogTitle>
              <DialogDescription>
                Choose a template group to organize your content request
              </DialogDescription>
            </DialogHeader>
            {renderContent()}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="h-[400px]">{renderContent()}</div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// PLATFORM GROUP LIST
// ============================================

interface PlatformGroupListProps {
  groupsByPlatform: Record<Platform, TemplateGroupWithTemplates[]>;
  expandedPlatforms: Set<Platform>;
  favorites: Set<string>;
  selectedGroupId?: string;
  showTemplates: boolean;
  onTogglePlatform: (platform: Platform) => void;
  onSelectGroup: (group: TemplateGroupWithTemplates) => void;
  onSelectTemplate: (template: TemplateInGroup, group: TemplateGroupWithTemplates) => void;
  onToggleFavorite: (groupId: string) => void;
}

function PlatformGroupList({
  groupsByPlatform,
  expandedPlatforms,
  favorites,
  selectedGroupId,
  showTemplates,
  onTogglePlatform,
  onSelectGroup,
  onSelectTemplate,
  onToggleFavorite,
}: PlatformGroupListProps) {
  return (
    <div className="space-y-1">
      {getAllPlatforms().map((platform) => {
        const platformGroups = groupsByPlatform[platform];
        if (platformGroups.length === 0) return null;

        const config = PLATFORM_CONFIG[platform];
        const Icon = getPlatformIcon(config.icon);
        const isExpanded = expandedPlatforms.has(platform);

        return (
          <div key={platform} className="space-y-0.5">
            {/* Platform Header */}
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              onClick={() => onTogglePlatform(platform)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div
                className="flex h-6 w-6 items-center justify-center rounded"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
              </div>
              <span className="font-medium">{config.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {platformGroups.length}
              </Badge>
            </button>

            {/* Groups */}
            {isExpanded && (
              <div className="ml-6 space-y-0.5">
                {platformGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={group.id === selectedGroupId}
                    isFavorite={favorites.has(group.id)}
                    showTemplates={showTemplates}
                    onSelect={() => onSelectGroup(group)}
                    onSelectTemplate={(t) => onSelectTemplate(t, group)}
                    onToggleFavorite={() => onToggleFavorite(group.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// GROUP ITEM
// ============================================

interface GroupItemProps {
  group: TemplateGroupWithTemplates;
  isSelected: boolean;
  isFavorite: boolean;
  showTemplates: boolean;
  onSelect: () => void;
  onSelectTemplate: (template: TemplateInGroup) => void;
  onToggleFavorite: () => void;
}

function GroupItem({
  group,
  isSelected,
  isFavorite,
  showTemplates,
  onSelect,
  onSelectTemplate,
  onToggleFavorite,
}: GroupItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const config = PLATFORM_CONFIG[group.platform];

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
        )}
      >
        {showTemplates && group.templates.length > 0 ? (
          <button
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-2">
            <span className="truncate">{group.name}</span>
            {group.isDefault && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Default
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate">
              {group.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="text-[10px]">
            {group.templates.length}
          </Badge>
          <button
            className={cn(
              "p-1 rounded hover:bg-muted/80",
              isFavorite && "text-amber-500"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                isFavorite && "fill-current"
              )}
            />
          </button>
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>
      </div>

      {/* Templates */}
      {expanded && showTemplates && (
        <div className="ml-6 space-y-0.5">
          {group.templates.map((template) => (
            <button
              key={template.id}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              onClick={() => onSelectTemplate(template)}
            >
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="truncate flex-1 text-left">{template.name}</span>
              <Badge
                variant={template.isActive ? "default" : "secondary"}
                className={cn(
                  "text-[10px]",
                  template.isActive &&
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {template.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// RECENT LIST
// ============================================

interface RecentListProps {
  items: RecentlyUsed[];
  groups: TemplateGroupWithTemplates[];
  onSelectGroup: (group: TemplateGroupWithTemplates) => void;
  onSelectTemplate: (template: TemplateInGroup, group: TemplateGroupWithTemplates) => void;
}

function RecentList({ items, groups, onSelectGroup, onSelectTemplate }: RecentListProps) {
  return (
    <div className="space-y-1">
      {items.map((item, index) => {
        const group = groups.find(
          (g) => g.id === (item.type === "group" ? item.id : item.groupId)
        );
        if (!group) return null;

        const config = PLATFORM_CONFIG[item.platform];
        const Icon = getPlatformIcon(config.icon);

        if (item.type === "template") {
          const template = group.templates.find((t) => t.id === item.id);
          if (!template) return null;

          return (
            <button
              key={`${item.type}-${item.id}-${index}`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => onSelectTemplate(template, group)}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Layers className="h-4 w-4" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {group.name}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                Template
              </Badge>
            </button>
          );
        }

        return (
          <button
            key={`${item.type}-${item.id}-${index}`}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors"
            onClick={() => onSelectGroup(group)}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {config.label} | {group.templates.length} templates
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              Group
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// FAVORITES LIST
// ============================================

interface FavoritesListProps {
  groups: TemplateGroupWithTemplates[];
  showTemplates: boolean;
  selectedGroupId?: string;
  onSelectGroup: (group: TemplateGroupWithTemplates) => void;
  onSelectTemplate: (template: TemplateInGroup, group: TemplateGroupWithTemplates) => void;
  onToggleFavorite: (groupId: string) => void;
}

function FavoritesList({
  groups,
  showTemplates,
  selectedGroupId,
  onSelectGroup,
  onSelectTemplate,
  onToggleFavorite,
}: FavoritesListProps) {
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <GroupItem
          key={group.id}
          group={group}
          isSelected={group.id === selectedGroupId}
          isFavorite={true}
          showTemplates={showTemplates}
          onSelect={() => onSelectGroup(group)}
          onSelectTemplate={(t) => onSelectTemplate(t, group)}
          onToggleFavorite={() => onToggleFavorite(group.id)}
        />
      ))}
    </div>
  );
}

// ============================================
// COMPACT SELECTOR (for inline use)
// ============================================

interface CompactGroupSelectorProps {
  value?: string;
  onChange?: (groupId: string | undefined) => void;
  className?: string;
}

export function CompactGroupSelector({
  value,
  onChange,
  className,
}: CompactGroupSelectorProps) {
  return (
    <TemplateGroupSelector
      value={value}
      onChange={onChange}
      showTemplates={false}
      mode="dropdown"
      className={cn("h-9", className)}
    />
  );
}

export default TemplateGroupSelector;
