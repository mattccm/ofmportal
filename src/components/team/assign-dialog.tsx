"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AssignItem {
  id: string;
  name: string;
}

/**
 * Tick who looks after whom: teammates for a creator, or creators for a
 * teammate. Saves the whole list at once.
 */
export function AssignDialog({
  open,
  onOpenChange,
  title,
  description,
  noun,
  items,
  initial,
  loading,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** "teammate" or "creator", for counts and empty lines */
  noun: string;
  items: AssignItem[];
  initial: string[];
  loading?: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [chosen, setChosen] = React.useState<Set<string>>(new Set(initial));
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Start from the saved list each time it opens (keyed by value, so a new array each render doesn't reset ticks)
  const initialKey = initial.join(",");
  React.useEffect(() => {
    if (open) {
      setChosen(new Set(initialKey ? initialKey.split(",") : []));
      setQuery("");
    }
  }, [open, initialKey]);

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  const changed = chosen.size !== initial.length || initial.some((id) => !chosen.has(id));
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;

  const toggle = (id: string, on: boolean) =>
    setChosen((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await onSave([...chosen]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-ink-2" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-ctl px-4 py-4 text-sm text-ink-2">No {noun}s to choose from yet.</p>
        ) : (
          <div className="space-y-2">
            {items.length > 8 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find a ${noun}`} aria-label={`Find a ${noun}`} className="pl-9" />
              </div>
            )}
            <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-[10px] bg-well" aria-label={`${noun}s`}>
              {shown.map((i) => {
                const on = chosen.has(i.id);
                return (
                  <li key={i.id}>
                    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-tile-hi", on && "bg-tile")}>
                      <Checkbox checked={on} onCheckedChange={(v) => toggle(i.id, v === true)} aria-label={i.name} />
                      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{i.name}</span>
                    </label>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-2">No {noun} matches “{query}”.</li>}
            </ul>
            <p className="text-[13px] tabular-nums text-ink-2">{chosen.size === 0 ? `No ${noun}s chosen` : `${plural(chosen.size)} chosen`}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || loading || !changed}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
