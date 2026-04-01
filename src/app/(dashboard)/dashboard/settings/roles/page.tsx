"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Search,
  MoreHorizontal,
  FileText,
  Upload,
  UserPlus,
  Settings,
  BarChart2,
  Eye,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { RoleEditorDialog } from "@/components/settings/role-editor";
import { TeamMemberPermissionsList } from "@/components/settings/member-permissions";
import {
  Role,
  TeamMember,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLES,
  PERMISSION_RESOURCES,
  PermissionCategory,
} from "@/types/permissions";
import { cn } from "@/lib/utils";

// Icon mapping for categories
const CategoryIcons: Record<PermissionCategory, React.ElementType> = {
  creators: Users,
  requests: FileText,
  uploads: Upload,
  team: UserPlus,
  settings: Settings,
  analytics: BarChart2,
};

// Role card component
function RoleCard({
  role,
  onEdit,
  onDuplicate,
  onDelete,
  memberCount,
}: {
  role: Role;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  memberCount: number;
}) {
  // Count permissions by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of PERMISSION_CATEGORIES) {
      counts[category.id] = 0;
    }

    for (const permission of role.permissions) {
      const resourceConfig = PERMISSION_RESOURCES[permission.resource];
      if (resourceConfig) {
        counts[resourceConfig.category] = (counts[resourceConfig.category] || 0) + permission.actions.length;
      }
    }

    return counts;
  }, [role.permissions]);

  const totalPermissions = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return (
    <Card className={cn(
      "relative group transition-all hover:shadow-md",
      role.isSystem && "border-dashed"
    )}>
      {role.isSystem && (
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs">
            System
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: role.color || "#6b7280" }}
          >
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 pr-12">
            <CardTitle className="text-base truncate">{role.name}</CardTitle>
            <CardDescription className="text-xs line-clamp-2 mt-1">
              {role.description || "No description"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Permission badges */}
        <div className="flex flex-wrap gap-1.5">
          {PERMISSION_CATEGORIES.map((category) => {
            const count = categoryCounts[category.id] || 0;
            if (count === 0) return null;

            const Icon = CategoryIcons[category.id];
            return (
              <TooltipProvider key={category.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="text-xs gap-1 cursor-default"
                    >
                      <Icon className="h-3 w-3" />
                      {count}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {category.label}: {count} permissions
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {totalPermissions === 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No permissions
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {role.creatorVisibility.type.replace("_", " ")}
          </Badge>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
            {role.isSystem ? (
              <>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View
              </>
            ) : (
              <>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {!role.isSystem && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RolesSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [creators, setCreators] = useState<
    Array<{ id: string; name: string; email: string; avatar?: string }>
  >([]);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; description?: string | null }>
  >([]);
  const [creatorGroups, setCreatorGroups] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [rolesRes, membersRes, creatorsRes, groupsRes, templatesRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/team"),
        fetch("/api/creators?limit=1000"),
        fetch("/api/creators/groups"),
        fetch("/api/templates"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        // Transform to TeamMember type
        const transformedMembers: TeamMember[] = (membersData.members || []).map(
          (m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar: m.avatar,
            roleId: m.customRoleId || m.role.toLowerCase(),
            permissionOverrides: m.permissionOverrides,
            assignedCreatorIds: m.assignedCreatorIds,
            activityRestrictions: m.activityRestrictions,
            createdAt: new Date(m.createdAt),
            updatedAt: new Date(m.updatedAt || m.createdAt),
          })
        );
        setMembers(transformedMembers);
      }

      if (creatorsRes.ok) {
        const creatorsData = await creatorsRes.json();
        // Handle paginated response {data: [...]} or legacy {creators: [...]}
        const creatorsList = creatorsData.data || creatorsData.creators || [];
        setCreators(
          creatorsList.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            avatar: c.avatar,
          }))
        );
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setCreatorGroups(
          (groupsData.groups || []).map((g: any) => ({
            id: g.id,
            name: g.name,
          }))
        );
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        // Handle both paginated response and raw array
        const templatesList = Array.isArray(templatesData) ? templatesData : templatesData.data || [];
        setTemplates(
          templatesList.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  // Check permissions
  const canManageRoles =
    session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";

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

  // Filter roles by search
  const filteredRoles = useMemo(() => {
    if (!searchQuery) return allRoles;
    const query = searchQuery.toLowerCase();
    return allRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    );
  }, [allRoles, searchQuery]);

  // Get member count for a role
  const getMemberCount = useCallback(
    (roleId: string) => {
      return members.filter((m) => m.roleId === roleId).length;
    },
    [members]
  );

  // Role handlers
  const handleCreateRole = async (
    roleData: Omit<Role, "id" | "createdAt" | "updatedAt">
  ) => {
    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create role");
    }

    const data = await response.json();
    setRoles((prev) => [...prev, data.role]);
  };

  const handleUpdateRole = async (id: string, updates: Partial<Role>) => {
    const response = await fetch("/api/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update role");
    }

    const data = await response.json();
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data.role } : r))
    );
  };

  const handleDeleteRole = async (id: string) => {
    const response = await fetch(`/api/roles?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete role");
    }

    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDuplicateRole = async (id: string) => {
    try {
      const response = await fetch(`/api/roles/${id}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to duplicate role");
      }

      const data = await response.json();
      setRoles((prev) => [...prev, data.role]);
      toast.success("Role duplicated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to duplicate role");
    }
  };

  // Editor handlers
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsCreating(false);
    setEditorOpen(true);
  };

  const handleNewRole = () => {
    setSelectedRole(null);
    setIsCreating(true);
    setEditorOpen(true);
  };

  const handleSaveRole = async (
    roleData: Omit<Role, "id" | "createdAt" | "updatedAt">
  ) => {
    if (isCreating) {
      await handleCreateRole(roleData);
    } else if (selectedRole) {
      await handleUpdateRole(selectedRole.id, roleData);
    }
  };

  // Delete handlers
  const handleDeleteClick = (role: Role) => {
    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      await handleDeleteRole(roleToDelete.id);
      toast.success("Role deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete role");
    } finally {
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
    }
  };

  // Member handlers
  const handleUpdateMember = async (
    memberId: string,
    updates: Partial<TeamMember>
  ) => {
    const response = await fetch("/api/roles/user-permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: memberId,
        roleId: updates.roleId,
        permissionOverrides: updates.permissionOverrides,
        assignedCreatorIds: updates.assignedCreatorIds,
        activityRestrictions: updates.activityRestrictions,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update member permissions");
    }

    // Refresh members list
    await fetchData();
  };

  // Loading state
  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    router.push("/login");
    return null;
  }

  // Permission denied
  if (!canManageRoles) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              You don't have permission to manage roles and permissions. Please
              contact your administrator if you need access.
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/settings")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground">
            Manage team roles, permissions, and access controls for your agency
          </p>
        </div>
        <Button onClick={handleNewRole}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allRoles.length}</p>
                <p className="text-xs text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allRoles.filter(r => !r.isSystem).length}</p>
                <p className="text-xs text-muted-foreground">Custom Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{creatorGroups.length}</p>
                <p className="text-xs text-muted-foreground">Creator Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Roles Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => handleEditRole(role)}
                onDuplicate={() => handleDuplicateRole(role.id)}
                onDelete={() => handleDeleteClick(role)}
                memberCount={getMemberCount(role.id)}
              />
            ))}
          </div>

          {filteredRoles.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">No roles found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Create your first custom role to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={handleNewRole}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Member Permissions</CardTitle>
              <CardDescription>
                Assign roles, creators, and templates to team members. Configure individual permissions.
                Click on any team member to manage their assignments and permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamMemberPermissionsList
                members={members}
                roles={allRoles}
                creators={creators}
                templates={templates}
                onUpdateMember={handleUpdateMember}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Permission Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                {PERMISSION_CATEGORIES.map((category) => {
                  const Icon = CategoryIcons[category.id];
                  return (
                    <div key={category.id} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span><strong>{category.label}:</strong> {category.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              {getMemberCount(roleToDelete?.id || "") > 0 && (
                <span className="block mt-2 font-medium text-amber-600">
                  Warning: {getMemberCount(roleToDelete?.id || "")} team member(s) are currently assigned to this role.
                  They will need to be reassigned.
                </span>
              )}
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
