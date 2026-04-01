"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  GripVertical,
  Search,
  X,
  UserPlus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { CreatorGroup, GroupMember } from "./group-card";

interface Creator {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  inviteStatus: string;
}

interface GroupEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: CreatorGroup | null;
  onSave: (group: CreatorGroup) => void;
}

// Color presets for group colors
const colorPresets = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

export function GroupEditor({
  open,
  onOpenChange,
  group,
  onSave,
}: GroupEditorProps) {
  const [saving, setSaving] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);

  // Load creators
  useEffect(() => {
    if (open) {
      loadCreators();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || "");
      setColor(group.color || "#6366f1");
      setSelectedMembers(group.members);
    } else {
      setName("");
      setDescription("");
      setColor("#6366f1");
      setSelectedMembers([]);
    }
  }, [group]);

  const loadCreators = async () => {
    setLoadingCreators(true);
    try {
      const response = await fetch("/api/creators");
      if (response.ok) {
        const data = await response.json();
        setAllCreators(data);
      }
    } catch (error) {
      console.error("Failed to load creators:", error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        memberIds: selectedMembers.map((m) => m.id),
      };

      const response = await fetch(
        group ? `/api/creators/groups/${group.id}` : "/api/creators/groups",
        {
          method: group ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save group");
      }

      toast.success(group ? "Group updated successfully" : "Group created successfully");
      onSave(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save group"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCreator = (creator: Creator) => {
    const isSelected = selectedMembers.some((m) => m.id === creator.id);

    if (isSelected) {
      setSelectedMembers(selectedMembers.filter((m) => m.id !== creator.id));
    } else {
      const newMember: GroupMember = {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        avatar: creator.avatar,
        inviteStatus: creator.inviteStatus,
        sortOrder: selectedMembers.length,
      };
      setSelectedMembers([...selectedMembers, newMember]);
    }
  };

  const removeMember = (creatorId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== creatorId));
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newMembers = [...selectedMembers];
    const [draggedItem] = newMembers.splice(draggedIndex, 1);
    newMembers.splice(index, 0, draggedItem);

    // Update sort order
    newMembers.forEach((m, i) => {
      m.sortOrder = i;
    });

    setSelectedMembers(newMembers);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Filter creators based on search
  const filteredCreators = allCreators.filter(
    (creator) =>
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {group ? "Edit Group" : "Create New Group"}
          </DialogTitle>
          <DialogDescription>
            {group
              ? "Update the group details and members"
              : "Create a new group to send requests to multiple creators at once"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Name and description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                placeholder="e.g., VIP Creators, Weekly Content"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description for this group..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={saving}
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Group Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === presetColor
                      ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  disabled={saving}
                />
              ))}
            </div>
          </div>

          {/* Selected members with drag to reorder */}
          <div className="space-y-2">
            <Label>
              Selected Members ({selectedMembers.length})
            </Label>
            {selectedMembers.length > 0 ? (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                {selectedMembers.map((member, index) => (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-2 bg-background rounded-lg border cursor-move transition-all ${
                      draggedIndex === index
                        ? "opacity-50 border-indigo-500"
                        : "border-border hover:border-indigo-200 dark:hover:border-indigo-800"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Avatar
                      size="sm"
                      user={{
                        name: member.name,
                        image: member.avatar,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeMember(member.id)}
                      disabled={saving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Drag to reorder members
                </p>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-lg">
                No members selected. Add creators from the list below.
              </div>
            )}
          </div>

          {/* Creator selection */}
          <div className="space-y-2">
            <Label>Add Creators</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                disabled={saving || loadingCreators}
              />
            </div>

            {loadingCreators ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No creators found matching your search"
                  : "No creators available"}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 p-2 border rounded-lg">
                {filteredCreators.map((creator) => {
                  const isSelected = selectedMembers.some(
                    (m) => m.id === creator.id
                  );
                  return (
                    <button
                      key={creator.id}
                      type="button"
                      onClick={() => toggleCreator(creator)}
                      disabled={saving}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded border-2 flex-shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <Avatar
                        size="sm"
                        user={{
                          name: creator.name,
                          image: creator.avatar,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {creator.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {creator.email}
                        </p>
                      </div>
                      {creator.inviteStatus === "PENDING" && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          Pending
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
