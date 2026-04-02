"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Shield,
  Users,
  FileText,
  Upload,
  UserPlus,
  Settings,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Save,
  Loader2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Role,
  Permission,
  PermissionAction,
  PermissionResource,
  PermissionCategory,
  CreatorVisibility,
  DataFieldVisibility,
  TeamMemberVisibility,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  PERMISSION_CATEGORIES,
  permissionsToMatrix,
  matrixToPermissions,
  PermissionMatrix,
} from "@/types/permissions";

// Icon mapping for categories
const CategoryIcons: Record<PermissionCategory, React.ElementType> = {
  creators: Users,
  requests: FileText,
  uploads: Upload,
  team: UserPlus,
  settings: Settings,
  analytics: BarChart2,
};

interface CategoryPermissionEditorProps {
  permissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

// Category-based Permission Editor Component
export function CategoryPermissionEditor({
  permissions,
  onChange,
  disabled = false,
}: CategoryPermissionEditorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<PermissionCategory>>(
    new Set(PERMISSION_CATEGORIES.map(c => c.id))
  );

  // Convert permissions to matrix for easier manipulation
  const permissionMatrix = useMemo(() => permissionsToMatrix(permissions), [permissions]);

  const toggleCategory = (categoryId: PermissionCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Check if a specific permission is enabled
  const hasPermission = useCallback((resource: PermissionResource, action: PermissionAction) => {
    return permissionMatrix[resource]?.[action] ?? false;
  }, [permissionMatrix]);

  // Toggle a specific permission
  const togglePermission = useCallback((resource: PermissionResource, action: PermissionAction) => {
    if (disabled) return;

    const newMatrix = { ...permissionMatrix };
    if (!newMatrix[resource]) {
      newMatrix[resource] = {} as Record<PermissionAction, boolean>;
    }
    newMatrix[resource] = { ...newMatrix[resource] };
    newMatrix[resource][action] = !newMatrix[resource][action];

    onChange(matrixToPermissions(newMatrix));
  }, [permissionMatrix, onChange, disabled]);

  // Toggle all permissions in a category
  const toggleCategoryAll = useCallback((category: typeof PERMISSION_CATEGORIES[0]) => {
    if (disabled) return;

    const newMatrix = { ...permissionMatrix };

    // Check if all are currently enabled
    let allEnabled = true;
    for (const resource of category.resources) {
      for (const actionConfig of category.actions) {
        if (!actionConfig.resourceSpecific || actionConfig.resourceSpecific.includes(resource)) {
          if (!hasPermission(resource, actionConfig.action)) {
            allEnabled = false;
            break;
          }
        }
      }
      if (!allEnabled) break;
    }

    // Toggle all permissions
    for (const resource of category.resources) {
      if (!newMatrix[resource]) {
        newMatrix[resource] = {} as Record<PermissionAction, boolean>;
      }
      newMatrix[resource] = { ...newMatrix[resource] };

      for (const actionConfig of category.actions) {
        if (!actionConfig.resourceSpecific || actionConfig.resourceSpecific.includes(resource)) {
          newMatrix[resource][actionConfig.action] = !allEnabled;
        }
      }
    }

    onChange(matrixToPermissions(newMatrix));
  }, [permissionMatrix, onChange, disabled, hasPermission]);

  // Get count of enabled permissions in a category
  const getCategoryPermissionCount = useCallback((category: typeof PERMISSION_CATEGORIES[0]) => {
    let count = 0;
    let total = 0;

    for (const resource of category.resources) {
      for (const actionConfig of category.actions) {
        if (!actionConfig.resourceSpecific || actionConfig.resourceSpecific.includes(resource)) {
          total++;
          if (hasPermission(resource, actionConfig.action)) {
            count++;
          }
        }
      }
    }

    return { count, total };
  }, [hasPermission]);

  return (
    <div className="space-y-3">
      {PERMISSION_CATEGORIES.map((category) => {
        const Icon = CategoryIcons[category.id];
        const isExpanded = expandedCategories.has(category.id);
        const { count, total } = getCategoryPermissionCount(category);
        const allEnabled = count === total;
        const someEnabled = count > 0 && count < total;

        return (
          <Card key={category.id} className={cn(
            "border transition-colors",
            count > 0 && "border-primary/30 bg-primary/5"
          )}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category.id)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{category.label}</h3>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={count > 0 ? "default" : "secondary"} className="text-xs">
                      {count}/{total}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategoryAll(category);
                      }}
                      disabled={disabled}
                      className="text-xs"
                    >
                      {allEnabled ? "Disable All" : "Enable All"}
                    </Button>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0">
                  <Separator className="mb-4" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {category.actions.map((actionConfig) => {
                      // For resource-specific actions, show them separately
                      const relevantResources = actionConfig.resourceSpecific || category.resources;

                      return relevantResources.map((resource) => {
                        const isEnabled = hasPermission(resource, actionConfig.action);
                        const resourceLabel = PERMISSION_RESOURCES[resource].label;
                        const showResourceLabel = category.resources.length > 1 || actionConfig.resourceSpecific;

                        return (
                          <div
                            key={`${resource}-${actionConfig.action}`}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-all",
                              isEnabled ? "border-primary/30 bg-primary/5" : "border-transparent bg-muted/30",
                              !disabled && "hover:border-primary/20"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {actionConfig.label}
                                  {showResourceLabel && (
                                    <span className="text-muted-foreground font-normal"> ({resourceLabel})</span>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {actionConfig.description}
                              </p>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => togglePermission(resource, actionConfig.action)}
                              disabled={disabled}
                            />
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}

// Creator Visibility Settings Component
interface CreatorVisibilitySettingsProps {
  visibility: CreatorVisibility;
  onChange: (visibility: CreatorVisibility) => void;
  creatorGroups?: Array<{ id: string; name: string }>;
  disabled?: boolean;
}

export function CreatorVisibilitySettings({
  visibility,
  onChange,
  creatorGroups = [],
  disabled = false,
}: CreatorVisibilitySettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Creator Access Level</Label>
        <Select
          value={visibility.type}
          onValueChange={(value: CreatorVisibility["type"]) =>
            onChange({ ...visibility, type: value })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium">All Creators</p>
                  <p className="text-xs text-muted-foreground">
                    Can see all creators in the agency
                  </p>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="assigned">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium">Assigned Only</p>
                  <p className="text-xs text-muted-foreground">
                    Can only see creators assigned to them
                  </p>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="groups">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium">By Groups</p>
                  <p className="text-xs text-muted-foreground">
                    Can see creators in specific groups
                  </p>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visibility.type === "groups" && creatorGroups.length > 0 && (
        <div className="space-y-2">
          <Label>Allowed Groups</Label>
          <div className="grid grid-cols-2 gap-2">
            {creatorGroups.map((group) => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`group-${group.id}`}
                  checked={visibility.groupIds?.includes(group.id)}
                  onCheckedChange={(checked) => {
                    const newGroupIds = checked
                      ? [...(visibility.groupIds || []), group.id]
                      : (visibility.groupIds || []).filter((id) => id !== group.id);
                    onChange({ ...visibility, groupIds: newGroupIds });
                  }}
                  disabled={disabled}
                />
                <Label htmlFor={`group-${group.id}`} className="text-sm">
                  {group.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibility.type === "groups" && creatorGroups.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <Info className="h-4 w-4" />
          <span>No creator groups available. Create groups first to use this option.</span>
        </div>
      )}
    </div>
  );
}

// Data Field Visibility Settings
interface DataFieldVisibilitySettingsProps {
  visibility: DataFieldVisibility;
  onChange: (visibility: DataFieldVisibility) => void;
  disabled?: boolean;
}

// Field permission config: fields with view/edit granularity vs view-only
type CreatorFieldConfig = {
  key: keyof DataFieldVisibility["creatorFields"];
  label: string;
  hasEdit: boolean; // true = has view/edit toggles, false = view only (boolean)
};

const CREATOR_FIELD_CONFIGS: CreatorFieldConfig[] = [
  { key: "name", label: "Name", hasEdit: true },
  { key: "email", label: "Email Address", hasEdit: true },
  { key: "phone", label: "Phone Number", hasEdit: true },
  { key: "avatar", label: "Profile Photo", hasEdit: true },
  { key: "socialLinks", label: "Social Links", hasEdit: true },
  { key: "personalNotes", label: "Personal Notes", hasEdit: true },
  { key: "earnings", label: "Earnings & Revenue", hasEdit: false },
  { key: "contracts", label: "Contracts & Agreements", hasEdit: false },
  { key: "paymentInfo", label: "Payment Information", hasEdit: false },
];

type RequestFieldConfig = {
  key: keyof DataFieldVisibility["requestFields"];
  label: string;
  hasEdit: boolean;
};

const REQUEST_FIELD_CONFIGS: RequestFieldConfig[] = [
  { key: "internalNotes", label: "Internal Notes", hasEdit: true },
  { key: "creatorCompensation", label: "Creator Compensation", hasEdit: false },
];

export function DataFieldVisibilitySettings({
  visibility,
  onChange,
  disabled = false,
}: DataFieldVisibilitySettingsProps) {
  const [expanded, setExpanded] = useState(true);

  // Helper to get field value (handles both boolean and FieldPermission)
  const getFieldValue = (field: any): { view: boolean; edit: boolean } => {
    if (typeof field === "boolean") {
      return { view: field, edit: field };
    }
    return field || { view: false, edit: false };
  };

  // Count visible fields
  const countVisible = () => {
    let count = 0;
    for (const cfg of CREATOR_FIELD_CONFIGS) {
      const val = visibility.creatorFields[cfg.key];
      if (typeof val === "boolean" ? val : val?.view) count++;
    }
    for (const cfg of REQUEST_FIELD_CONFIGS) {
      const val = visibility.requestFields[cfg.key];
      if (typeof val === "boolean" ? val : val?.view) count++;
    }
    return count;
  };

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Data Field Visibility</CardTitle>
              </div>
              <Badge variant="outline">
                {countVisible()} visible
              </Badge>
            </div>
            <CardDescription>Control which fields are visible and editable for this role</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Creator Fields */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Creator Fields
              </Label>
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr,60px,60px] gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <span>Field</span>
                  <span className="text-center">View</span>
                  <span className="text-center">Edit</span>
                </div>
                {CREATOR_FIELD_CONFIGS.map((cfg) => {
                  const fieldVal = getFieldValue(visibility.creatorFields[cfg.key]);
                  return (
                    <div key={cfg.key} className="grid grid-cols-[1fr,60px,60px] gap-2 items-center p-2 rounded-lg bg-muted/30">
                      <Label className="text-sm">{cfg.label}</Label>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={fieldVal.view}
                          onCheckedChange={(checked) => {
                            const newVal = cfg.hasEdit
                              ? { view: !!checked, edit: checked ? fieldVal.edit : false }
                              : !!checked;
                            onChange({
                              ...visibility,
                              creatorFields: {
                                ...visibility.creatorFields,
                                [cfg.key]: newVal,
                              },
                            });
                          }}
                          disabled={disabled}
                        />
                      </div>
                      <div className="flex justify-center">
                        {cfg.hasEdit ? (
                          <Checkbox
                            checked={fieldVal.edit}
                            onCheckedChange={(checked) => {
                              onChange({
                                ...visibility,
                                creatorFields: {
                                  ...visibility.creatorFields,
                                  [cfg.key]: { view: fieldVal.view || !!checked, edit: !!checked },
                                },
                              });
                            }}
                            disabled={disabled || !fieldVal.view}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Request Fields */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Request Fields
              </Label>
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr,60px,60px] gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <span>Field</span>
                  <span className="text-center">View</span>
                  <span className="text-center">Edit</span>
                </div>
                {REQUEST_FIELD_CONFIGS.map((cfg) => {
                  const fieldVal = getFieldValue(visibility.requestFields[cfg.key]);
                  return (
                    <div key={cfg.key} className="grid grid-cols-[1fr,60px,60px] gap-2 items-center p-2 rounded-lg bg-muted/30">
                      <Label className="text-sm">{cfg.label}</Label>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={fieldVal.view}
                          onCheckedChange={(checked) => {
                            const newVal = cfg.hasEdit
                              ? { view: !!checked, edit: checked ? fieldVal.edit : false }
                              : !!checked;
                            onChange({
                              ...visibility,
                              requestFields: {
                                ...visibility.requestFields,
                                [cfg.key]: newVal,
                              },
                            });
                          }}
                          disabled={disabled}
                        />
                      </div>
                      <div className="flex justify-center">
                        {cfg.hasEdit ? (
                          <Checkbox
                            checked={fieldVal.edit}
                            onCheckedChange={(checked) => {
                              onChange({
                                ...visibility,
                                requestFields: {
                                  ...visibility.requestFields,
                                  [cfg.key]: { view: fieldVal.view || !!checked, edit: !!checked },
                                },
                              });
                            }}
                            disabled={disabled || !fieldVal.view}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Team Member Visibility Settings
interface TeamMemberVisibilitySettingsProps {
  visibility: TeamMemberVisibility;
  onChange: (visibility: TeamMemberVisibility) => void;
  disabled?: boolean;
}

export function TeamMemberVisibilitySettings({
  visibility,
  onChange,
  disabled = false,
}: TeamMemberVisibilitySettingsProps) {
  // Ensure memberFieldVisibility exists with defaults
  const memberFields = visibility.memberFieldVisibility || {
    email: true,
    phone: false,
    role: true,
    lastActive: true,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Visibility
        </CardTitle>
        <CardDescription>Control what this role can see about themselves and other team members</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Own Profile Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Own Profile
          </Label>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="see-own-profile" className="cursor-pointer">View Own Profile</Label>
              <p className="text-xs text-muted-foreground">Can view their own profile details</p>
            </div>
            <Switch
              id="see-own-profile"
              checked={visibility.canSeeOwnProfile ?? true}
              onCheckedChange={(checked) =>
                onChange({ ...visibility, canSeeOwnProfile: checked })
              }
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="edit-own-profile" className="cursor-pointer">Edit Own Profile</Label>
              <p className="text-xs text-muted-foreground">Can edit their own profile information</p>
            </div>
            <Switch
              id="edit-own-profile"
              checked={visibility.canEditOwnProfile ?? true}
              onCheckedChange={(checked) =>
                onChange({ ...visibility, canEditOwnProfile: checked })
              }
              disabled={disabled}
            />
          </div>
        </div>

        {/* Other Team Members Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Other Team Members
          </Label>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="see-other-members" className="cursor-pointer">See Team Members</Label>
              <p className="text-xs text-muted-foreground">Can view the team member list</p>
            </div>
            <Switch
              id="see-other-members"
              checked={visibility.canSeeOtherMembers}
              onCheckedChange={(checked) =>
                onChange({ ...visibility, canSeeOtherMembers: checked })
              }
              disabled={disabled}
            />
          </div>

          {visibility.canSeeOtherMembers && (
            <>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <Label htmlFor="see-member-activity" className="cursor-pointer">See Member Activity</Label>
                  <p className="text-xs text-muted-foreground">Can view other members' activity logs</p>
                </div>
                <Switch
                  id="see-member-activity"
                  checked={visibility.canSeeOtherMemberActivity}
                  onCheckedChange={(checked) =>
                    onChange({ ...visibility, canSeeOtherMemberActivity: checked })
                  }
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <Label htmlFor="see-member-earnings" className="cursor-pointer">See Member Earnings</Label>
                  <p className="text-xs text-muted-foreground">Can view team member compensation</p>
                </div>
                <Switch
                  id="see-member-earnings"
                  checked={visibility.canSeeMemberEarnings}
                  onCheckedChange={(checked) =>
                    onChange({ ...visibility, canSeeMemberEarnings: checked })
                  }
                  disabled={disabled}
                />
              </div>

              {/* Member Field Visibility */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">Visible Member Fields</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                    <Checkbox
                      id="member-email"
                      checked={memberFields.email}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...visibility,
                          memberFieldVisibility: { ...memberFields, email: !!checked },
                        })
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor="member-email" className="text-sm cursor-pointer">Email</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                    <Checkbox
                      id="member-phone"
                      checked={memberFields.phone}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...visibility,
                          memberFieldVisibility: { ...memberFields, phone: !!checked },
                        })
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor="member-phone" className="text-sm cursor-pointer">Phone</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                    <Checkbox
                      id="member-role"
                      checked={memberFields.role}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...visibility,
                          memberFieldVisibility: { ...memberFields, role: !!checked },
                        })
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor="member-role" className="text-sm cursor-pointer">Role</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                    <Checkbox
                      id="member-lastActive"
                      checked={memberFields.lastActive}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...visibility,
                          memberFieldVisibility: { ...memberFields, lastActive: !!checked },
                        })
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor="member-lastActive" className="text-sm cursor-pointer">Last Active</Label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Role Preview Summary
interface RolePreviewProps {
  role: Partial<Role>;
}

export function RolePreview({ role }: RolePreviewProps) {
  const permissions = role.permissions || [];

  // Count permissions by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of PERMISSION_CATEGORIES) {
      counts[category.id] = 0;
    }

    for (const permission of permissions) {
      const resourceConfig = PERMISSION_RESOURCES[permission.resource];
      if (resourceConfig) {
        counts[resourceConfig.category] = (counts[resourceConfig.category] || 0) + permission.actions.length;
      }
    }

    return counts;
  }, [permissions]);

  const totalPermissions = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Role Summary
        </CardTitle>
        <CardDescription>
          Overview of permissions for {role.name || "this role"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total count */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Total Permissions</span>
          <Badge variant="secondary">{totalPermissions}</Badge>
        </div>

        {/* Category breakdown */}
        <div className="space-y-2">
          {PERMISSION_CATEGORIES.map((category) => {
            const Icon = CategoryIcons[category.id];
            const count = categoryCounts[category.id] || 0;

            return (
              <div key={category.id} className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{category.label}</span>
                </div>
                <Badge variant={count > 0 ? "default" : "outline"} className="text-xs">
                  {count}
                </Badge>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Creator visibility */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Creator Access
          </Label>
          <Badge variant="outline" className="capitalize">
            {role.creatorVisibility?.type?.replace("_", " ") || "Assigned Only"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Role Editor Dialog
interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Partial<Role> | null;
  onSave: (role: Omit<Role, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  creatorGroups?: Array<{ id: string; name: string }>;
  isNew?: boolean;
}

export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  onSave,
  creatorGroups = [],
  isNew = false,
}: RoleEditorDialogProps) {
  const [editedRole, setEditedRole] = useState<Partial<Role>>({
    name: "",
    description: "",
    permissions: [],
    creatorVisibility: { type: "assigned" },
    dataFieldVisibility: {
      creatorFields: {
        name: { view: true, edit: false },
        email: { view: true, edit: false },
        phone: { view: false, edit: false },
        earnings: false,
        personalNotes: { view: false, edit: false },
        contracts: false,
        paymentInfo: false,
        avatar: { view: true, edit: false },
        socialLinks: { view: true, edit: false },
      },
      requestFields: {
        internalNotes: { view: false, edit: false },
        creatorCompensation: false,
      },
    },
    teamMemberVisibility: {
      canSeeOwnProfile: true,
      canEditOwnProfile: false,
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
      memberFieldVisibility: {
        email: true,
        phone: false,
        role: true,
        lastActive: false,
      },
    },
    isSystem: false,
    color: "#6366f1",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Update state when role prop changes
  useEffect(() => {
    if (role) {
      setEditedRole(role);
    } else {
      setEditedRole({
        name: "",
        description: "",
        permissions: [],
        creatorVisibility: { type: "assigned" },
        dataFieldVisibility: {
          creatorFields: {
            name: { view: true, edit: false },
            email: { view: true, edit: false },
            phone: { view: false, edit: false },
            earnings: false,
            personalNotes: { view: false, edit: false },
            contracts: false,
            paymentInfo: false,
            avatar: { view: true, edit: false },
            socialLinks: { view: true, edit: false },
          },
          requestFields: {
            internalNotes: { view: false, edit: false },
            creatorCompensation: false,
          },
        },
        teamMemberVisibility: {
          canSeeOwnProfile: true,
          canEditOwnProfile: false,
          canSeeOtherMembers: true,
          canSeeOtherMemberActivity: false,
          canSeeMemberEarnings: false,
          memberFieldVisibility: {
            email: true,
            phone: false,
            role: true,
            lastActive: false,
          },
        },
        isSystem: false,
        color: "#6366f1",
      });
    }
    setActiveTab("general");
  }, [role, open]);

  const handleSave = async () => {
    if (!editedRole.name?.trim()) {
      toast.error("Role name is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: editedRole.name!,
        description: editedRole.description,
        permissions: editedRole.permissions!,
        creatorVisibility: editedRole.creatorVisibility!,
        dataFieldVisibility: editedRole.dataFieldVisibility!,
        teamMemberVisibility: editedRole.teamMemberVisibility!,
        isSystem: false,
        color: editedRole.color,
      });
      onOpenChange(false);
      toast.success(isNew ? "Role created successfully" : "Role updated successfully");
    } catch (error: any) {
      console.error("Role save error:", error);
      toast.error(error?.message || "Failed to save role");
    } finally {
      setIsSaving(false);
    }
  };

  // Owner role is fully locked, other system roles can have permissions edited
  const isOwnerRole = editedRole.id === "owner";
  const isSystemRole = editedRole.isSystem;
  // Only disable name/description editing for system roles, but allow permission editing
  const isNameDisabled = isSystemRole;
  // Only owner role is fully locked
  const isFullyDisabled = isOwnerRole;

  // Color presets
  const colorPresets = [
    "#6366f1", // Indigo
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#14b8a6", // Teal
    "#0ea5e9", // Sky
    "#6b7280", // Gray
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isNew ? "Create New Role" : `Edit Role: ${role?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Define permissions and visibility settings for this role"
              : "Modify permissions and visibility settings for this role"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="visibility">Visibility</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 mt-4">
            <TabsContent value="general" className="space-y-4 mt-0">
              {isOwnerRole && (
                <div className="flex items-center gap-2 text-sm text-amber-600 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span>The Owner role cannot be modified for security reasons</span>
                </div>
              )}
              {isSystemRole && !isOwnerRole && (
                <div className="flex items-center gap-2 text-sm text-blue-600 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Info className="h-4 w-4" />
                  <span>This is a system role. You can modify permissions but not the role name.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name *</Label>
                <Input
                  id="role-name"
                  value={editedRole.name || ""}
                  onChange={(e) =>
                    setEditedRole((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Content Reviewer"
                  disabled={isNameDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea
                  id="role-description"
                  value={editedRole.description || ""}
                  onChange={(e) =>
                    setEditedRole((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe what this role is for..."
                  rows={3}
                  disabled={isFullyDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label>Badge Color</Label>
                <div className="flex items-center gap-3 flex-wrap">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all",
                        editedRole.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditedRole((prev) => ({ ...prev, color }))}
                      disabled={isFullyDisabled}
                    />
                  ))}
                  <div className="relative">
                    <div
                      className="w-8 h-8 rounded-lg border-2 border-dashed border-muted-foreground cursor-pointer"
                      style={{ backgroundColor: editedRole.color }}
                    >
                      <input
                        type="color"
                        value={editedRole.color || "#6366f1"}
                        onChange={(e) =>
                          setEditedRole((prev) => ({ ...prev, color: e.target.value }))
                        }
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isFullyDisabled}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <Badge style={{ backgroundColor: editedRole.color, color: "white" }}>
                    {editedRole.name || "Role Name"}
                  </Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="mt-0 pb-6">
              <div className="space-y-2 mb-4">
                <h4 className="font-medium">Permission Categories</h4>
                <p className="text-sm text-muted-foreground">
                  Enable permissions for each category. Expand categories to fine-tune individual actions.
                </p>
              </div>

              <CategoryPermissionEditor
                permissions={editedRole.permissions || []}
                onChange={(permissions) =>
                  setEditedRole((prev) => ({ ...prev, permissions }))
                }
                disabled={isFullyDisabled}
              />
            </TabsContent>

            <TabsContent value="visibility" className="space-y-6 mt-0 pb-6">
              <CreatorVisibilitySettings
                visibility={editedRole.creatorVisibility || { type: "assigned" }}
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, creatorVisibility: visibility }))
                }
                creatorGroups={creatorGroups}
                disabled={isFullyDisabled}
              />

              <DataFieldVisibilitySettings
                visibility={
                  editedRole.dataFieldVisibility || {
                    creatorFields: {
                      name: { view: true, edit: false },
                      email: { view: true, edit: false },
                      phone: { view: false, edit: false },
                      earnings: false,
                      personalNotes: { view: false, edit: false },
                      contracts: false,
                      paymentInfo: false,
                      avatar: { view: true, edit: false },
                      socialLinks: { view: true, edit: false },
                    },
                    requestFields: {
                      internalNotes: { view: false, edit: false },
                      creatorCompensation: false,
                    },
                  }
                }
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, dataFieldVisibility: visibility }))
                }
                disabled={isFullyDisabled}
              />

              <TeamMemberVisibilitySettings
                visibility={
                  editedRole.teamMemberVisibility || {
                    canSeeOwnProfile: true,
                    canEditOwnProfile: false,
                    canSeeOtherMembers: true,
                    canSeeOtherMemberActivity: false,
                    canSeeMemberEarnings: false,
                    memberFieldVisibility: {
                      email: true,
                      phone: false,
                      role: true,
                      lastActive: false,
                    },
                  }
                }
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, teamMemberVisibility: visibility }))
                }
                disabled={isFullyDisabled}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-0 pb-6">
              <RolePreview role={editedRole} />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isFullyDisabled}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {isNew ? "Create Role" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RoleEditorDialog;
