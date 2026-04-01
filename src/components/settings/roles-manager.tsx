"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  FileText,
  Upload,
  Layout,
  BarChart2,
  Settings,
  UserPlus,
  CreditCard,
  Plug,
  History,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Info,
  Save,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Role,
  Permission,
  PermissionAction,
  PermissionResource,
  CreatorVisibility,
  DataFieldVisibility,
  TeamMemberVisibility,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  DEFAULT_ROLES,
  permissionsToMatrix,
  matrixToPermissions,
  PermissionMatrix,
} from "@/types/permissions";

import { TrendingUp } from "lucide-react";

// Icon mapping for resources
const ResourceIcons: Record<PermissionResource, React.ElementType> = {
  creators: Users,
  requests: FileText,
  uploads: Upload,
  templates: Layout,
  reports: BarChart2,
  settings: Settings,
  team: UserPlus,
  billing: CreditCard,
  integrations: Plug,
  audit_log: History,
  analytics: TrendingUp,
};

interface RolesManagerProps {
  roles: Role[];
  onCreateRole: (role: Omit<Role, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateRole: (id: string, updates: Partial<Role>) => Promise<void>;
  onDeleteRole: (id: string) => Promise<void>;
  onDuplicateRole: (id: string) => Promise<void>;
  creatorGroups?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

// Permission Matrix Component
function PermissionMatrixEditor({
  matrix,
  onChange,
  disabled = false,
}: {
  matrix: PermissionMatrix;
  onChange: (matrix: PermissionMatrix) => void;
  disabled?: boolean;
}) {
  const resources = Object.keys(PERMISSION_RESOURCES) as PermissionResource[];
  const actions = Object.keys(PERMISSION_ACTIONS) as PermissionAction[];

  const togglePermission = (resource: PermissionResource, action: PermissionAction) => {
    if (disabled) return;
    const newMatrix = { ...matrix };
    newMatrix[resource] = { ...newMatrix[resource] };
    newMatrix[resource][action] = !newMatrix[resource][action];
    onChange(newMatrix);
  };

  const toggleResourceRow = (resource: PermissionResource) => {
    if (disabled) return;
    const newMatrix = { ...matrix };
    const allEnabled = actions.every((action) => matrix[resource][action]);
    newMatrix[resource] = { ...newMatrix[resource] };
    for (const action of actions) {
      newMatrix[resource][action] = !allEnabled;
    }
    onChange(newMatrix);
  };

  const toggleActionColumn = (action: PermissionAction) => {
    if (disabled) return;
    const newMatrix = { ...matrix };
    const allEnabled = resources.every((resource) => matrix[resource][action]);
    for (const resource of resources) {
      newMatrix[resource] = { ...newMatrix[resource] };
      newMatrix[resource][action] = !allEnabled;
    }
    onChange(newMatrix);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 bg-muted/50 font-medium text-sm border">
              Resource
            </th>
            {actions.map((action) => (
              <th
                key={action}
                className="p-2 bg-muted/50 font-medium text-sm border text-center cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => toggleActionColumn(action)}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{PERMISSION_ACTIONS[action].label}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{PERMISSION_ACTIONS[action].description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click to toggle all
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const Icon = ResourceIcons[resource];
            const allEnabled = actions.every((action) => matrix[resource][action]);
            const someEnabled = actions.some((action) => matrix[resource][action]);

            return (
              <tr key={resource} className="hover:bg-muted/30 transition-colors">
                <td
                  className="p-2 border font-medium text-sm cursor-pointer"
                  onClick={() => toggleResourceRow(resource)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{PERMISSION_RESOURCES[resource].label}</span>
                    {allEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        Full
                      </Badge>
                    )}
                    {!allEnabled && someEnabled && (
                      <Badge variant="outline" className="text-xs">
                        Partial
                      </Badge>
                    )}
                  </div>
                </td>
                {actions.map((action) => (
                  <td key={action} className="p-2 border text-center">
                    <Checkbox
                      checked={matrix[resource][action]}
                      onCheckedChange={() => togglePermission(resource, action)}
                      disabled={disabled}
                      className="mx-auto"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Creator Visibility Settings Component
function CreatorVisibilitySettings({
  visibility,
  onChange,
  creatorGroups = [],
  disabled = false,
}: {
  visibility: CreatorVisibility;
  onChange: (visibility: CreatorVisibility) => void;
  creatorGroups?: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
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
                <div>
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
                <div>
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
                <div>
                  <p className="font-medium">By Groups</p>
                  <p className="text-xs text-muted-foreground">
                    Can see creators in specific groups
                  </p>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="specific">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                <div>
                  <p className="font-medium">Specific Creators</p>
                  <p className="text-xs text-muted-foreground">
                    Can only see manually selected creators
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

// Data Field Visibility Settings Component
function DataFieldVisibilitySettings({
  visibility,
  onChange,
  disabled = false,
}: {
  visibility: DataFieldVisibility;
  onChange: (visibility: DataFieldVisibility) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const creatorFieldLabels: Record<keyof DataFieldVisibility["creatorFields"], string> = {
    email: "Email Address",
    phone: "Phone Number",
    earnings: "Earnings & Revenue",
    personalNotes: "Personal Notes",
    contracts: "Contracts & Agreements",
    paymentInfo: "Payment Information",
  };

  const requestFieldLabels: Record<keyof DataFieldVisibility["requestFields"], string> = {
    internalNotes: "Internal Notes",
    creatorCompensation: "Creator Compensation",
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Data Field Visibility
      </button>

      {expanded && (
        <div className="space-y-6 pl-6">
          {/* Creator Fields */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Creator Fields
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(creatorFieldLabels).map(([field, label]) => (
                <div key={field} className="flex items-center justify-between">
                  <Label htmlFor={`creator-${field}`} className="text-sm">
                    {label}
                  </Label>
                  <Switch
                    id={`creator-${field}`}
                    checked={visibility.creatorFields[field as keyof typeof visibility.creatorFields]}
                    onCheckedChange={(checked) => {
                      onChange({
                        ...visibility,
                        creatorFields: {
                          ...visibility.creatorFields,
                          [field]: checked,
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Request Fields */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Request Fields
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(requestFieldLabels).map(([field, label]) => (
                <div key={field} className="flex items-center justify-between">
                  <Label htmlFor={`request-${field}`} className="text-sm">
                    {label}
                  </Label>
                  <Switch
                    id={`request-${field}`}
                    checked={visibility.requestFields[field as keyof typeof visibility.requestFields]}
                    onCheckedChange={(checked) => {
                      onChange({
                        ...visibility,
                        requestFields: {
                          ...visibility.requestFields,
                          [field]: checked,
                        },
                      });
                    }}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Team Member Visibility Settings Component
function TeamMemberVisibilitySettings({
  visibility,
  onChange,
  disabled = false,
}: {
  visibility: TeamMemberVisibility;
  onChange: (visibility: TeamMemberVisibility) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
        Team Visibility
      </Label>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="see-other-members">See Other Team Members</Label>
            <p className="text-xs text-muted-foreground">
              Can view the team member list
            </p>
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

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="see-member-activity">See Member Activity</Label>
            <p className="text-xs text-muted-foreground">
              Can view other members' activity logs
            </p>
          </div>
          <Switch
            id="see-member-activity"
            checked={visibility.canSeeOtherMemberActivity}
            onCheckedChange={(checked) =>
              onChange({ ...visibility, canSeeOtherMemberActivity: checked })
            }
            disabled={disabled || !visibility.canSeeOtherMembers}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="see-member-earnings">See Member Earnings</Label>
            <p className="text-xs text-muted-foreground">
              Can view team member compensation
            </p>
          </div>
          <Switch
            id="see-member-earnings"
            checked={visibility.canSeeMemberEarnings}
            onCheckedChange={(checked) =>
              onChange({ ...visibility, canSeeMemberEarnings: checked })
            }
            disabled={disabled || !visibility.canSeeOtherMembers}
          />
        </div>
      </div>
    </div>
  );
}

// Role Preview Component
function RolePreview({ role }: { role: Partial<Role> }) {
  const permissions = role.permissions || [];
  const resourceCount = new Set(permissions.map((p) => p.resource)).size;
  const totalActions = permissions.reduce((sum, p) => sum + p.actions.length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Role Preview
        </CardTitle>
        <CardDescription>
          What this role can do
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Resources</p>
            <p className="font-medium">{resourceCount} accessible</p>
          </div>
          <div>
            <p className="text-muted-foreground">Actions</p>
            <p className="font-medium">{totalActions} permitted</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Permissions Summary
          </p>
          <div className="space-y-1">
            {permissions.slice(0, 5).map((p) => (
              <div key={p.resource} className="flex items-center gap-2 text-sm">
                {React.createElement(ResourceIcons[p.resource], {
                  className: "h-3 w-3 text-muted-foreground",
                })}
                <span>{PERMISSION_RESOURCES[p.resource].label}:</span>
                <span className="text-muted-foreground">
                  {p.actions.map((a) => PERMISSION_ACTIONS[a].label).join(", ")}
                </span>
              </div>
            ))}
            {permissions.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{permissions.length - 5} more resources
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Creator Access
          </p>
          <Badge variant="outline">
            {role.creatorVisibility?.type === "all" && "All Creators"}
            {role.creatorVisibility?.type === "assigned" && "Assigned Only"}
            {role.creatorVisibility?.type === "groups" && "By Groups"}
            {role.creatorVisibility?.type === "specific" && "Specific Creators"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Role Editor Dialog
function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  onSave,
  creatorGroups = [],
  isNew = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Partial<Role> | null;
  onSave: (role: Omit<Role, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  creatorGroups?: Array<{ id: string; name: string }>;
  isNew?: boolean;
}) {
  const [editedRole, setEditedRole] = useState<Partial<Role>>({
    name: "",
    description: "",
    permissions: [],
    creatorVisibility: { type: "assigned" },
    dataFieldVisibility: {
      creatorFields: {
        email: true,
        phone: false,
        earnings: false,
        personalNotes: false,
        contracts: false,
        paymentInfo: false,
      },
      requestFields: {
        internalNotes: false,
        creatorCompensation: false,
      },
    },
    teamMemberVisibility: {
      canSeeOtherMembers: true,
      canSeeOtherMemberActivity: false,
      canSeeMemberEarnings: false,
    },
    isSystem: false,
    color: "#6b7280",
  });

  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>(
    permissionsToMatrix([])
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update state when role prop changes
  React.useEffect(() => {
    if (role) {
      setEditedRole(role);
      setPermissionMatrix(permissionsToMatrix(role.permissions || []));
    } else {
      setEditedRole({
        name: "",
        description: "",
        permissions: [],
        creatorVisibility: { type: "assigned" },
        dataFieldVisibility: {
          creatorFields: {
            email: true,
            phone: false,
            earnings: false,
            personalNotes: false,
            contracts: false,
            paymentInfo: false,
          },
          requestFields: {
            internalNotes: false,
            creatorCompensation: false,
          },
        },
        teamMemberVisibility: {
          canSeeOtherMembers: true,
          canSeeOtherMemberActivity: false,
          canSeeMemberEarnings: false,
        },
        isSystem: false,
        color: "#6b7280",
      });
      setPermissionMatrix(permissionsToMatrix([]));
    }
  }, [role, open]);

  const handleMatrixChange = useCallback((matrix: PermissionMatrix) => {
    setPermissionMatrix(matrix);
    setEditedRole((prev) => ({
      ...prev,
      permissions: matrixToPermissions(matrix),
    }));
  }, []);

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
    } catch (error) {
      toast.error("Failed to save role");
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled = editedRole.isSystem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
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

        <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="visibility">Visibility</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <TabsContent value="general" className="space-y-4 mt-4">
              {isDisabled && (
                <div className="flex items-center gap-2 text-sm text-amber-600 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span>System roles cannot be modified</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={editedRole.name || ""}
                  onChange={(e) =>
                    setEditedRole((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Content Manager"
                  disabled={isDisabled}
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
                  disabled={isDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-color">Badge Color</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: editedRole.color }}
                  >
                    <input
                      type="color"
                      value={editedRole.color || "#6b7280"}
                      onChange={(e) =>
                        setEditedRole((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isDisabled}
                    />
                  </div>
                  <Input
                    id="role-color"
                    value={editedRole.color || "#6b7280"}
                    onChange={(e) =>
                      setEditedRole((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="w-32 font-mono"
                    disabled={isDisabled}
                  />
                  <Badge style={{ backgroundColor: editedRole.color, color: "white" }}>
                    {editedRole.name || "Role"}
                  </Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Permission Matrix</h4>
                  <p className="text-sm text-muted-foreground">
                    Click headers to toggle entire rows or columns
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const emptyMatrix = permissionsToMatrix([]);
                      handleMatrixChange(emptyMatrix);
                    }}
                    disabled={isDisabled}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              <PermissionMatrixEditor
                matrix={permissionMatrix}
                onChange={handleMatrixChange}
                disabled={isDisabled}
              />
            </TabsContent>

            <TabsContent value="visibility" className="space-y-6 mt-4">
              <CreatorVisibilitySettings
                visibility={editedRole.creatorVisibility || { type: "assigned" }}
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, creatorVisibility: visibility }))
                }
                creatorGroups={creatorGroups}
                disabled={isDisabled}
              />

              <Separator />

              <DataFieldVisibilitySettings
                visibility={
                  editedRole.dataFieldVisibility || {
                    creatorFields: {
                      email: true,
                      phone: false,
                      earnings: false,
                      personalNotes: false,
                      contracts: false,
                      paymentInfo: false,
                    },
                    requestFields: {
                      internalNotes: false,
                      creatorCompensation: false,
                    },
                  }
                }
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, dataFieldVisibility: visibility }))
                }
                disabled={isDisabled}
              />

              <Separator />

              <TeamMemberVisibilitySettings
                visibility={
                  editedRole.teamMemberVisibility || {
                    canSeeOtherMembers: true,
                    canSeeOtherMemberActivity: false,
                    canSeeMemberEarnings: false,
                  }
                }
                onChange={(visibility) =>
                  setEditedRole((prev) => ({ ...prev, teamMemberVisibility: visibility }))
                }
                disabled={isDisabled}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <RolePreview role={editedRole} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isDisabled}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {isNew ? "Create Role" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Roles Manager Component
export function RolesManager({
  roles,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onDuplicateRole,
  creatorGroups = [],
  isLoading = false,
}: RolesManagerProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // Combine default and custom roles
  const allRoles = useMemo(() => {
    const defaultRolesWithDates = DEFAULT_ROLES.map((r) => ({
      ...r,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Role[];

    // Filter out default roles that might be duplicated
    const customRolesFiltered = roles.filter(
      (r) => !DEFAULT_ROLES.some((dr) => dr.id === r.id)
    );

    return [...defaultRolesWithDates, ...customRolesFiltered];
  }, [roles]);

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsCreating(false);
    setEditorOpen(true);
  };

  const handleCreateRole = () => {
    setSelectedRole(null);
    setIsCreating(true);
    setEditorOpen(true);
  };

  const handleDeleteClick = (role: Role) => {
    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      await onDeleteRole(roleToDelete.id);
      toast.success("Role deleted successfully");
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleSaveRole = async (roleData: Omit<Role, "id" | "createdAt" | "updatedAt">) => {
    if (isCreating) {
      await onCreateRole(roleData);
    } else if (selectedRole) {
      await onUpdateRole(selectedRole.id, roleData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Manage team roles and their access levels
          </p>
        </div>
        <Button onClick={handleCreateRole}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allRoles.map((role) => {
          const permissionCount = role.permissions.reduce(
            (sum, p) => sum + p.actions.length,
            0
          );

          return (
            <Card key={role.id} className="relative">
              {role.isSystem && (
                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 text-xs"
                >
                  System
                </Badge>
              )}

              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: role.color || "#6b7280" }}
                  />
                  {role.name}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {role.description || "No description"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Permissions</span>
                  <Badge variant="outline">{permissionCount} actions</Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Creator Access</span>
                  <Badge variant="outline" className="capitalize">
                    {role.creatorVisibility.type.replace("_", " ")}
                  </Badge>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          {role.isSystem ? "View" : "Edit"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {role.isSystem
                          ? "View system role details"
                          : "Edit role permissions"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {!role.isSystem && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDuplicateRole(role.id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate role</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(role)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete role</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Role Editor Dialog */}
      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={selectedRole}
        onSave={handleSaveRole}
        creatorGroups={creatorGroups}
        isNew={isCreating}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"?
              Team members assigned to this role will need to be reassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RolesManager;
