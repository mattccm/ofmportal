"use client";

import * as React from "react";
import { toast } from "sonner";
import { AssignDialog, type AssignItem } from "./assign-dialog";

/**
 * Team page: the creators one teammate looks after. Loads when opened, saves
 * the whole list (PUT /api/team/[memberId]/creators).
 */
export function MemberCreatorsDialog({
  member,
  seesOnlyAssigned,
  onOpenChange,
  onSaved,
}: {
  member: { id: string; name: string } | null;
  /** Their role sees only their assigned creators */
  seesOnlyAssigned: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (memberId: string, count: number) => void;
}) {
  const [items, setItems] = React.useState<AssignItem[]>([]);
  const [initial, setInitial] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const memberId = member?.id;

  React.useEffect(() => {
    if (!memberId) return;
    let live = true;
    setLoading(true);
    fetch(`/api/team/${memberId}/creators`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { creators: { id: string; name: string; assigned: boolean }[] }) => {
        if (!live) return;
        setItems(d.creators.map((c) => ({ id: c.id, name: c.name })));
        setInitial(d.creators.filter((c) => c.assigned).map((c) => c.id));
      })
      .catch(() => toast.error("Couldn't load creators. Try again."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [memberId]);

  const first = member?.name.trim().split(/\s+/)[0] || "them";

  const save = async (creatorIds: string[]) => {
    if (!memberId) return;
    try {
      const res = await fetch(`/api/team/${memberId}/creators`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      onSaved(memberId, Array.isArray(data.assigned) ? data.assigned.length : creatorIds.length);
      toast.success(`${first} looks after ${creatorIds.length === 1 ? "1 creator" : `${creatorIds.length} creators`} now`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
      throw e;
    }
  };

  return (
    <AssignDialog
      open={!!member}
      onOpenChange={onOpenChange}
      title={`Creators ${first} looks after`}
      description={
        seesOnlyAssigned
          ? `${first}'s role sees only their assigned creators, so these are the creators ${first} sees.`
          : `${first}'s role sees every creator; this records who ${first} looks after. To limit what they see, give them a role set to "Creators assigned to them".`
      }
      noun="creator"
      items={items}
      initial={initial}
      loading={loading}
      onSave={save}
    />
  );
}
