"use client";

import * as React from "react";
import {
  Search,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { useAccess } from "@/lib/access/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateShelf } from "@/components/templates/template-shelf";
import { NoTemplates } from "@/components/empty-states";

// TYPES

/** A template group. Stored as a TemplateCategory (one group per template). */
export interface TemplateGroupRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
  fieldCount: number;
  fields?: { label: string; spec?: string }[];
  usageCount: number;
  lastUsedAt?: string | null;
  isActive: boolean;
  updatedAt: Date;
}

interface TemplatesClientProps {
  initialTemplates: Template[];
  initialGroups?: TemplateGroupRow[];
  /** Owners and admins make, rename, reorder and delete groups */
  canManageGroups?: boolean;
  /** Opens the new-group form on first render (?newGroup=1) */
  startCreating?: boolean;
}

type SortOption = "name" | "usage" | "updated" | "used";
type FilterOption = "all" | "active" | "inactive";

const UNGROUPED = "__ungrouped";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

// CLIENT COMPONENT

export function TemplatesClient({
  initialTemplates,
  initialGroups = [],
  canManageGroups = false,
  startCreating = false,
}: TemplatesClientProps) {
  const { can } = useAccess();
  const canEdit = can("templates.edit");
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [groups, setGroups] = React.useState(
    [...initialGroups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<FilterOption>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("updated");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  // Group editing
  const [creating, setCreating] = React.useState(startCreating && canManageGroups);
  const [newName, setNewName] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [busyGroup, setBusyGroup] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TemplateGroupRow | null>(null);

  // Dragging a card onto another shelf
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

  // Filter and sort templates
  const filteredTemplates = React.useMemo(() => {
    let result = [...templates];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.category?.name.toLowerCase().includes(query)
      );
    }

    if (filterStatus === "active") {
      result = result.filter((t) => t.isActive);
    } else if (filterStatus === "inactive") {
      result = result.filter((t) => !t.isActive);
    }

    result.sort((a, b) => {
      // Switched-on templates lead every shelf
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "usage":
          comparison = a.usageCount - b.usageCount;
          break;
        case "used":
          comparison = (a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0) - (b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0);
          break;
        case "updated":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [templates, searchQuery, filterStatus, sortBy, sortDirection]);

  const groupIds = React.useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const byGroup = React.useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const t of filteredTemplates) {
      const key = t.categoryId && groupIds.has(t.categoryId) ? t.categoryId : UNGROUPED;
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [filteredTemplates, groupIds]);

  // TEMPLATE HANDLERS

  const handleDuplicate = async (templateId: string) => {
    const response = await fetch(`/api/templates/${templateId}/duplicate`, { method: "POST" });
    if (!response.ok) throw new Error("Failed to duplicate template");
    const newTemplate = await response.json();
    const source = templates.find((t) => t.id === templateId);
    // Keep the copy on the same shelf as its source
    setTemplates((prev) => [
      {
        ...newTemplate,
        categoryId: newTemplate.categoryId ?? source?.categoryId ?? null,
        category: newTemplate.category ?? source?.category ?? null,
        fieldCount: newTemplate.fieldCount ?? source?.fieldCount ?? 0,
        fields: source?.fields,
        usageCount: 0,
        lastUsedAt: null,
      },
      ...prev,
    ]);
  };

  const handleDelete = async (templateId: string) => {
    const response = await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete template");
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const setTemplateGroup = (templateId: string, groupId: string | null) => {
    const group = groupId ? groups.find((g) => g.id === groupId) ?? null : null;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              categoryId: group?.id ?? null,
              category: group ? { id: group.id, name: group.name, color: group.color, icon: group.icon } : null,
            }
          : t
      )
    );
  };

  const moveTemplate = async (templateId: string, groupId: string | null, { undoable = true } = {}) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const from = template.categoryId && groupIds.has(template.categoryId) ? template.categoryId : null;
    if (from === groupId) return;
    const toName = groupId ? groups.find((g) => g.id === groupId)?.name ?? "the group" : "Ungrouped";

    setTemplateGroup(templateId, groupId);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: groupId }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't move the template"));
      toast.success(`${template.name} moved to ${toName}`, {
        action: undoable
          ? { label: "Undo", onClick: () => void moveTemplate(templateId, from, { undoable: false }) }
          : undefined,
      });
    } catch (error) {
      setTemplateGroup(templateId, from);
      toast.error(error instanceof Error ? error.message : "Couldn't move the template. Try again.");
    }
  };

  // GROUP HANDLERS

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusyGroup(true);
    try {
      const res = await fetch("/api/template-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't make the group"));
      const g = await res.json();
      setGroups((prev) => [
        ...prev,
        { id: g.id, name: g.name, description: g.description, color: g.color, icon: g.icon, sortOrder: g.sortOrder },
      ]);
      setNewName("");
      setCreating(false);
      toast.success(`${g.name} added. Drag templates onto it, or use Move to group on a template.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't make the group");
    } finally {
      setBusyGroup(false);
    }
  };

  const renameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = renamingId;
    const name = renameValue.trim();
    const group = groups.find((g) => g.id === id);
    if (!id || !group) return;
    if (!name || name === group.name) {
      setRenamingId(null);
      return;
    }
    setBusyGroup(true);
    try {
      const res = await fetch(`/api/template-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't rename the group"));
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
      setTemplates((prev) =>
        prev.map((t) => (t.categoryId === id && t.category ? { ...t, category: { ...t.category, name } } : t))
      );
      setRenamingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename the group");
    } finally {
      setBusyGroup(false);
    }
  };

  const moveGroup = async (id: string, by: -1 | 1) => {
    const i = groups.findIndex((g) => g.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= groups.length) return;
    const before = groups;
    const next = [...groups];
    [next[i], next[j]] = [next[j], next[i]];
    const renumbered = next.map((g, k) => ({ ...g, sortOrder: k }));
    setGroups(renumbered);
    try {
      const changed = renumbered.filter((g) => before.find((b) => b.id === g.id)?.sortOrder !== g.sortOrder);
      const results = await Promise.all(
        changed.map((g) =>
          fetch(`/api/template-categories/${g.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: g.sortOrder }),
          })
        )
      );
      const bad = results.find((r) => !r.ok);
      if (bad) throw new Error(await readError(bad, "Couldn't save the new order"));
    } catch (error) {
      setGroups(before);
      toast.error(error instanceof Error ? error.message : "Couldn't save the new order");
    }
  };

  const deleteGroup = async () => {
    const group = deleting;
    if (!group) return;
    setBusyGroup(true);
    try {
      const res = await fetch(`/api/template-categories/${group.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't delete the group"));
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setTemplates((prev) =>
        prev.map((t) => (t.categoryId === group.id ? { ...t, categoryId: null, category: null } : t))
      );
      toast.success(`${group.name} deleted. Its templates are now ungrouped.`);
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the group");
    } finally {
      setBusyGroup(false);
    }
  };

  const sortLabels: Record<SortOption, string> = {
    name: "Name",
    usage: "Most used",
    used: "Last used",
    updated: "Last edited",
  };

  const isFiltered = !!searchQuery || filterStatus !== "all";
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  const card = (template: Template) => (
    <TemplateCard
      key={template.id}
      id={template.id}
      name={template.name}
      description={template.description}
      category={template.category}
      fieldCount={template.fieldCount}
      fields={template.fields}
      usageCount={template.usageCount}
      lastUsedAt={template.lastUsedAt}
      isActive={template.isActive}
      updatedAt={template.updatedAt}
      onDuplicate={can("templates.create") ? () => handleDuplicate(template.id) : undefined}
      onDelete={can("templates.delete") ? () => handleDelete(template.id) : undefined}
      groups={groupOptions}
      onMove={canEdit ? (groupId) => void moveTemplate(template.id, groupId) : undefined}
      canEdit={canEdit}
      canSend={can("requests.create")}
    />
  );

  const countLine = (list: Template[]) => {
    const off = list.filter((t) => !t.isActive).length;
    const n = list.length;
    return `${n} ${n === 1 ? "template" : "templates"}${off ? `, ${off} switched off` : ""}`;
  };

  const shelfKeyOf = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    return t?.categoryId && groupIds.has(t.categoryId) ? t.categoryId : UNGROUPED;
  };

  const shelfDrag = (key: string, groupId: string | null) => ({
    draggable: canEdit && groupOptions.length > 0,
    onCardDragStart: (id: string) => setDragId(id),
    onCardDragEnd: () => {
      setDragId(null);
      setDropTarget(null);
    },
    onDragOverShelf: () => {
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeaveShelf: () => setDropTarget((t) => (t === key ? null : t)),
    onDropOnShelf: (id: string) => {
      setDragId(null);
      setDropTarget(null);
      void moveTemplate(id, groupId);
    },
    dropActive: !!dragId && dropTarget === key && shelfKeyOf(dragId) !== key,
  });

  const emptyShelf = (text: string) => (
    <p className="flex min-h-[120px] items-center rounded-[var(--tw-r-tile)] bg-tile-dim px-5 py-6 text-sm text-ink-2">
      {text}
    </p>
  );

  const ungrouped = byGroup.get(UNGROUPED) ?? [];
  const visibleGroups = isFiltered ? groups.filter((g) => (byGroup.get(g.id) ?? []).length > 0) : groups;
  const showUngrouped = ungrouped.length > 0 || (!!dragId && groups.length > 0);

  return (
    <div className="mt-6">
      <div role="search" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Find a template</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
          <Input
            placeholder="Find a template or group"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterOption)}>
            <SelectTrigger className="w-[150px]" aria-label="Show">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">On and off</SelectItem>
              <SelectItem value="active">Switched on</SelectItem>
              <SelectItem value="inactive">Switched off</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Sort: {sortLabels[sortBy]}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(sortLabels) as SortOption[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => setSortBy(k)}>
                  {sortLabels[k]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            aria-label={sortDirection === "asc" ? "Reverse the order (now low to high)" : "Reverse the order (now high to low)"}
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
          </Button>
          {canManageGroups && !creating && (
            <Button variant="outline" onClick={() => setCreating(true)}>
              <FolderPlus className="size-4" aria-hidden="true" />
              New group
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <form
          onSubmit={createGroup}
          className="mt-4 flex flex-col gap-2 rounded-[var(--tw-r-tile)] bg-tile p-4 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 sm:max-w-sm">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">New group name</span>
            <Input
              autoFocus
              value={newName}
              maxLength={100}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Socials, Monthly sets, Customs"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="light" disabled={!newName.trim() || busyGroup}>
              {busyGroup ? "Adding" : "Add group"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {templates.length === 0 || (isFiltered && filteredTemplates.length === 0) ? (
        <div className="mt-6">
          <NoTemplates
            isFiltered={isFiltered}
            onClearFilters={() => {
              setSearchQuery("");
              setFilterStatus("all");
            }}
            filterContext={
              searchQuery
                ? "search"
                : filterStatus === "active"
                  ? "active"
                  : filterStatus === "inactive"
                    ? "inactive"
                    : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-2">
          {visibleGroups.map((group, index) => {
            const list = byGroup.get(group.id) ?? [];
            const headingId = `tpl-group-${group.id}`;
            const renaming = renamingId === group.id;
            return (
              <TemplateShelf
                key={group.id}
                headingId={headingId}
                ids={list.map((t) => t.id)}
                {...shelfDrag(group.id, group.id)}
                heading={
                  renaming ? (
                    <form onSubmit={renameGroup} className="flex flex-wrap items-center gap-2">
                      <h2 id={headingId} className="sr-only">
                        {group.name}
                      </h2>
                      <Input
                        autoFocus
                        aria-label={`New name for ${group.name}`}
                        value={renameValue}
                        maxLength={100}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-9 w-[min(18rem,70vw)]"
                      />
                      <Button type="submit" size="sm" variant="light" disabled={busyGroup}>
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <h2 id={headingId} className="min-w-0 truncate">
                      {group.name}
                    </h2>
                  )
                }
                sub={renaming ? undefined : group.description ? `${countLine(list)} · ${group.description}` : countLine(list)}
                actions={
                  canManageGroups && !renaming ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`Group options for ${group.name}`}>
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => {
                            setRenamingId(group.id);
                            setRenameValue(group.name);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          Rename
                        </DropdownMenuItem>
                        {!isFiltered && (
                          <>
                            <DropdownMenuItem disabled={index === 0} onClick={() => void moveGroup(group.id, -1)}>
                              <ArrowUp className="size-4" aria-hidden="true" />
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === visibleGroups.length - 1}
                              onClick={() => void moveGroup(group.id, 1)}
                            >
                              <ArrowDown className="size-4" aria-hidden="true" />
                              Move down
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-late focus:text-late" onClick={() => setDeleting(group)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Delete group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null
                }
                empty={emptyShelf(
                  canManageGroups || (canEdit && groupOptions.length > 0)
                    ? "Nothing in this group yet. Drag a template here, or use Move to group on a template's menu."
                    : "Nothing in this group yet."
                )}
              >
                {list.map(card)}
              </TemplateShelf>
            );
          })}

          {(showUngrouped || groups.length === 0) && (
            <TemplateShelf
              headingId="tpl-group-none"
              ids={ungrouped.map((t) => t.id)}
              {...shelfDrag(UNGROUPED, null)}
              heading={<h2 id="tpl-group-none">{groups.length === 0 ? "All templates" : "Ungrouped"}</h2>}
              sub={
                groups.length === 0
                  ? canManageGroups
                    ? `${countLine(ungrouped)}. Make a group to give a set of templates its own shelf.`
                    : countLine(ungrouped)
                  : ungrouped.length
                    ? countLine(ungrouped)
                    : "Drop here to take a template out of its group"
              }
              empty={emptyShelf("Drop a template here to take it out of its group.")}
            >
              {ungrouped.map(card)}
            </TemplateShelf>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete group?"}
        confirmLabel="Delete group"
        variant="destructive"
        description={(() => {
          const n = deleting ? templates.filter((t) => t.categoryId === deleting.id).length : 0;
          return n
            ? `Its ${n} ${n === 1 ? "template moves" : "templates move"} to Ungrouped. The templates themselves aren't deleted.`
            : "The group is empty, so no templates move.";
        })()}
        loading={busyGroup}
        onConfirm={deleteGroup}
      />
    </div>
  );
}
