import Link from "next/link";
import { ChevronRight, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHead, Pill } from "@/components/creators/people-ui";
import { NoAccess } from "@/components/access/no-access";
import { getPageAccess } from "@/lib/access/server";
import { loadRoles } from "@/lib/access/roles";
import { withCounts } from "@/lib/access/role-input";
import { PERMISSION_KEYS, withImplied, type CreatorScope, type TeamScope } from "@/lib/access/catalogue";

export const metadata = { title: "Roles and permissions" };

function scopeWords(c: CreatorScope, t: TeamScope): string {
  const creators =
    c.type === "all" ? "every creator" : c.type === "groups" ? `creators in ${c.groupIds.length} ${c.groupIds.length === 1 ? "group" : "groups"}` : `${c.creatorIds.length} chosen ${c.creatorIds.length === 1 ? "creator" : "creators"}`;
  const team =
    t.type === "all" ? "the whole team" : t.type === "self" ? "only themselves on the team" : t.type === "roles" ? `teammates in ${t.roleIds.length} ${t.roleIds.length === 1 ? "role" : "roles"}` : `${t.memberIds.length} chosen ${t.memberIds.length === 1 ? "teammate" : "teammates"}`;
  return `Sees ${creators} and ${team}`;
}

export default async function RolesPage() {
  const access = await getPageAccess();
  if (!access.has("roles.manage")) return <NoAccess what="managing roles and permissions" roleName={access.role.name} />;

  const roles = await withCounts(access.agencyId, await loadRoles(access.agencyId));
  const total = PERMISSION_KEYS.length;
  const custom = roles.filter((r) => r.kind === "custom").length;
  const people = roles.reduce((n, r) => n + r.memberCount, 0);

  return (
    <div className="mx-auto max-w-[1152px] space-y-8">
      <PageHead
        back={{ href: "/dashboard/settings", label: "Settings" }}
        title="Roles and permissions"
        lede="Everyone on the team has one role. A role decides what they can see and change, down to which creators and which teammates they see."
        actions={
          <Button asChild variant="light">
            <Link href="/dashboard/settings/roles/new">
              <Plus aria-hidden="true" />
              New role
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="roles-h" className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="roles-h" className="text-[17px] font-semibold leading-snug text-ink">
            Roles
          </h2>
          <span className="text-sm tabular-nums text-ink-2">
            {roles.length} roles, {custom === 0 ? "none of them custom yet" : `${custom} made here`}. {people} {people === 1 ? "person" : "people"} on the team.
          </span>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-[10px] bg-tile">
          {roles.map((r) => {
            const on = r.kind === "owner" ? total : withImplied(r.keys).size;
            return (
              <li key={r.id}>
                <Link
                  href={`/dashboard/settings/roles/${r.id}`}
                  className="group flex min-h-[76px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
                >
                  <span className="mt-1.5 size-2.5 shrink-0 self-start rounded-full" style={{ backgroundColor: r.color ?? "#a6aab3" }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{r.name}</span>
                      {r.kind === "owner" && (
                        <Pill tone="quiet">
                          <Lock className="mr-1 size-3" aria-hidden="true" />
                          Can&apos;t be changed
                        </Pill>
                      )}
                      {r.kind === "preset" && <Pill tone="quiet">Built in</Pill>}
                    </span>
                    {r.description && <span className="mt-0.5 block text-sm text-ink-2">{r.description}</span>}
                    <span className="mt-1 block text-[13px] tabular-nums text-ink-2">
                      {r.kind === "owner" ? "Every permission, every creator, the whole team" : `${on} of ${total} permissions · ${scopeWords(r.creatorScope, r.teamScope)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-ink">
                    {r.memberCount} <span className="text-ink-2">{r.memberCount === 1 ? "person" : "people"}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-icon transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="max-w-[72ch] text-sm text-ink-2">
          To give one person different access, make a role for it and move them onto it. Roles are changed for people on the{" "}
          <Link href="/dashboard/team" className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
            Team page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
