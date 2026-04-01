"use client";

import * as React from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  GripVertical,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Layers,
  Instagram,
  Twitter,
  Youtube,
  Heart,
  Star,
  Music,
  MessageCircle,
  Folder,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  Platform,
  TemplateGroup,
  TemplateGroupWithTemplates,
  TemplateInGroup,
  PLATFORM_CONFIG,
  getPlatformColor,
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
  Star,
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

interface TemplateGroupManagerProps {
  initialGroups?: TemplateGroupWithTemplates[];
  availableTemplates?: TemplateInGroup[];
  onGroupsChange?: (groups: TemplateGroupWithTemplates[]) => void;
}

type ViewMode = "grid" | "list";

// ============================================
// MAIN COMPONENT
// ============================================

export function TemplateGroupManager({
  initialGroups = [],
  availableTemplates = [],
  onGroupsChange,
}: TemplateGroupManagerProps) {
  // State
  const [groups, setGroups] = React.useState<TemplateGroupWithTemplates[]>(initialGroups);
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPlatform, setSelectedPlatform] = React.useState<Platform | "all">("all");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showAssignDialog, setShowAssignDialog] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<TemplateGroupWithTemplates | null>(null);
  const [deletingGroup, setDeletingGroup] = React.useState<TemplateGroupWithTemplates | null>(null);

  // Fetch groups on mount
  React.useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/template-groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      toast.error("Failed to load template groups");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter groups based on search and platform
  const filteredGroups = React.useMemo(() => {
    return groups.filter((group) => {
      const matchesSearch =
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = selectedPlatform === "all" || group.platform === selectedPlatform;
      return matchesSearch && matchesPlatform;
    });
  }, [groups, searchQuery, selectedPlatform]);

  // Group groups by platform for organized display
  const groupsByPlatform = React.useMemo(() => {
    const platformGroups: Record<Platform, TemplateGroupWithTemplates[]> = {} as Record<Platform, TemplateGroupWithTemplates[]>;

    getAllPlatforms().forEach((platform) => {
      platformGroups[platform] = [];
    });

    filteredGroups.forEach((group) => {
      if (platformGroups[group.platform]) {
        platformGroups[group.platform].push(group);
      }
    });

    return platformGroups;
  }, [filteredGroups]);

  // Toggle group expansion
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Handle template selection
  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  // Handle group creation
  const handleCreateGroup = async (data: Partial<TemplateGroup>) => {
    try {
      const response = await fetch("/api/template-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create group");

      const newGroup = await response.json();
      setGroups((prev) => [...prev, { ...newGroup, templates: [] }]);
      onGroupsChange?.([...groups, { ...newGroup, templates: [] }]);
      toast.success("Template group created");
      setShowCreateDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create template group");
    }
  };

  // Handle group update
  const handleUpdateGroup = async (data: Partial<TemplateGroup>) => {
    if (!editingGroup) return;

    try {
      const response = await fetch(`/api/template-groups/${editingGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update group");

      const updatedGroup = await response.json();
      setGroups((prev) =>
        prev.map((g) => (g.id === editingGroup.id ? { ...g, ...updatedGroup } : g))
      );
      onGroupsChange?.(
        groups.map((g) => (g.id === editingGroup.id ? { ...g, ...updatedGroup } : g))
      );
      toast.success("Template group updated");
      setShowEditDialog(false);
      setEditingGroup(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update template group");
    }
  };

  // Handle group deletion
  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;

    try {
      const response = await fetch(`/api/template-groups/${deletingGroup.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete group");

      setGroups((prev) => prev.filter((g) => g.id !== deletingGroup.id));
      onGroupsChange?.(groups.filter((g) => g.id !== deletingGroup.id));
      toast.success("Template group deleted");
      setShowDeleteDialog(false);
      setDeletingGroup(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete template group");
    }
  };

  // Handle duplicate group
  const handleDuplicateGroup = async (group: TemplateGroupWithTemplates) => {
    try {
      const response = await fetch(`/api/template-groups/${group.id}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to duplicate group");

      const duplicatedGroup = await response.json();
      setGroups((prev) => [...prev, duplicatedGroup]);
      onGroupsChange?.([...groups, duplicatedGroup]);
      toast.success("Template group duplicated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate template group");
    }
  };

  // Handle bulk assign templates
  const handleBulkAssign = async (groupId: string) => {
    if (selectedTemplates.size === 0) return;

    try {
      const response = await fetch(`/api/template-groups/${groupId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateIds: Array.from(selectedTemplates) }),
      });

      if (!response.ok) throw new Error("Failed to assign templates");

      await fetchGroups();
      setSelectedTemplates(new Set());
      setShowAssignDialog(false);
      toast.success(`${selectedTemplates.size} templates assigned to group`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign templates to group");
    }
  };

  // Handle remove template from group
  const handleRemoveTemplate = async (groupId: string, templateId: string) => {
    try {
      const response = await fetch(`/api/template-groups/${groupId}/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove template");

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                templateIds: g.templateIds.filter((id) => id !== templateId),
                templates: g.templates.filter((t) => t.id !== templateId),
              }
            : g
        )
      );
      toast.success("Template removed from group");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove template from group");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Template Groups</h2>
          <p className="text-muted-foreground">
            Organize your request templates by platform and category
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Group
          </Button>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Platform Filter */}
          <Select
            value={selectedPlatform}
            onValueChange={(value) => setSelectedPlatform(value as Platform | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {getAllPlatforms().map((platform) => {
                const config = PLATFORM_CONFIG[platform];
                const Icon = getPlatformIcon(config.icon);
                return (
                  <SelectItem key={platform} value={platform}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          {selectedTemplates.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssignDialog(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Assign {selectedTemplates.size} to Group
            </Button>
          )}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Groups Display */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
      ) : viewMode === "grid" ? (
        <GroupGridView
          groupsByPlatform={groupsByPlatform}
          expandedGroups={expandedGroups}
          onToggleExpand={toggleGroupExpanded}
          onEdit={(group) => {
            setEditingGroup(group);
            setShowEditDialog(true);
          }}
          onDelete={(group) => {
            setDeletingGroup(group);
            setShowDeleteDialog(true);
          }}
          onDuplicate={handleDuplicateGroup}
          onRemoveTemplate={handleRemoveTemplate}
        />
      ) : (
        <GroupListView
          groups={filteredGroups}
          expandedGroups={expandedGroups}
          onToggleExpand={toggleGroupExpanded}
          onEdit={(group) => {
            setEditingGroup(group);
            setShowEditDialog(true);
          }}
          onDelete={(group) => {
            setDeletingGroup(group);
            setShowDeleteDialog(true);
          }}
          onDuplicate={handleDuplicateGroup}
          onRemoveTemplate={handleRemoveTemplate}
        />
      )}

      {/* Create Group Dialog */}
      <GroupFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateGroup}
        title="Create Template Group"
        description="Create a new group to organize your templates by platform."
      />

      {/* Edit Group Dialog */}
      <GroupFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleUpdateGroup}
        initialData={editingGroup || undefined}
        title="Edit Template Group"
        description="Update the group details and settings."
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemName={deletingGroup?.name || ""}
        itemType="template group"
        description={
          deletingGroup && deletingGroup.templates.length > 0
            ? `This group contains ${deletingGroup.templates.length} template(s). The templates won't be deleted, only removed from this group.`
            : undefined
        }
        onConfirm={handleDeleteGroup}
      />

      {/* Bulk Assign Dialog */}
      <BulkAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        groups={groups}
        selectedCount={selectedTemplates.size}
        onAssign={handleBulkAssign}
      />
    </div>
  );
}

// ============================================
// GRID VIEW COMPONENT
// ============================================

interface GroupGridViewProps {
  groupsByPlatform: Record<Platform, TemplateGroupWithTemplates[]>;
  expandedGroups: Set<string>;
  onToggleExpand: (groupId: string) => void;
  onEdit: (group: TemplateGroupWithTemplates) => void;
  onDelete: (group: TemplateGroupWithTemplates) => void;
  onDuplicate: (group: TemplateGroupWithTemplates) => void;
  onRemoveTemplate: (groupId: string, templateId: string) => void;
}

function GroupGridView({
  groupsByPlatform,
  expandedGroups,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onRemoveTemplate,
}: GroupGridViewProps) {
  return (
    <div className="space-y-8">
      {getAllPlatforms().map((platform) => {
        const platformGroups = groupsByPlatform[platform];
        if (platformGroups.length === 0) return null;

        const config = PLATFORM_CONFIG[platform];
        const Icon = getPlatformIcon(config.icon);

        return (
          <div key={platform} className="space-y-4">
            {/* Platform Header */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: config.color }}
                />
              </div>
              <div>
                <h3 className="font-semibold">{config.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {platformGroups.length} group{platformGroups.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Groups Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platformGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggleExpand={() => onToggleExpand(group.id)}
                  onEdit={() => onEdit(group)}
                  onDelete={() => onDelete(group)}
                  onDuplicate={() => onDuplicate(group)}
                  onRemoveTemplate={(templateId) => onRemoveTemplate(group.id, templateId)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// LIST VIEW COMPONENT
// ============================================

interface GroupListViewProps {
  groups: TemplateGroupWithTemplates[];
  expandedGroups: Set<string>;
  onToggleExpand: (groupId: string) => void;
  onEdit: (group: TemplateGroupWithTemplates) => void;
  onDelete: (group: TemplateGroupWithTemplates) => void;
  onDuplicate: (group: TemplateGroupWithTemplates) => void;
  onRemoveTemplate: (groupId: string, templateId: string) => void;
}

function GroupListView({
  groups,
  expandedGroups,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onRemoveTemplate,
}: GroupListViewProps) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const config = PLATFORM_CONFIG[group.platform];
        const Icon = getPlatformIcon(config.icon);
        const isExpanded = expandedGroups.has(group.id);

        return (
          <Card key={group.id} className="overflow-hidden">
            {/* Group Row */}
            <div
              className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/50"
              onClick={() => onToggleExpand(group.id)}
            >
              {/* Expand Icon */}
              <div className="flex h-8 w-8 items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Platform Icon */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: config.color }} />
              </div>

              {/* Group Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{group.name}</h4>
                  {group.isDefault && (
                    <Badge variant="secondary" className="shrink-0">
                      Default
                    </Badge>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {group.description}
                  </p>
                )}
              </div>

              {/* Template Count */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                {group.templates.length} template{group.templates.length !== 1 ? "s" : ""}
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(group)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(group)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(group)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Expanded Templates */}
            {isExpanded && group.templates.length > 0 && (
              <div className="border-t bg-muted/30 px-4 py-3">
                <div className="space-y-2">
                  {group.templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 rounded-lg bg-background p-3"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.fieldCount} fields | {template.usageCount} requests
                        </p>
                      </div>
                      <Badge
                        variant={template.isActive ? "default" : "secondary"}
                        className={cn(
                          template.isActive &&
                            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveTemplate(group.id, template.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {isExpanded && group.templates.length === 0 && (
              <div className="border-t bg-muted/30 p-6 text-center">
                <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No templates in this group yet
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// GROUP CARD COMPONENT
// ============================================

interface GroupCardProps {
  group: TemplateGroupWithTemplates;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRemoveTemplate: (templateId: string) => void;
}

function GroupCard({
  group,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onRemoveTemplate,
}: GroupCardProps) {
  const config = PLATFORM_CONFIG[group.platform];
  const Icon = getPlatformIcon(config.icon);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:border-border",
        isExpanded && "ring-2 ring-primary/20"
      )}
    >
      {/* Color Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: group.color || config.color }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: `${group.color || config.color}15` }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: group.color || config.color }}
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{group.name}</CardTitle>
              {group.description && (
                <CardDescription className="truncate">
                  {group.description}
                </CardDescription>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {group.isDefault && (
              <Badge variant="secondary">Default</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Group
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>
              {group.templates.length} template{group.templates.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {config.label}
          </Badge>
        </div>

        {/* Templates Preview */}
        {group.templates.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-0 h-auto py-1 hover:bg-transparent"
              onClick={onToggleExpand}
            >
              <span className="text-xs text-muted-foreground">
                {isExpanded ? "Hide templates" : "Show templates"}
              </span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {isExpanded && (
              <div className="space-y-1.5 pt-2 border-t">
                {group.templates.slice(0, 5).map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                  >
                    <span className="truncate flex-1">{template.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveTemplate(template.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {group.templates.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{group.templates.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {group.templates.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Folder className="mx-auto h-8 w-8 mb-2 opacity-50" />
            No templates yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// GROUP FORM DIALOG
// ============================================

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<TemplateGroup>) => Promise<void>;
  initialData?: Partial<TemplateGroup>;
  title: string;
  description: string;
}

function GroupFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
}: GroupFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState(initialData?.name || "");
  const [groupDescription, setGroupDescription] = React.useState(initialData?.description || "");
  const [platform, setPlatform] = React.useState<Platform>(initialData?.platform || "custom");
  const [color, setColor] = React.useState(initialData?.color || "");
  const [isDefault, setIsDefault] = React.useState(initialData?.isDefault || false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setGroupDescription(initialData?.description || "");
      setPlatform(initialData?.platform || "custom");
      setColor(initialData?.color || "");
      setIsDefault(initialData?.isDefault || false);
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: groupDescription.trim() || undefined,
        platform,
        color: color || undefined,
        isDefault,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedConfig = PLATFORM_CONFIG[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Instagram Feed Posts"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Optional description for this group..."
              rows={2}
            />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAllPlatforms().map((p) => {
                  const config = PLATFORM_CONFIG[p];
                  const Icon = getPlatformIcon(config.icon);
                  return (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: config.color }} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedConfig.description && (
              <p className="text-xs text-muted-foreground">{selectedConfig.description}</p>
            )}
          </div>

          {/* Custom Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Custom Color (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={selectedConfig.color}
                className="flex-1"
              />
              <div
                className="h-10 w-10 rounded-lg border"
                style={{ backgroundColor: color || selectedConfig.color }}
              />
            </div>
          </div>

          {/* Default Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default group for {selectedConfig.label}
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// BULK ASSIGN DIALOG
// ============================================

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TemplateGroupWithTemplates[];
  selectedCount: number;
  onAssign: (groupId: string) => Promise<void>;
}

function BulkAssignDialog({
  open,
  onOpenChange,
  groups,
  selectedCount,
  onAssign,
}: BulkAssignDialogProps) {
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>("");
  const [isAssigning, setIsAssigning] = React.useState(false);

  const handleAssign = async () => {
    if (!selectedGroupId) return;
    setIsAssigning(true);
    try {
      await onAssign(selectedGroupId);
    } finally {
      setIsAssigning(false);
      setSelectedGroupId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign Templates to Group</DialogTitle>
          <DialogDescription>
            Add {selectedCount} selected template{selectedCount !== 1 ? "s" : ""} to a group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Group</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a group..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => {
                  const config = PLATFORM_CONFIG[group.platform];
                  const Icon = getPlatformIcon(config.icon);
                  return (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4"
                          style={{ color: group.color || config.color }}
                        />
                        {group.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedGroupId || isAssigning}
          >
            {isAssigning ? "Assigning..." : "Assign to Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
  onCreateClick: () => void;
}

function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Folder className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">No template groups yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
        Create your first template group to organize your request templates by platform.
      </p>
      <Button className="mt-6" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" />
        Create Your First Group
      </Button>

      {/* Platform Preview */}
      <div className="mt-12 grid grid-cols-4 gap-4">
        {getAllPlatforms().slice(0, 4).map((platform) => {
          const config = PLATFORM_CONFIG[platform];
          const Icon = getPlatformIcon(config.icon);
          return (
            <div
              key={platform}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon className="h-6 w-6" style={{ color: config.color }} />
              </div>
              <span className="text-xs text-muted-foreground">{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TemplateGroupManager;
