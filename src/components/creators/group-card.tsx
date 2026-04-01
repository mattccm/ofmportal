"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  inviteStatus: string;
  sortOrder: number;
}

export interface CreatorGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

interface GroupCardProps {
  group: CreatorGroup;
  onEdit: (group: CreatorGroup) => void;
  onDelete: (groupId: string) => void;
}

export function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const maxDisplayedAvatars = 5;
  const displayedMembers = group.members.slice(0, maxDisplayedAvatars);
  const remainingCount = group.memberCount - maxDisplayedAvatars;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/creators/groups/${group.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete group");
      }

      toast.success("Group deleted successfully");
      onDelete(group.id);
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete group"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="group card-elevated hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: group.color || "#6366f1",
                }}
              />
              <div className="min-w-0">
                <CardTitle className="text-lg font-semibold truncate">
                  {group.name}
                </CardTitle>
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {group.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(group)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Group
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/requests/new?groupId=${group.id}`}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Request
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Member count badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
            </Badge>
          </div>

          {/* Member avatars */}
          {group.memberCount > 0 ? (
            <div className="pt-1">
              <AvatarGroup>
                {displayedMembers.map((member) => (
                  <Avatar
                    key={member.id}
                    size="sm"
                    user={{
                      name: member.name,
                      image: member.avatar,
                    }}
                  />
                ))}
                {remainingCount > 0 && (
                  <AvatarGroupCount count={remainingCount} size="sm" />
                )}
              </AvatarGroup>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No members in this group
            </p>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(group)}
            >
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              asChild
            >
              <Link href={`/dashboard/requests/new?groupId=${group.id}`}>
                <Send className="mr-2 h-3.5 w-3.5" />
                Send Request
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{group.name}&quot;? This will remove
              the group but will not delete the creators in it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
