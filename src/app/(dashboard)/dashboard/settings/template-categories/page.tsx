"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Template groups (stored as TemplateCategory rows; the route keeps its old
 * path). The Templates page manages groups inline as shelves; this settings
 * page is the plain list of them, with descriptions.
 */

interface TemplateGroup {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  templateCount: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export default function TemplateGroupsPage() {
  const [groups, setGroups] = React.useState<TemplateGroup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateGroup | null>(null);
  const [deleting, setDeleting] = React.useState<TemplateGroup | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/template-categories?includeTemplateCount=true");
        if (!res.ok) throw new Error(await readError(res, "Couldn't load the template groups"));
        const data = await res.json();
        setGroups(data.categories || []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't load the template groups");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const save = async (data: { name: string; description: string }) => {
    const url = editing ? `/api/template-categories/${editing.id}` : "/api/template-categories";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || (editing ? null : undefined),
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Couldn't save the group"));
    const saved = await res.json();
    if (editing) {
      setGroups((prev) => prev.map((g) => (g.id === editing.id ? { ...g, ...saved } : g)));
      toast.success("Group saved");
    } else {
      setGroups((prev) => [...prev, saved]);
      toast.success(`${saved.name} added`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const move = async (id: string, by: -1 | 1) => {
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

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/template-categories/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't delete the group"));
      setGroups((prev) => prev.filter((g) => g.id !== deleting.id));
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the group");
    } finally {
      setBusy(false);
    }
  };

  const total = groups.reduce((n, g) => n + g.templateCount, 0);

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Template groups</h1>
          <p className="mt-1 max-w-[70ch] text-[15px]">
            Each group is a shelf on the{" "}
            <Link href="/dashboard/templates" className="underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
              Templates
            </Link>{" "}
            page, and decides which team members can use its templates.
          </p>
          {!isLoading && groups.length > 0 && (
            <p className="mt-1 text-sm text-ink-2 tabular-nums">
              {groups.length} {groups.length === 1 ? "group" : "groups"}, holding {total}{" "}
              {total === 1 ? "template" : "templates"}
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="max-sm:w-full"
        >
          <Plus className="size-4" aria-hidden="true" />
          New group
        </Button>
      </header>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[68px] w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-[var(--tw-r-tile)] bg-tile-dim px-6 py-8">
            <h2 className="text-[17px] font-semibold">No groups yet</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-ink-2">
              Group templates by what they are for, such as Socials, Monthly sets or Customs. Each group
              gets its own shelf on the Templates page.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {groups.map((g, i) => (
              <li
                key={g.id}
                className="flex items-center gap-4 rounded-[var(--tw-r-tile)] bg-tile px-4 py-3 transition-colors duration-200 hover:bg-tile-hi"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold">{g.name}</h2>
                  <p className="truncate text-[13px] text-ink-2 tabular-nums">
                    {g.templateCount} {g.templateCount === 1 ? "template" : "templates"}
                    {g.description ? ` · ${g.description}` : ""}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Group options for ${g.name}`}>
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(g);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Rename or describe
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={i === 0} onClick={() => void move(g.id, -1)}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={i === groups.length - 1} onClick={() => void move(g.id, 1)}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-late focus:text-late" onClick={() => setDeleting(g)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ol>
        )}
      </div>

      <GroupFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        onSubmit={save}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete group?"}
        confirmLabel="Delete group"
        variant="destructive"
        description={
          deleting && deleting.templateCount > 0
            ? `Its ${deleting.templateCount} ${deleting.templateCount === 1 ? "template moves" : "templates move"} to Ungrouped. The templates themselves aren't deleted.`
            : "The group is empty, so no templates move."
        }
        loading={busy}
        onConfirm={remove}
      />
    </div>
  );
}

function GroupFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TemplateGroup | null;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
    }
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New group"}</DialogTitle>
          <DialogDescription>
            {initial ? "Rename the group or say what belongs in it." : "Name the shelf its templates will sit on."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Socials, Monthly sets, Customs"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">What goes in it (optional)</Label>
            <Textarea
              id="group-description"
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving" : initial ? "Save group" : "Add group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
