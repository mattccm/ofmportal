"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Users,
  Loader2,
  ArrowLeft,
  FolderOpen,
} from "lucide-react";
import { GroupCard, type CreatorGroup } from "@/components/creators/group-card";
import { GroupEditor } from "@/components/creators/group-editor";

export default function CreatorGroupsPage() {
  const [groups, setGroups] = useState<CreatorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CreatorGroup | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await fetch("/api/creators/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingGroup(null);
    setEditorOpen(true);
  };

  const handleEdit = (group: CreatorGroup) => {
    setEditingGroup(group);
    setEditorOpen(true);
  };

  const handleDelete = (groupId: string) => {
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleSave = (savedGroup: CreatorGroup) => {
    if (editingGroup) {
      // Update existing group
      setGroups(groups.map((g) => (g.id === savedGroup.id ? savedGroup : g)));
    } else {
      // Add new group
      setGroups([savedGroup, ...groups]);
    }
  };

  // Filter groups based on search
  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total members across all groups
  const totalMembers = groups.reduce((sum, g) => sum + g.memberCount, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/creators">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Creator Groups
            </h1>
            <p className="mt-1 text-sm md:text-base text-muted-foreground">
              Organize creators into groups for bulk requests
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateNew}
          className="w-full sm:w-auto min-h-[44px] bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.length}</p>
                <p className="text-sm text-muted-foreground">Total Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMembers}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {groups.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        /* Empty state */
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/50 dark:to-violet-900/50 flex items-center justify-center mb-4">
                <Users className="h-7 w-7 md:h-8 md:w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                No groups yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                Create groups to organize your creators and send requests to
                multiple creators at once.
              </p>
              <Button
                onClick={handleCreateNew}
                className="mt-6 min-h-[44px] bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Group
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        /* No search results */
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">
                No groups found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No groups match &quot;{searchQuery}&quot;
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Clear Search
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Groups grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Group editor dialog */}
      <GroupEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        group={editingGroup}
        onSave={handleSave}
      />
    </div>
  );
}
