"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AssignDialog, type AssignItem } from "./assign-dialog";

type Effect = "shows" | "all" | "hidden";

/**
 * Team page: the creators one teammate looks after. Loads when opened, saves
 * the whole list (PUT /api/team/[memberId]/creators), and says plainly
 * whether their role will show them these creators.
 */
export function MemberCreatorsDialog({
  member,
  onOpenChange,
  onSaved,
}: {
  member: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (memberId: string, count: number) => void;
}) {
  const [items, setItems] = React.useState<AssignItem[]>([]);
  const [initial, setInitial] = React.useState<string[]>([]);
  const [info, setInfo] = React.useState<{ effect: Effect; roleId: string | null; roleName: string; canManageRoles: boolean } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const memberId = member?.id;

  React.useEffect(() => {
    if (!memberId) return;
    let live = true;
    setLoading(true);
    fetch(`/api/team/${memberId}/creators`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { creators: { id: string; name: string; assigned: boolean }[]; effect: Effect; roleId: string | null; roleName: string; canManageRoles: boolean }) => {
        if (!live) return;
        setItems(d.creators.map((c) => ({ id: c.id, name: c.name })));
        setInitial(d.creators.filter((c) => c.assigned).map((c) => c.id));
        setInfo({ effect: d.effect, roleId: d.roleId, roleName: d.roleName, canManageRoles: d.canManageRoles });
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
      if (info?.effect === "hidden" && creatorIds.length)
        toast.warning(`${first} won't see them yet: ${info.roleName} shows only chosen creators. Set it to "Creators assigned to them" in Settings, Roles.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
      throw e;
    }
  };

  const description =
    info?.effect === "shows"
      ? `${first}'s role (${info.roleName}) sees only their assigned creators, so these are the creators ${first} sees.`
      : info?.effect === "all"
        ? `${first}'s role (${info.roleName}) sees every creator; this records who ${first} looks after.`
        : `Choose the creators ${first} looks after.`;

  const notice =
    info?.effect === "hidden" ? (
      <>
        <span className="font-semibold">{first} won&rsquo;t see these yet.</span> {info.roleName} shows only chosen creators, so assigning
        doesn&rsquo;t show them to {first}. Set the role&rsquo;s creators to &ldquo;Creators assigned to them&rdquo;
        {info.canManageRoles && info.roleId ? (
          <>
            {" "}
            in{" "}
            <Link href={`/dashboard/settings/roles/${info.roleId}`} className="font-medium underline underline-offset-[3px]">
              {info.roleName}
            </Link>
          </>
        ) : (
          " (ask an admin)"
        )}
        .
      </>
    ) : undefined;

  return (
    <AssignDialog
      open={!!member}
      onOpenChange={onOpenChange}
      title={`Creators ${first} looks after`}
      description={description}
      notice={notice}
      noun="creator"
      items={items}
      initial={initial}
      loading={loading}
      onSave={save}
    />
  );
}
