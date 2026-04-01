"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { RemoveConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserCog,
  User,
  Clock,
  ChevronRight,
  Mail,
  Trash2,
  Edit,
  Activity,
  Users,
  AlertCircle,
  Settings,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type CustomRole = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
  avatar: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
  isOnline: boolean;
  customRoleId: string | null;
  customRole: CustomRole | null;
  permissionOverrides: unknown[];
  assignedCreatorIds: unknown[];
  activityLogs: ActivityLog[];
};

type TeamClientProps = {
  initialMembers: TeamMember[];
  customRoles: CustomRole[];
  currentUserRole: string;
  currentUserId: string;
};

// Default role configurations
const defaultRoleConfig: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string; description: string }> = {
  OWNER: {
    icon: ShieldCheck,
    label: "Owner",
    color: "#7c3aed",
    bgColor: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
    description: "Full access, can manage team and billing",
  },
  ADMIN: {
    icon: Shield,
    label: "Admin",
    color: "#2563eb",
    bgColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    description: "Full access except billing",
  },
  MANAGER: {
    icon: UserCog,
    label: "Manager",
    color: "#059669",
    bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    description: "Can manage creators and requests",
  },
  MEMBER: {
    icon: User,
    label: "Member",
    color: "#6b7280",
    bgColor: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
    description: "Can view and comment only",
  },
};

function getRoleBadge(member: TeamMember) {
  // If member has a custom role, use that
  if (member.customRole) {
    return (
      <Badge
        variant="outline"
        className="font-medium"
        style={{
          backgroundColor: `${member.customRole.color}15`,
          borderColor: member.customRole.color || "#6b7280",
          color: member.customRole.color || "#6b7280",
        }}
      >
        <Shield className="h-3 w-3 mr-1" />
        {member.customRole.name}
      </Badge>
    );
  }

  // Otherwise use default role
  const config = defaultRoleConfig[member.role];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.bgColor}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function formatActivityAction(action: string, metadata: Record<string, unknown>): string {
  const actions: Record<string, string> = {
    "request.created": "Created a new content request",
    "request.updated": "Updated a content request",
    "upload.approved": "Approved an upload",
    "upload.rejected": "Rejected an upload",
    "comment.created": "Added a comment",
    "team.member_invited": `Invited ${metadata.invitedEmail || "a new member"}`,
    "team.role_updated": `Updated role for ${metadata.memberName || "a member"}`,
    "team.member_removed": `Removed ${metadata.removedMemberName || "a member"}`,
    "creator.invited": "Invited a new creator",
    "user.permissions_updated": "Updated member permissions",
    "role.created": "Created a new role",
    "role.updated": "Updated a role",
    "role.deleted": "Deleted a role",
  };

  return actions[action] || action.replace(/\./g, " ").replace(/_/g, " ");
}

