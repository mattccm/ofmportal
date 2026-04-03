"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  User,
  Shield,
  Users,
  Clock,
  Globe,
  Plus,
  X,
  Save,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  UserPlus,
  Eye,
  EyeOff,
  FileText,
  Tag,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Role,
  TeamMember,
  Permission,
  PermissionAction,
  PermissionResource,
  PermissionOverride,
  ActivityRestrictions,
  TemplateVisibility,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  DEFAULT_ROLES,
} from "@/types/permissions";

interface TemplateCategory {
  id: string;
  name: string;
  color: string | null;
  templateCount?: number;
}

interface MemberPermissionsProps {
  member: TeamMember;
  roles: Role[];
  creators?: Array<{ id: string; name: string; email: string; avatar?: string }>;
  templates?: Array<{ id: string; name: string; description?: string | null }>;
  categories?: TemplateCategory[];
  onSave: (memberId: string, updates: Partial<TeamMember>) => Promise<void>;
  onClose: () => void;
}

// Permission Override Editor
function PermissionOverrideEditor({
  overrides,
  basePermissions,
  onChange,
}: {
  overrides: PermissionOverride[];
  basePermissions: Permission[];
  onChange: (overrides: PermissionOverride[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<PermissionResource, boolean>>({} as Record<PermissionResource, boolean>);

  // Get all resources
  const resources = Object.keys(PERMISSION_RESOURCES) as PermissionResource[];

  // Check if an action is in base permissions
  const hasBasePermission = (resource: PermissionResource, action: PermissionAction) => {
    const perm = basePermissions.find((p) => p.resource === resource);
    return perm?.actions.includes(action) ?? false;
  };

  // Get override for a specific permission
  const getOverride = (resource: PermissionResource, action: PermissionAction) => {
    for (const override of overrides) {
      if (override.resource === resource && override.actions.includes(action)) {
        return override.type;
      }
    }
    return null;
  };

  // Toggle override
  const toggleOverride = (
    resource: PermissionResource,
    action: PermissionAction,
    type: "grant" | "revoke" | null
  ) => {
    let newOverrides = [...overrides];

    // Remove existing override for this action
    newOverrides = newOverrides.map((o) => {
      if (o.resource === resource) {
        return {
          ...o,
          actions: o.actions.filter((a) => a !== action),
        };
      }
      return o;
    }).filter((o) => o.actions.length > 0);

    // Add new override if not null
    if (type) {
      const existingOverride = newOverrides.find(
        (o) => o.resource === resource && o.type === type
      );
      if (existingOverride) {
        existingOverride.actions.push(action);
      } else {
        newOverrides.push({ resource, actions: [action], type });
      }
    }

    onChange(newOverrides);
  };

  return (
    <div className="space-y-2">
      {resources.map((resource) => {
        const actions = Object.keys(PERMISSION_ACTIONS) as PermissionAction[];
        const hasOverrides = overrides.some((o) => o.resource === resource);
        const isExpanded = expanded[resource] ?? false;

        return (
          <Collapsible
            key={resource}
            open={isExpanded}
            onOpenChange={(open) =>
              setExpanded((prev) => ({ ...prev, [resource]: open }))
            }
          >
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                  hasOverrides && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                )}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">
                    {PERMISSION_RESOURCES[resource].label}
                  </span>
                  {hasOverrides && (
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                      Modified
                    </Badge>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="p-3 pt-2 space-y-2 border-l-2 ml-4 pl-4 mt-1">
                {actions.map((action) => {
                  const hasBase = hasBasePermission(resource, action);
                  const override = getOverride(resource, action);
                  const effectiveState = override
                    ? override === "grant"
                    : hasBase;

                  return (
                    <div
                      key={action}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {PERMISSION_ACTIONS[action].label}
                        </span>
                        {hasBase && !override && (
                          <Badge variant="secondary" className="text-xs">
                            From Role
                          </Badge>
                        )}
                        {override === "grant" && (
                          <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                            Granted
                          </Badge>
                        )}
                        {override === "revoke" && (
                          <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                            Revoked
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={effectiveState ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-7 w-7 p-0",
                                  effectiveState && "bg-green-600 hover:bg-green-700"
                                )}
                                onClick={() => {
                                  if (override === "grant") {
                                    toggleOverride(resource, action, null);
                                  } else if (!hasBase) {
                                    toggleOverride(resource, action, "grant");
                                  } else {
                                    toggleOverride(resource, action, null);
                                  }
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Grant permission</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={!effectiveState ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-7 w-7 p-0",
                                  !effectiveState && "bg-red-600 hover:bg-red-700"
                                )}
                                onClick={() => {
                                  if (override === "revoke") {
                                    toggleOverride(resource, action, null);
                                  } else if (hasBase) {
                                    toggleOverride(resource, action, "revoke");
                                  } else {
                                    toggleOverride(resource, action, null);
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Revoke permission</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Creator Assignment Component
function CreatorAssignment({
  assignedCreatorIds,
  creators,
  onChange,
}: {
  assignedCreatorIds: string[];
  creators: Array<{ id: string; name: string; email: string; avatar?: string }>;
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredCreators = creators.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCreator = (id: string) => {
    if (assignedCreatorIds.includes(id)) {
      onChange(assignedCreatorIds.filter((cid) => cid !== id));
    } else {
      onChange([...assignedCreatorIds, id]);
    }
  };

  const selectAll = () => {
    onChange(filteredCreators.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {assignedCreatorIds.length} of {creators.length} creators assigned
        </span>
      </div>

      <ScrollArea className="h-64 border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredCreators.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No creators found
            </div>
          ) : (
            filteredCreators.map((creator) => {
              const isAssigned = assignedCreatorIds.includes(creator.id);

              return (
                <div
                  key={creator.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    isAssigned
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => toggleCreator(creator.id)}
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() => toggleCreator(creator.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={creator.avatar} />
                    <AvatarFallback>
                      {creator.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{creator.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {creator.email}
                    </p>
                  </div>
                  {isAssigned && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Template Assignment Component
function TemplateAssignment({
  visibility,
  templates,
  onChange,
}: {
  visibility: TemplateVisibility;
  templates: Array<{ id: string; name: string; description?: string | null }>;
  onChange: (visibility: TemplateVisibility) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const selectedIds = visibility.templateIds || [];

  const toggleTemplate = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange({
        ...visibility,
        templateIds: selectedIds.filter((tid) => tid !== id),
      });
    } else {
      onChange({
        ...visibility,
        templateIds: [...selectedIds, id],
      });
    }
  };

  const selectAll = () => {
    onChange({
      ...visibility,
      templateIds: filteredTemplates.map((t) => t.id),
    });
  };

  const clearAll = () => {
    onChange({
      ...visibility,
      templateIds: [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm">Visibility Mode</Label>
        <Select
          value={visibility.type}
          onValueChange={(value: "all" | "include" | "exclude") =>
            onChange({ ...visibility, type: value, templateIds: value === "all" ? undefined : visibility.templateIds })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex flex-col items-start">
                <span>All Templates</span>
                <span className="text-xs text-muted-foreground">Can see all templates</span>
              </div>
            </SelectItem>
            <SelectItem value="include">
              <div className="flex flex-col items-start">
                <span>Include Only</span>
                <span className="text-xs text-muted-foreground">Can only see selected templates</span>
              </div>
            </SelectItem>
            <SelectItem value="exclude">
              <div className="flex flex-col items-start">
                <span>Exclude Selected</span>
                <span className="text-xs text-muted-foreground">Can see all except selected</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visibility.type !== "all" && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {visibility.type === "include" ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            <span>
              {selectedIds.length} template{selectedIds.length !== 1 ? "s" : ""}{" "}
              {visibility.type === "include" ? "included" : "excluded"}
            </span>
          </div>

          <ScrollArea className="h-48 border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredTemplates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No templates found
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected = selectedIds.includes(template.id);

                  return (
                    <div
                      key={template.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        isSelected
                          ? visibility.type === "include"
                            ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                            : "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => toggleTemplate(template.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTemplate(template.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        visibility.type === "include" ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-red-600" />
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {visibility.type === "include" && selectedIds.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span>No templates selected - member won&apos;t see any templates</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Category Assignment Component
function CategoryAssignment({
  allowedCategoryIds,
  categories,
  onChange,
}: {
  allowedCategoryIds: string[];
  categories: TemplateCategory[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCategory = (id: string) => {
    if (allowedCategoryIds.includes(id)) {
      onChange(allowedCategoryIds.filter((cid) => cid !== id));
    } else {
      onChange([...allowedCategoryIds, id]);
    }
  };

  const selectAll = () => {
    onChange(filteredCategories.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {allowedCategoryIds.length === 0
              ? "All categories accessible"
              : `${allowedCategoryIds.length} categor${allowedCategoryIds.length === 1 ? "y" : "ies"} selected`}
          </span>
        </div>
        {allowedCategoryIds.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to grant access to all categories and uncategorized templates
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Clear
        </Button>
      </div>

      <ScrollArea className="h-48 border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredCategories.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No categories found
            </div>
          ) : (
            filteredCategories.map((category) => {
              const isSelected = allowedCategoryIds.includes(category.id);

              return (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${category.color || "#6B7280"}15` }}
                  >
                    <Tag
                      className="h-4 w-4"
                      style={{ color: category.color || "#6B7280" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{category.name}</p>
                    {category.templateCount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {category.templateCount} template{category.templateCount !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {allowedCategoryIds.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Member can only see templates in these categories plus uncategorized templates
          </span>
        </div>
      )}
    </div>
  );
}

// Activity Restrictions Editor
function ActivityRestrictionsEditor({
  restrictions,
  onChange,
}: {
  restrictions?: ActivityRestrictions;
  onChange: (restrictions: ActivityRestrictions | undefined) => void;
}) {
  const [enabled, setEnabled] = useState(!!restrictions);
  const [localRestrictions, setLocalRestrictions] = useState<ActivityRestrictions>(
    restrictions || {
      canBulkEdit: true,
      canExport: true,
      canDelete: true,
    }
  );

  useEffect(() => {
    if (enabled) {
      onChange(localRestrictions);
    } else {
      onChange(undefined);
    }
  }, [enabled, localRestrictions, onChange]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Activity Restrictions</Label>
          <p className="text-xs text-muted-foreground">
            Set time-based or feature restrictions
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {enabled && (
        <div className="space-y-4 pl-4 border-l-2">
          {/* Time-based restrictions */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Allowed Hours
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={localRestrictions.allowedHours?.start?.toString() || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      allowedHours: undefined,
                    }));
                  } else {
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      allowedHours: {
                        start: parseInt(value),
                        end: prev.allowedHours?.end || 17,
                        timezone: prev.allowedHours?.timezone || "UTC",
                      },
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">to</span>
              <Select
                value={localRestrictions.allowedHours?.end?.toString() || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      allowedHours: undefined,
                    }));
                  } else {
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      allowedHours: {
                        start: prev.allowedHours?.start || 9,
                        end: parseInt(value),
                        timezone: prev.allowedHours?.timezone || "UTC",
                      },
                    }));
                  }
                }}
                disabled={!localRestrictions.allowedHours?.start}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day restrictions */}
          <div className="space-y-2">
            <Label className="text-sm">Allowed Days</Label>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((day, index) => {
                const isSelected = localRestrictions.allowedDays?.includes(index);
                return (
                  <Button
                    key={day}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const currentDays = localRestrictions.allowedDays || [
                        0, 1, 2, 3, 4, 5, 6,
                      ];
                      const newDays = isSelected
                        ? currentDays.filter((d) => d !== index)
                        : [...currentDays, index].sort();
                      setLocalRestrictions((prev) => ({
                        ...prev,
                        allowedDays: newDays.length === 7 ? undefined : newDays,
                      }));
                    }}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Feature restrictions */}
          <div className="space-y-3">
            <Label className="text-sm">Feature Restrictions</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="can-bulk-edit" className="text-sm font-normal">
                  Can perform bulk edits
                </Label>
                <Switch
                  id="can-bulk-edit"
                  checked={localRestrictions.canBulkEdit !== false}
                  onCheckedChange={(checked) =>
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      canBulkEdit: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="can-export" className="text-sm font-normal">
                  Can export data
                </Label>
                <Switch
                  id="can-export"
                  checked={localRestrictions.canExport !== false}
                  onCheckedChange={(checked) =>
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      canExport: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="can-delete" className="text-sm font-normal">
                  Can delete items
                </Label>
                <Switch
                  id="can-delete"
                  checked={localRestrictions.canDelete !== false}
                  onCheckedChange={(checked) =>
                    setLocalRestrictions((prev) => ({
                      ...prev,
                      canDelete: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Daily action limit */}
          <div className="space-y-2">
            <Label className="text-sm">Daily Action Limit</Label>
            <Input
              type="number"
              min={0}
              placeholder="No limit"
              value={localRestrictions.maxDailyActions || ""}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                setLocalRestrictions((prev) => ({
                  ...prev,
                  maxDailyActions: value,
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of create/edit/delete actions per day
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Member Permissions Component
export function MemberPermissions({
  member,
  roles,
  creators = [],
  templates = [],
  categories = [],
  onSave,
  onClose,
}: MemberPermissionsProps) {
  const [selectedRoleId, setSelectedRoleId] = useState(member.roleId);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>(
    member.permissionOverrides || []
  );
  const [assignedCreatorIds, setAssignedCreatorIds] = useState<string[]>(
    member.assignedCreatorIds || []
  );
  const [templateVisibility, setTemplateVisibility] = useState<TemplateVisibility>(
    member.templateVisibility || { type: "all" }
  );
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>(
    member.allowedCategoryIds || []
  );
  const [activityRestrictions, setActivityRestrictions] = useState<
    ActivityRestrictions | undefined
  >(member.activityRestrictions);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get all roles (including default ones)
  const allRoles = React.useMemo(() => {
    const defaultRolesWithDates = DEFAULT_ROLES.map((r) => ({
      ...r,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Role[];

    const customRolesFiltered = roles.filter(
      (r) => !DEFAULT_ROLES.some((dr) => dr.id === r.id)
    );

    return [...defaultRolesWithDates, ...customRolesFiltered];
  }, [roles]);

  // Get selected role
  const selectedRole = allRoles.find((r) => r.id === selectedRoleId);

  // Track changes
  useEffect(() => {
    const roleChanged = selectedRoleId !== member.roleId;
    const overridesChanged =
      JSON.stringify(permissionOverrides) !==
      JSON.stringify(member.permissionOverrides || []);
    const creatorsChanged =
      JSON.stringify(assignedCreatorIds.sort()) !==
      JSON.stringify((member.assignedCreatorIds || []).sort());
    const templateVisibilityChanged =
      JSON.stringify(templateVisibility) !==
      JSON.stringify(member.templateVisibility || { type: "all" });
    const categoriesChanged =
      JSON.stringify(allowedCategoryIds.sort()) !==
      JSON.stringify((member.allowedCategoryIds || []).sort());
    const restrictionsChanged =
      JSON.stringify(activityRestrictions) !==
      JSON.stringify(member.activityRestrictions);

    setHasChanges(
      roleChanged || overridesChanged || creatorsChanged || templateVisibilityChanged || categoriesChanged || restrictionsChanged
    );
  }, [
    selectedRoleId,
    permissionOverrides,
    assignedCreatorIds,
    templateVisibility,
    allowedCategoryIds,
    activityRestrictions,
    member,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(member.id, {
        roleId: selectedRoleId,
        permissionOverrides,
        assignedCreatorIds,
        templateVisibility,
        allowedCategoryIds,
        activityRestrictions,
      });
      toast.success("Member permissions updated");
      onClose();
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.avatar || undefined} />
              <AvatarFallback>
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{member.name}</p>
              <p className="text-sm font-normal text-muted-foreground">
                {member.email}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Configure permissions and access settings for this team member
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 -mx-6">
          <ScrollArea className="h-full px-6">
            <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Assigned Role</Label>
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: role.color || "#6b7280" }}
                        />
                        <span>{role.name}</span>
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-xs ml-2">
                            System
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole?.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedRole.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Permission Overrides */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permission Overrides
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Grant or revoke specific permissions beyond the role
                  </p>
                </div>
                {permissionOverrides.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPermissionOverrides([])}
                  >
                    Clear Overrides
                  </Button>
                )}
              </div>

              {selectedRole && (
                <PermissionOverrideEditor
                  overrides={permissionOverrides}
                  basePermissions={selectedRole.permissions}
                  onChange={setPermissionOverrides}
                />
              )}
            </div>

            <Separator />

            {/* Creator Assignment */}
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Creators
                </Label>
                <p className="text-xs text-muted-foreground">
                  Specific creators this member can access
                </p>
              </div>

              {creators.length > 0 ? (
                <CreatorAssignment
                  assignedCreatorIds={assignedCreatorIds}
                  creators={creators}
                  onChange={setAssignedCreatorIds}
                />
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-lg">
                  No creators available
                </div>
              )}
            </div>

            <Separator />

            {/* Template Visibility */}
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Template Visibility
                </Label>
                <p className="text-xs text-muted-foreground">
                  Control which request templates this member can see and use
                </p>
              </div>

              {templates.length > 0 ? (
                <TemplateAssignment
                  visibility={templateVisibility}
                  templates={templates}
                  onChange={setTemplateVisibility}
                />
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-lg">
                  No templates available
                </div>
              )}
            </div>

            <Separator />

            {/* Category Access */}
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Category Access
                </Label>
                <p className="text-xs text-muted-foreground">
                  Restrict access to templates in specific categories
                </p>
              </div>

              {categories.length > 0 ? (
                <CategoryAssignment
                  allowedCategoryIds={allowedCategoryIds}
                  categories={categories}
                  onChange={setAllowedCategoryIds}
                />
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-lg">
                  No categories available. Create categories in Settings to enable category-based access control.
                </div>
              )}
            </div>

            <Separator />

            {/* Activity Restrictions */}
            <ActivityRestrictionsEditor
              restrictions={activityRestrictions}
              onChange={setActivityRestrictions}
            />
          </div>
        </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2 mr-auto">
            {hasChanges && (
              <Badge variant="outline" className="text-amber-600">
                Unsaved changes
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Team Member List with Permission Management
interface TeamMemberListProps {
  members: TeamMember[];
  roles: Role[];
  creators?: Array<{ id: string; name: string; email: string; avatar?: string }>;
  templates?: Array<{ id: string; name: string; description?: string | null }>;
  categories?: TemplateCategory[];
  onUpdateMember: (memberId: string, updates: Partial<TeamMember>) => Promise<void>;
  isLoading?: boolean;
}

export function TeamMemberPermissionsList({
  members,
  roles,
  creators = [],
  templates = [],
  categories = [],
  onUpdateMember,
  isLoading = false,
}: TeamMemberListProps) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState("");

  const allRoles = React.useMemo(() => {
    const defaultRolesWithDates = DEFAULT_ROLES.map((r) => ({
      ...r,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Role[];

    const customRolesFiltered = roles.filter(
      (r) => !DEFAULT_ROLES.some((dr) => dr.id === r.id)
    );

    return [...defaultRolesWithDates, ...customRolesFiltered];
  }, [roles]);

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filteredMembers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No team members found</p>
            </CardContent>
          </Card>
        ) : (
          filteredMembers.map((member) => {
            const memberRole = allRoles.find((r) => r.id === member.roleId);
            const hasOverrides = (member.permissionOverrides || []).length > 0;
            const hasRestrictions = !!member.activityRestrictions;

            return (
              <Card
                key={member.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelectedMember(member)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar || undefined} />
                      <AvatarFallback>
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{member.name}</p>
                        {memberRole && (
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: `${memberRole.color}15`,
                              borderColor: memberRole.color,
                              color: memberRole.color,
                            }}
                          >
                            {memberRole.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasOverrides && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Overrides
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Has custom permission overrides
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {hasRestrictions && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Restricted
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Has activity restrictions
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(member.assignedCreatorIds || []).length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {member.assignedCreatorIds!.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {member.assignedCreatorIds!.length} creators assigned
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {member.templateVisibility && member.templateVisibility.type !== "all" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                {member.templateVisibility.type === "include" ? (
                                  <Eye className="h-3 w-3 mr-1" />
                                ) : (
                                  <EyeOff className="h-3 w-3 mr-1" />
                                )}
                                Templates
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {member.templateVisibility.type === "include"
                                ? `Can only see ${member.templateVisibility.templateIds?.length || 0} templates`
                                : `${member.templateVisibility.templateIds?.length || 0} templates hidden`}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(member.allowedCategoryIds || []).length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {member.allowedCategoryIds!.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Access limited to {member.allowedCategoryIds!.length} categor{member.allowedCategoryIds!.length === 1 ? "y" : "ies"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {selectedMember && (
        <MemberPermissions
          member={selectedMember}
          roles={roles}
          creators={creators}
          templates={templates}
          categories={categories}
          onSave={onUpdateMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

export default MemberPermissions;
