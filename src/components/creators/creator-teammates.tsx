"use client";

import * as React from "react";
import { toast } from "sonner";
import { AssignDialog } from "@/components/team/assign-dialog";

interface Teammate {
  id: string;
  name: string;
  assigned: boolean;
  /** "hidden": their role is limited to chosen creators or groups */
  effect: "shows" | "all" | "hidden";
  roleName: string;
}

const list = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

/**
 * "Looked after by" on a creator's profile: the teammates assigned to them,
 * and (with "creators.assign") a button to change who.
 */
export function CreatorTeammates({ creatorId, creatorName }: { creatorId: string; creatorName: string }) {
  const [teammates, setTeammates] = React.useState<Teammate[] | null>(null);
  const [canAssign, setCanAssign] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/creators/${creatorId}/team`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTeammates(data.teammates);
      setCanAssign(!!data.canAssign);
    } catch {
      setTeammates([]);
    }
  }, [creatorId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const assigned = (teammates ?? []).filter((t) => t.assigned);
  const first = creatorName.trim().split(/\s+/)[0] || creatorName;

  const save = async (userIds: string[]) => {
    try {
      const res = await fetch(`/api/creators/${creatorId}/team`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      const on = new Set<string>(data.assigned);
      setTeammates((t) => (t ? t.map((x) => ({ ...x, assigned: on.has(x.id) })) : t));
      toast.success(on.size ? `${first} is looked after by ${list((teammates ?? []).filter((x) => on.has(x.id)).map((x) => x.name))}` : `Nobody is assigned to ${first} now`);
      const unseen = (teammates ?? []).filter((x) => on.has(x.id) && x.effect === "hidden");
      if (unseen.length)
        toast.warning(
          `${list(unseen.map((x) => x.name))} won't see ${first} yet: their role shows only chosen creators. Set it to "Creators assigned to them" in Settings, Roles.`
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
      throw e;
    }
  };

  return (
    <div>
      <dt className="text-[13px] text-ink-2">Looked after by</dt>
      <dd className="mt-0.5 font-semibold text-ink">{teammates === null ? "…" : assigned.length ? list(assigned.map((t) => t.name)) : "Nobody yet"}</dd>
      {canAssign && teammates !== null && (
        <dd>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] text-ink-2 underline decoration-ctl-hi underline-offset-[3px] hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {assigned.length ? "Change" : "Assign a teammate"}
          </button>
          <AssignDialog
            open={open}
            onOpenChange={setOpen}
            title={`Who looks after ${first}?`}
            description={`Teammates whose role sees only their assigned creators will see ${first}. For everyone else it shows who looks after them.`}
            noun="teammate"
            items={teammates.map((t) => ({
              id: t.id,
              name: t.name,
              detail: t.effect === "hidden" ? `Won't see ${first}: ${t.roleName} shows only chosen creators` : undefined,
            }))}
            initial={assigned.map((t) => t.id)}
            onSave={save}
          />
        </dd>
      )}
    </div>
  );
}