export default function TeamClient({
  initialMembers,
  customRoles,
  currentUserRole,
  currentUserId,
}: TeamClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "MEMBER", customRoleId: "" });
  const [editRole, setEditRole] = useState<string>("");
  const [editCustomRoleId, setEditCustomRoleId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter members based on search and role
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesRole = roleFilter === "ALL";
    if (!matchesRole) {
      if (roleFilter.startsWith("custom:")) {
        // Custom role filter
        matchesRole = member.customRoleId === roleFilter.replace("custom:", "");
      } else {
        // Default role filter
        matchesRole = member.role === roleFilter && !member.customRoleId;
      }
    }

    return matchesSearch && matchesRole;
  });

  // Handle invite
  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      toast.error("Please fill in name and email");
      return;
    }

    if (!inviteForm.role && !inviteForm.customRoleId) {
      toast.error("Please select a role");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          role: inviteForm.customRoleId ? "MEMBER" : inviteForm.role,
          customRoleId: inviteForm.customRoleId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      toast.success("Invitation sent successfully");
      setInviteDialogOpen(false);
      setInviteForm({ email: "", name: "", role: "MEMBER", customRoleId: "" });

      // Refresh the page to get updated data
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite member");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle role update
  const handleUpdateRole = async () => {
    if (!selectedMember) return;
    if (!editRole && !editCustomRoleId) {
      toast.error("Please select a role");
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the role via the user-permissions endpoint
      const response = await fetch("/api/roles/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedMember.id,
          roleId: editCustomRoleId ? undefined : editRole.toLowerCase(),
          customRoleId: editCustomRoleId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      setEditDialogOpen(false);
      setSelectedMember(null);

      // Refresh to get updated data
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedMember) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/team/${selectedMember.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      toast.success("Member removed successfully");
      setDeleteDialogOpen(false);
      setSelectedMember(null);

      // Update local state
      setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canManageMembers = ["OWNER", "ADMIN"].includes(currentUserRole);
  const canAssignOwner = currentUserRole === "OWNER";

  // Count members by role type
  const roleCounts = {
    default: Object.keys(defaultRoleConfig).reduce((acc, role) => {
      acc[role] = members.filter((m) => m.role === role && !m.customRoleId).length;
      return acc;
    }, {} as Record<string, number>),
    custom: customRoles.reduce((acc, role) => {
      acc[role.id] = members.filter((m) => m.customRoleId === role.id).length;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Manage your team members and their roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageMembers && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/settings/roles")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Roles
              </Button>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="min-h-[44px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your team. They will receive an email with login credentials.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteForm.customRoleId ? `custom:${inviteForm.customRoleId}` : inviteForm.role}
                        onValueChange={(value) => {
                          if (value.startsWith("custom:")) {
                            setInviteForm({
                              ...inviteForm,
                              role: "",
                              customRoleId: value.replace("custom:", ""),
                            });
                          } else {
                            setInviteForm({
                              ...inviteForm,
                              role: value,
                              customRoleId: "",
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Default Roles</SelectLabel>
                            <SelectItem value="ADMIN">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" style={{ color: defaultRoleConfig.ADMIN.color }} />
                                <span>Admin</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="MANAGER">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4" style={{ color: defaultRoleConfig.MANAGER.color }} />
                                <span>Manager</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="MEMBER">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" style={{ color: defaultRoleConfig.MEMBER.color }} />
                                <span>Member</span>
                              </div>
                            </SelectItem>
                          </SelectGroup>
                          {customRoles.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Custom Roles</SelectLabel>
                              {customRoles.map((role) => (
                                <SelectItem key={role.id} value={`custom:${role.id}`}>
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" style={{ color: role.color || "#6b7280" }} />
                                    <span>{role.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {inviteForm.customRoleId
                          ? customRoles.find((r) => r.id === inviteForm.customRoleId)?.description
                          : defaultRoleConfig[inviteForm.role]?.description}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleInvite} disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {Object.entries(defaultRoleConfig).map(([role, config]) => {
          const count = roleCounts.default[role] || 0;
          const Icon = config.icon;
          return (
            <Card
              key={role}
              className={cn(
                "card-elevated cursor-pointer transition-all hover:shadow-md",
                roleFilter === role && "ring-2 ring-primary"
              )}
              onClick={() => setRoleFilter(roleFilter === role ? "ALL" : role)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${config.color}15`, color: config.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Roles Summary */}
      {customRoles.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Custom Roles
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="flex flex-wrap gap-2">
              {customRoles.map((role) => {
                const count = roleCounts.custom[role.id] || 0;
                const isActive = roleFilter === `custom:${role.id}`;
                return (
                  <Badge
                    key={role.id}
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all text-sm py-1.5 px-3",
                      !isActive && "hover:bg-accent"
                    )}
                    style={{
                      backgroundColor: isActive ? role.color || "#6b7280" : `${role.color}15`,
                      borderColor: role.color || "#6b7280",
                      color: isActive ? "white" : role.color || "#6b7280",
                    }}
                    onClick={() => setRoleFilter(isActive ? "ALL" : `custom:${role.id}`)}
                  >
                    {role.name}
                    <span className="ml-1.5 opacity-70">({count})</span>
                  </Badge>
                );
              })}
              <Link href="/dashboard/settings/roles">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-sm py-1.5 px-3"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Role
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectGroup>
              <SelectLabel>Default Roles</SelectLabel>
              <SelectItem value="OWNER">Owners</SelectItem>
              <SelectItem value="ADMIN">Admins</SelectItem>
              <SelectItem value="MANAGER">Managers</SelectItem>
              <SelectItem value="MEMBER">Members</SelectItem>
            </SelectGroup>
            {customRoles.length > 0 && (
              <SelectGroup>
                <SelectLabel>Custom Roles</SelectLabel>
                {customRoles.map((role) => (
                  <SelectItem key={role.id} value={`custom:${role.id}`}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Empty State */}
      {filteredMembers.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Users className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                {searchQuery || roleFilter !== "ALL"
                  ? "No members found"
                  : "No team members yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                {searchQuery || roleFilter !== "ALL"
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by inviting your first team member."}
              </p>
              {canManageMembers && !searchQuery && roleFilter === "ALL" && (
                <Button className="mt-6 min-h-[44px]" onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            <p className="text-sm text-muted-foreground px-1">
              {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
            </p>
            {filteredMembers.map((member) => (
              <Card
                key={member.id}
                className="card-elevated"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar
                      user={{ name: member.name, email: member.email, avatar: member.avatar }}
                      size="lg"
                      showStatus
                      status={member.isOnline ? "online" : "offline"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {member.name}
                            </h3>
                            {member.id === currentUserId && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                        {canManageMembers && member.id !== currentUserId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setActivityDialogOpen(true);
                                }}
                              >
                                <Activity className="mr-2 h-4 w-4" />
                                View Activity
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditRole(member.customRoleId ? "" : member.role);
                                  setEditCustomRoleId(member.customRoleId || "");
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {getRoleBadge(member)}
                        {member.twoFactorEnabled && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                            2FA
                          </Badge>
                        )}
                        {(member.permissionOverrides as unknown[]).length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-xs">
                                  Custom
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Has custom permission overrides</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {member.lastActiveAt
                          ? `Active ${formatDistanceToNow(new Date(member.lastActiveAt), { addSuffix: true })}`
                          : "Never active"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card className="card-elevated hidden md:block">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""} in your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Security</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            user={{ name: member.name, email: member.email, avatar: member.avatar }}
                            showStatus
                            status={member.isOnline ? "online" : "offline"}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.name}</span>
                              {member.id === currentUserId && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(member)}
                          {(member.permissionOverrides as unknown[]).length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="text-xs">
                                    Custom
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Has custom permission overrides</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              member.isOnline ? "bg-emerald-500" : "bg-gray-400"
                            }`}
                          />
                          <span className="text-sm">
                            {member.isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {member.lastActiveAt
                            ? formatDistanceToNow(new Date(member.lastActiveAt), { addSuffix: true })
                            : "Never"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.twoFactorEnabled ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                            2FA Enabled
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManageMembers && member.id !== currentUserId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setActivityDialogOpen(true);
                                }}
                              >
                                <Activity className="mr-2 h-4 w-4" />
                                View Activity
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditRole(member.customRoleId ? "" : member.role);
                                  setEditCustomRoleId(member.customRoleId || "");
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push("/dashboard/settings/roles")}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Manage Permissions
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select
                value={editCustomRoleId ? `custom:${editCustomRoleId}` : editRole}
                onValueChange={(value) => {
                  if (value.startsWith("custom:")) {
                    setEditRole("");
                    setEditCustomRoleId(value.replace("custom:", ""));
                  } else {
                    setEditRole(value);
                    setEditCustomRoleId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Default Roles</SelectLabel>
                    {canAssignOwner && (
                      <SelectItem value="OWNER">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" style={{ color: defaultRoleConfig.OWNER.color }} />
                          <span>Owner</span>
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" style={{ color: defaultRoleConfig.ADMIN.color }} />
                        <span>Admin</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="MANAGER">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" style={{ color: defaultRoleConfig.MANAGER.color }} />
                        <span>Manager</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="MEMBER">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" style={{ color: defaultRoleConfig.MEMBER.color }} />
                        <span>Member</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                  {customRoles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Custom Roles</SelectLabel>
                      {customRoles.map((role) => (
                        <SelectItem key={role.id} value={`custom:${role.id}`}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" style={{ color: role.color || "#6b7280" }} />
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {(editRole || editCustomRoleId) && (
                <p className="text-xs text-muted-foreground">
                  {editCustomRoleId
                    ? customRoles.find((r) => r.id === editCustomRoleId)?.description
                    : defaultRoleConfig[editRole]?.description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleUpdateRole}
              disabled={
                isSubmitting ||
                (!editRole && !editCustomRoleId) ||
                (editRole === selectedMember?.role && !selectedMember?.customRoleId) ||
                (editCustomRoleId === selectedMember?.customRoleId)
              }
            >
              {isSubmitting ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <RemoveConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={selectedMember?.name}
        itemType="team member"
        description={`Are you sure you want to remove ${selectedMember?.name} from the team?`}
        consequences={[
          `Remove ${selectedMember?.email} from your team`,
          "Revoke all access permissions",
          "Terminate any active sessions",
        ]}
        loading={isSubmitting}
        onConfirm={handleDelete}
      />

      {/* Activity Log Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Log</DialogTitle>
            <DialogDescription>
              Recent activity for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {selectedMember?.activityLogs && selectedMember.activityLogs.length > 0 ? (
              <div className="space-y-4">
                {selectedMember.activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
                    <div className="p-2 rounded-lg bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatActivityAction(log.action, log.metadata as Record<string, unknown>)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button for Mobile */}
      {canManageMembers && filteredMembers.length > 0 && (
        <button
          onClick={() => setInviteDialogOpen(true)}
          className="fixed z-40 flex md:hidden items-center justify-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-transform touch-manipulation"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            right: "16px",
          }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
