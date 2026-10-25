"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  DialogClose,
} from "@/components/ui/dialog";
import { RemoveConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Clock,
  Mail,
  Trash2,
  Edit,
  Activity,
  Users,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StaffInviteRow } from "@/lib/staff-invites";
import { InviteTeammateButton, InviteTeammateDialog, PendingInvites } from "@/components/team/staff-invites";

type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type TeamRole = {
  id: string;
  name: string;
  kind: "owner" | "preset" | "custom";
  color: string | null;
  description: string | null;
  memberCount: number;
  /** The signed-in person may hand this role out */
  grantable: boolean;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
  roleId: string;
  avatar: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
  isOnline: boolean;
  customRoleId: string | null;
  activityLogs: ActivityLog[];
};

type TeamClientProps = {
  initialMembers: TeamMember[];
  roles: TeamRole[];
  initialInvites: StaffInviteRow[];
  currentUserId: string;
  can: { invite: boolean; changeRoles: boolean; remove: boolean; manageRoles: boolean; isOwner: boolean };
};

function RoleBadge({ role }: { role: TeamRole | undefined }) {
  if (!role) return null;
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-tile-hi px-2 text-[12.5px] font-semibold leading-none text-ink">
      <span className="size-2 rounded-full" style={{ backgroundColor: role.color ?? "#a6aab3" }} aria-hidden="true" />
      {role.name}
    </span>
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
    "team.invite_created": `Invited ${metadata.invitedEmail || metadata.invitedName || "a teammate"} by ${metadata.delivery === "email" ? "email" : "link"}`,
    "team.invite_resent": `Emailed the invite to ${metadata.invitedEmail || "a teammate"} again`,
    "team.invite_link_replaced": `Made a new invite link for ${metadata.invitedEmail || metadata.invitedName || "a teammate"}`,
    "team.invite_cancelled": `Cancelled the invite for ${metadata.invitedEmail || metadata.invitedName || "a teammate"}`,
    "team.invite_accepted": "Joined the team from an invite",
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
  roles,
  initialInvites,
  currentUserId,
  can,
}: TeamClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [invites, setInvites] = useState<StaffInviteRow[]>(initialInvites);
  const [editRoleId, setEditRoleId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter members based on search and role
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "ALL" || member.roleId === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Handle role update
  const handleUpdateRole = async () => {
    if (!selectedMember) return;
    if (!editRoleId) {
      toast.error("Choose a role");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/team/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: editRoleId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      toast.success(`${selectedMember.name} is now ${data.role?.name ?? "on the new role"}`);
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

      toast.success("Member removed");
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

  const roleById = new Map(roles.map((r) => [r.id, r]));
  // Someone's role can be changed when you hold "change roles", it isn't you,
  // and you may hand out their current role (an owner's: only another owner)
  const canChangeRoleOf = (m: TeamMember) =>
    can.changeRoles && m.id !== currentUserId && (m.roleId !== "owner" || can.isOwner) && !!roleById.get(m.roleId)?.grantable;
  const canRemoveMember = (m: TeamMember) =>
    can.remove && m.id !== currentUserId && (m.roleId !== "owner" || can.isOwner) && !!roleById.get(m.roleId)?.grantable;
  const roleChoices = roles.filter((r) => r.grantable && (r.kind !== "owner" || can.isOwner));

  const memberMenu = (member: TeamMember, className?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`More actions for ${member.name}`} variant="ghost" size="icon" className={className}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={() => {
            setSelectedMember(member);
            setActivityDialogOpen(true);
          }}
        >
          <Activity className="mr-2 h-4 w-4" />
          View activity
        </DropdownMenuItem>
        {canChangeRoleOf(member) && (
          <DropdownMenuItem
            onClick={() => {
              setSelectedMember(member);
              setEditRoleId(member.roleId);
              setEditDialogOpen(true);
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            Change role
          </DropdownMenuItem>
        )}
        {can.manageRoles && (
          <DropdownMenuItem onClick={() => router.push(`/dashboard/settings/roles/${member.roleId}`)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Open their role
          </DropdownMenuItem>
        )}
        {canRemoveMember(member) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSelectedMember(member);
                setDeleteDialogOpen(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove from team
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const twoFactorOn = members.filter((m) => m.twoFactorEnabled).length;
  const teamLede = `${members.length} ${members.length === 1 ? "person" : "people"} on the team. Two-factor sign-in is on for ${twoFactorOn} of ${members.length}${twoFactorOn < members.length ? "; ask the rest to turn it on in Security settings" : ""}.`;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-[72ch]">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink sm:text-[26px]">Team</h1>
          <p className="mt-1.5 text-[15px] text-ink">{teamLede}</p>
        </div>
        <div className="flex flex-col gap-2 max-sm:[&>*]:h-11 max-sm:[&>*]:w-full sm:flex-row sm:items-center">
          {can.manageRoles && (
            <Button variant="outline" onClick={() => router.push("/dashboard/settings/roles")}>
              <Settings className="mr-2 h-4 w-4" />
              Roles and permissions
            </Button>
          )}
          {can.invite && <InviteTeammateButton onClick={() => setInviteDialogOpen(true)} />}
        </div>
      </div>

      {can.invite && (
        <InviteTeammateDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          roles={roles.filter((r) => r.grantable && r.kind !== "owner")}
          onCreated={(invite) => setInvites((prev) => [invite, ...prev])}
        />
      )}

      {/* Invites not accepted yet: people who can invite */}
      {can.invite && invites.length > 0 && (
        <PendingInvites invites={invites} onChange={setInvites} onInvite={() => setInviteDialogOpen(true)} />
      )}

      {/* Role filter: counts as a segmented control, not stat tiles */}
      <div role="group" aria-label="Show role" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[8px] bg-well p-0.5">
        {[["ALL", "Everyone", members.length] as const, ...roles.filter((r) => members.some((m) => m.roleId === r.id)).map((r) => [r.id, r.name, members.filter((m) => m.roleId === r.id).length] as const)].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={roleFilter === key}
            onClick={() => setRoleFilter(key)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring md:h-8",
              roleFilter === key && "bg-tile-hi text-ink"
            )}
          >
            {label}
            <span className="tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon" aria-hidden="true" />
        <Input
          placeholder="Search by name or email"
          aria-label="Search the team"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
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
              {can.invite && !searchQuery && roleFilter === "ALL" && (
                <Button className="mt-6 min-h-[44px]" onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite teammate
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
                        {member.id !== currentUserId && (
                          memberMenu(member, "h-9 w-9 flex-shrink-0")
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <RoleBadge role={roleById.get(member.roleId)} />
                        {member.twoFactorEnabled && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                            2FA
                          </Badge>
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
                        <RoleBadge role={roleById.get(member.roleId)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              member.isOnline ? "bg-success" : "bg-gray-400"
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
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                            2FA Enabled
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.id !== currentUserId && memberMenu(member, "h-9 w-9")}
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
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Choose the role for {selectedMember?.name}. Their role decides what they can see and change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New role</Label>
              <Select value={editRoleId} onValueChange={setEditRoleId}>
                <SelectTrigger aria-label="New role">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roleChoices.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: r.color ?? "#a6aab3" }} aria-hidden="true" />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editRoleId && <p className="text-[13px] text-ink-2">{roleById.get(editRoleId)?.description}</p>}
              <p className="text-[13px] text-ink-2">
                {can.manageRoles ? "" : "Only roles with no more access than yours are listed. "}The change takes effect straight away.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleUpdateRole}
              disabled={isSubmitting || !editRoleId || editRoleId === selectedMember?.roleId}
            >
              {isSubmitting ? "Changing…" : "Change role"}
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

    </div>
  );
}
