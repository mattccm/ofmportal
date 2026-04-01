"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  UserPlus,
  Loader2,
  Bell,
  Upload,
  MessageSquare,
  Clock,
  RefreshCw,
  Users,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Watcher } from "./watchers-panel";

// ============================================
// TYPES
// ============================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
}

interface NotificationPreferences {
  notifyOnUpload: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  notifyOnDueDate: boolean;
}

interface AddWatcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  existingWatcherIds: string[];
  onWatcherAdded: (watcher: Watcher) => void;
}

// ============================================
// ADD WATCHER DIALOG COMPONENT
// ============================================

export function AddWatcherDialog({
  open,
  onOpenChange,
  requestId,
  existingWatcherIds,
  onWatcherAdded,
}: AddWatcherDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notifyOnUpload: true,
    notifyOnComment: true,
    notifyOnStatus: true,
    notifyOnDueDate: true,
  });

  // Fetch team members on dialog open
  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    } else {
      // Reset state when dialog closes
      setSearchQuery("");
      setSelectedUserId(null);
      setPreferences({
        notifyOnUpload: true,
        notifyOnComment: true,
        notifyOnStatus: true,
        notifyOnDueDate: true,
      });
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    setSearchLoading(true);
    try {
      const response = await fetch("/api/team/members");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Filter team members based on search and exclude existing watchers
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const isNotExistingWatcher = !existingWatcherIds.includes(member.id);
    return matchesSearch && isNotExistingWatcher;
  });

  // Add watcher
  const addWatcher = useCallback(async () => {
    if (!selectedUserId) {
      toast.error("Please select a team member");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/watchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          ...preferences,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add watcher");
      }

      const data = await response.json();
      onWatcherAdded(data.watcher);
      onOpenChange(false);
      toast.success("Watcher added successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add watcher");
    } finally {
      setLoading(false);
    }
  }, [requestId, selectedUserId, preferences, onWatcherAdded, onOpenChange]);

  // Quick add (with default preferences)
  const quickAdd = useCallback(async (userId: string, userName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/watchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          notifyOnUpload: true,
          notifyOnComment: true,
          notifyOnStatus: true,
          notifyOnDueDate: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add watcher");
      }

      const data = await response.json();
      onWatcherAdded(data.watcher);
      toast.success(`${userName} is now watching this request`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add watcher");
    } finally {
      setLoading(false);
    }
  }, [requestId, onWatcherAdded]);

  const selectedMember = teamMembers.find((m) => m.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Watcher
          </DialogTitle>
          <DialogDescription>
            Add a team member to watch this request and receive notifications about changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Team members list */}
          <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
            {searchLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {existingWatcherIds.length === teamMembers.length
                    ? "All team members are already watching"
                    : "No team members found"}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <TeamMemberItem
                  key={member.id}
                  member={member}
                  isSelected={selectedUserId === member.id}
                  onSelect={() => setSelectedUserId(member.id)}
                  onQuickAdd={() => quickAdd(member.id, member.name)}
                  loading={loading}
                />
              ))
            )}
          </div>

          {/* Notification preferences */}
          {selectedUserId && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Notification Preferences
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <NotificationCheckbox
                    id="notifyOnUpload"
                    label="New uploads"
                    icon={<Upload className="h-3.5 w-3.5" />}
                    checked={preferences.notifyOnUpload}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, notifyOnUpload: checked }))
                    }
                  />
                  <NotificationCheckbox
                    id="notifyOnComment"
                    label="Comments"
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    checked={preferences.notifyOnComment}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, notifyOnComment: checked }))
                    }
                  />
                  <NotificationCheckbox
                    id="notifyOnStatus"
                    label="Status changes"
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    checked={preferences.notifyOnStatus}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, notifyOnStatus: checked }))
                    }
                  />
                  <NotificationCheckbox
                    id="notifyOnDueDate"
                    label="Due date"
                    icon={<Clock className="h-3.5 w-3.5" />}
                    checked={preferences.notifyOnDueDate}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, notifyOnDueDate: checked }))
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={addWatcher} disabled={!selectedUserId || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Add {selectedMember?.name ? selectedMember.name.split(" ")[0] : "Watcher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// TEAM MEMBER ITEM COMPONENT
// ============================================

interface TeamMemberItemProps {
  member: TeamMember;
  isSelected: boolean;
  onSelect: () => void;
  onQuickAdd: () => void;
  loading: boolean;
}

function TeamMemberItem({
  member,
  isSelected,
  onSelect,
  onQuickAdd,
  loading,
}: TeamMemberItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted/50 border border-transparent"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={member} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSelected && (
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        {!isSelected && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            disabled={loading}
          >
            Quick add
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// NOTIFICATION CHECKBOX COMPONENT
// ============================================

interface NotificationCheckboxProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function NotificationCheckbox({
  id,
  label,
  icon,
  checked,
  onCheckedChange,
}: NotificationCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? "bg-primary/5 border-primary/30"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-primary"
      />
      <div className="flex items-center gap-1.5 text-sm">
        <span className={checked ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
        <span className={checked ? "text-foreground" : "text-muted-foreground"}>
          {label}
        </span>
      </div>
    </label>
  );
}
