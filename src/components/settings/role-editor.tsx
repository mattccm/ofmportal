"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Loader2, Lock, RotateCcw, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackLink, Pill } from "@/components/creators/people-ui";
import { InviteConfirmDialog } from "@/components/invites/invite-link";
import { cn } from "@/lib/utils";
import {
  AREAS,
  PERMISSION_KEYS,
  ROLE_COLORS,
  creatorScopeSentence,
  dependentsOf,
  permissionsInArea,
  summarize,
  teamScopeSentence,
  withImplied,
  type AreaId,
  type CreatorScope,
  type PermissionDef,
  type TeamScope,
} from "@/lib/access/catalogue";

export interface RoleEditorData {
  role: {
    id: string;
    kind: "owner" | "preset" | "custom";
    name: string;
    description: string;
    color: string | null;
    keys: string[];
    creatorScope: CreatorScope;
    teamScope: TeamScope;
  };
  roles: { id: string; name: string; kind: "owner" | "preset" | "custom"; memberCount: number; grantable: boolean }[];
  groups: { id: string; name: string; count: number }[];
  creators: { id: string; name: string }[];
  staff: { id: string; name: string; email: string; roleId: string }[];
  holderIds: string[];
  me: { id: string; isOwner: boolean; canChangeRoles: boolean };
}

type Draft = {
  name: string;
  description: string;
  color: string | null;
  keys: string[];
  creatorScope: CreatorScope;
  teamScope: TeamScope;
};

const TOTAL = PERMISSION_KEYS.length;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function draftOf(r: RoleEditorData["role"]): Draft {
  return {
    name: r.name,
    description: r.description,
    color: r.color,
    keys: r.kind === "owner" ? [...PERMISSION_KEYS] : [...withImplied(r.keys)].sort(),
    creatorScope: r.creatorScope,
    teamScope: r.teamScope,
  };
}

const same = (a: Draft, b: Draft) => JSON.stringify({ ...a, keys: [...a.keys].sort() }) === JSON.stringify({ ...b, keys: [...b.keys].sort() });

export function RoleEditor({ data }: { data: RoleEditorData }) {
  const router = useRouter();
  const { role } = data;
  const isNew = role.id === "new";
  const locked = role.kind === "owner";
  const builtIn = role.kind !== "custom";

  const [saved, setSaved] = React.useState<Draft>(() => draftOf(role));
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(role));
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<Set<AreaId>>(() => new Set(isNew ? (["requests"] as AreaId[]) : []));
  const [busy, setBusy] = React.useState<null | "save" | "duplicate" | "reset" | "delete" | "assign">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | "reset" | "delete">(null);

  const dirty = isNew || !same(draft, saved);
  const keys = React.useMemo(() => new Set(draft.keys), [draft.keys]);

  const names = React.useMemo(
    () => ({
      groups: Object.fromEntries(data.groups.map((g) => [g.id, g.name])),
      creators: Object.fromEntries(data.creators.map((c) => [c.id, c.name])),
      roles: Object.fromEntries(data.roles.map((r) => [r.id, r.name])),
      members: Object.fromEntries(data.staff.map((s) => [s.id, s.name])),
    }),
    [data.groups, data.creators, data.roles, data.staff]
  );

  // ----- editing -----

  const setKeys = (next: Set<string>) => setDraft((d) => ({ ...d, keys: [...next].sort() }));

  const turnOn = (list: string[]) => {
    const next = new Set(keys);
    const before = next.size;
    for (const k of withImplied(list)) next.add(k);
    const extra = next.size - before - list.filter((k) => !keys.has(k)).length;
    setKeys(next);
    setStatus(extra > 0 ? `Also turned on ${plural(extra, "permission")} it needs.` : "");
  };

  const turnOff = (list: string[]) => {
    const next = new Set(keys);
    let extra = 0;
    for (const k of list) {
      next.delete(k);
      for (const dep of dependentsOf(k)) {
        if (next.has(dep) && !list.includes(dep)) {
          next.delete(dep);
          extra++;
        }
      }
    }
    setKeys(next);
    setStatus(extra > 0 ? `Also turned off ${plural(extra, "permission")} that need it.` : "");
  };

  const toggleArea = (id: AreaId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ----- search -----

  const q = query.trim().toLowerCase();
  const matches = (d: PermissionDef) =>
    !q || d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.key.toLowerCase().includes(q);
  const areaMatches = (title: string) => !!q && title.toLowerCase().includes(q);

  const visibleAreas = AREAS.map((a) => {
    const all = permissionsInArea(a.id);
    const rows = areaMatches(a.title) ? all : all.filter(matches);
    const scopeHit =
      !q ||
      (a.id === "creators" && "which creators groups chosen".includes(q)) ||
      (a.id === "team" && "which team members teammates people themselves".includes(q));
    return { ...a, all, rows, scopeHit };
  }).filter((a) => a.rows.length > 0 || (q && a.scopeHit && (a.id === "creators" || a.id === "team")));

  const shownCount = visibleAreas.reduce((n, a) => n + a.rows.length, 0);

  // ----- server actions -----

  const body = () => ({
    ...(role.kind === "custom" ? { name: draft.name.trim() } : {}),
    description: draft.description.trim() || null,
    color: draft.color,
    keys: draft.keys,
    creatorScope: draft.creatorScope,
    teamScope: draft.teamScope,
  });

  const save = async () => {
    if (role.kind === "custom" && !draft.name.trim()) {
      setError("Give the role a name.");
      document.getElementById("role-name")?.focus();
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const res = await fetch(isNew ? "/api/roles" : `/api/roles/${role.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "The role could not be saved. Try again.");
        return;
      }
      toast.success(isNew ? `${json.role.name} created` : `${json.role.name} saved`, {
        description: isNew ? "Move people onto it here or on the Team page." : "Everyone with this role has the new access straight away.",
      });
      if (isNew) {
        router.replace(`/dashboard/settings/roles/${json.role.id}`);
        return;
      }
      const next = draftOf({ ...role, ...json.role, description: json.role.description ?? "" });
      setSaved(next);
      setDraft(next);
      router.refresh();
    } catch {
      setError("The role could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async () => {
    setBusy("duplicate");
    try {
      const res = await fetch(`/api/roles/${role.id}/duplicate`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "The role could not be duplicated");
      toast.success(`${json.role.name} created`, { description: "Rename it and change what it can do." });
      router.push(`/dashboard/settings/roles/${json.role.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The role could not be duplicated");
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      const res = await fetch(`/api/roles/${role.id}/reset`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "The role could not be reset");
      const next = draftOf({ ...role, ...json.role, description: json.role.description ?? "" });
      setSaved(next);
      setDraft(next);
      setConfirm(null);
      toast.success(`${role.name} is back to its defaults`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The role could not be reset");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "The role could not be deleted");
      toast.success(`${role.name} deleted`);
      router.push("/dashboard/settings/roles");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The role could not be deleted");
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  };

  const assign = async (memberId: string, roleId: string) => {
    setBusy("assign");
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "The role could not be changed");
      const who = data.staff.find((s) => s.id === memberId)?.name ?? "They";
      toast.success(`${who} is now ${json.role.name}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The role could not be changed");
    } finally {
      setBusy(null);
    }
  };

  // ----- derived -----

  const summary = summarize(draft.keys);
  const holders = data.staff.filter((s) => data.holderIds.includes(s.id));
  const thisRole = data.roles.find((r) => r.id === role.id);
  const canMovePeople = data.me.canChangeRoles;
  const movable = (s: { id: string; roleId: string }) =>
    canMovePeople && s.id !== data.me.id && (s.roleId !== "owner" || data.me.isOwner) && (data.roles.find((r) => r.id === s.roleId)?.grantable ?? false);
  const targets = data.roles.filter((r) => r.grantable && (r.kind !== "owner" || data.me.isOwner));
  const addable = !isNew && thisRole?.grantable ? data.staff.filter((s) => !data.holderIds.includes(s.id) && movable(s)) : [];

  const title = isNew ? "New role" : role.name;
  const lede = locked
    ? "The owner can do everything, always. This role can't be changed, and the last owner can't be removed."
    : isNew
      ? "Name the role, then switch on what it can do. It starts with nothing, so it can only see what you allow."
      : role.kind === "preset"
        ? "A built-in role. Change what it can do, or put it back to its defaults at any time."
        : "Change what this role can see and do. Everyone with it gets the change straight away.";

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-[72ch]">
          <BackLink href="/dashboard/settings/roles" label="Roles" className="mb-3" />
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink sm:text-[26px]">
            {!isNew && <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: draft.color ?? "#a6aab3" }} aria-hidden="true" />}
            {title}
          </h1>
          <p className="mt-1.5 text-[15px] leading-normal text-ink">{lede}</p>
        </div>
        {!isNew && (
          <div className="flex shrink-0 flex-col gap-2 max-sm:[&>*]:h-11 max-sm:[&>*]:w-full sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              onClick={duplicate}
              disabled={!!busy || (dirty && !locked)}
              title={dirty && !locked ? "Save or discard your changes first" : undefined}
            >
              {busy === "duplicate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Copy aria-hidden="true" />}
              Duplicate role
            </Button>
            {role.kind === "preset" && (
              <Button variant="outline" onClick={() => setConfirm("reset")} disabled={!!busy}>
                <RotateCcw aria-hidden="true" />
                Reset to default
              </Button>
            )}
            {role.kind === "custom" && (
              <Button
                variant="destructive"
                onClick={() => setConfirm("delete")}
                disabled={!!busy || holders.length > 0}
                title={holders.length > 0 ? "Move everyone off this role first" : undefined}
              >
                <Trash2 aria-hidden="true" />
                Delete role
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0 space-y-8">
          {/* Details */}
          <section aria-labelledby="role-details-h" className="space-y-3">
            <h2 id="role-details-h" className="text-[17px] font-semibold leading-snug text-ink">
              Details
            </h2>
            <div className="grid gap-5 rounded-[10px] bg-tile p-4 sm:p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    disabled={builtIn}
                    maxLength={60}
                    placeholder="Reviewer"
                    aria-describedby={builtIn ? "role-name-hint" : undefined}
                    aria-invalid={!!error && !draft.name.trim() ? true : undefined}
                  />
                  {builtIn && (
                    <p id="role-name-hint" className="text-[13px] text-ink-2">
                      Built-in roles keep their name. Duplicate it to make a renamed copy.
                    </p>
                  )}
                </div>
                <fieldset className="space-y-2" disabled={locked}>
                  <legend className="mb-2 text-sm font-medium text-ink">Colour</legend>
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    {ROLE_COLORS.map((c) => (
                      <label key={c.value} className="relative grid size-10 cursor-pointer place-items-center rounded-full has-[:disabled]:cursor-not-allowed md:size-9">
                        <input
                          type="radio"
                          name="role-color"
                          value={c.value}
                          checked={draft.color === c.value}
                          onChange={() => setDraft((d) => ({ ...d, color: c.value }))}
                          className="peer sr-only"
                        />
                        <span
                          className="size-6 rounded-full ring-offset-2 ring-offset-tile peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
                          style={{ backgroundColor: c.value }}
                          aria-hidden="true"
                        />
                        <span className="sr-only">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea
                  id="role-description"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  disabled={locked}
                  rows={2}
                  maxLength={240}
                  placeholder="What this role is for, in a sentence"
                />
              </div>
            </div>
          </section>

          {/* Permissions */}
          <section aria-labelledby="role-perms-h" className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 id="role-perms-h" className="text-[17px] font-semibold leading-snug text-ink">
                  Permissions
                </h2>
                <p className="mt-0.5 text-sm tabular-nums text-ink-2">
                  {keys.size} of {TOTAL} on.{" "}
                  {q ? `${plural(shownCount, "permission")} match “${query.trim()}”.` : "Open an area to switch single permissions."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a permission"
                    aria-label="Find a permission"
                    className="pl-9 pr-9"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear the search"
                      className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-icon hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {!q && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-ink-2 hover:text-ink max-md:h-11"
                    onClick={() => setOpen(open.size === AREAS.length ? new Set() : new Set(AREAS.map((a) => a.id)))}
                  >
                    {open.size === AREAS.length ? "Close all" : "Open all"}
                  </Button>
                )}
              </div>
            </div>
            <p role="status" aria-live="polite" className={cn("text-sm text-ink", !status && "sr-only")}>
              {status}
            </p>

            {visibleAreas.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-ctl px-4 py-4 text-sm text-ink-2">
                No permission matches “{query.trim()}”. Try a word like requests, email or export.
              </div>
            ) : (
              <ul className="space-y-2">
                {visibleAreas.map((a) => {
                  const isOpen = !!q || open.has(a.id);
                  const on = a.all.filter((d) => keys.has(d.key)).length;
                  const allOn = on === a.all.length;
                  return (
                    <li key={a.id} className="overflow-hidden rounded-[10px] bg-tile">
                      <div className="flex items-center gap-3 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleArea(a.id)}
                          aria-expanded={isOpen}
                          aria-controls={`area-${a.id}`}
                          disabled={!!q}
                          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <ChevronDown
                            className={cn("size-4 shrink-0 text-icon transition-transform duration-200 motion-reduce:transition-none", !isOpen && "-rotate-90")}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{a.title}</span>
                            <span className="block text-[13px] tabular-nums text-ink-2">
                              {a.id === "creatorInfo"
                                ? on === a.all.length
                                  ? "Sees everything about a creator"
                                  : `Sees ${on} of ${a.all.length} details`
                                : `${on} of ${a.all.length} on`}
                              {a.id === "creators" && ` · ${creatorScopeSentence(draft.creatorScope, names).replace(/\.$/, "").toLowerCase()}`}
                              {a.id === "team" && ` · ${teamScopeSentence(draft.teamScope, names).replace(/\.$/, "").toLowerCase()}`}
                            </span>
                          </span>
                        </button>
                        <Switch
                          checked={allOn}
                          onCheckedChange={(v) => (v ? turnOn(a.all.map((d) => d.key)) : turnOff(a.all.map((d) => d.key)))}
                          disabled={locked}
                          aria-label={`Everything in ${a.title}`}
                        />
                      </div>
                      {isOpen && (
                        <div id={`area-${a.id}`} className="border-t border-line">
                          {a.id === "creatorInfo" && <p className="px-4 pt-3 text-[13px] text-ink-2">{AREAS.find((x) => x.id === "creatorInfo")!.description}</p>}
                          {a.id === "creators" && a.scopeHit && (
                            <CreatorScopePicker
                              value={draft.creatorScope}
                              onChange={(creatorScope) => setDraft((d) => ({ ...d, creatorScope }))}
                              groups={data.groups}
                              creators={data.creators}
                              disabled={locked}
                            />
                          )}
                          {a.id === "team" && a.scopeHit && (
                            <TeamScopePicker
                              value={draft.teamScope}
                              onChange={(teamScope) => setDraft((d) => ({ ...d, teamScope }))}
                              roles={data.roles}
                              staff={data.staff}
                              disabled={locked}
                            />
                          )}
                          <ul className="divide-y divide-line">
                            {a.rows.map((d) => (
                              <li key={d.key} className="flex items-start gap-4 px-4 py-3.5">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span id={`perm-${d.key}`} className="text-[15px] font-medium text-ink">
                                      {d.label}
                                    </span>
                                    {d.dangerous && (
                                      <Pill tone="quiet">
                                        <ShieldAlert className="mr-1 size-3" aria-hidden="true" />
                                        Sensitive
                                      </Pill>
                                    )}
                                  </div>
                                  <p id={`perm-${d.key}-d`} className="mt-0.5 text-[13px] leading-normal text-ink-2">
                                    {d.description}
                                  </p>
                                </div>
                                <Switch
                                  className="mt-0.5"
                                  checked={keys.has(d.key)}
                                  onCheckedChange={(v) => (v ? turnOn([d.key]) : turnOff([d.key]))}
                                  disabled={locked}
                                  aria-describedby={`perm-${d.key}-d`}
                                  aria-label={d.label}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!locked && dirty && (
            <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-ground px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0">
              {error && (
                <p role="alert" className="mb-3 rounded-[8px] border border-late/35 bg-late/10 p-3 text-sm text-ink">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-sm text-ink-2 sm:mr-auto">{isNew ? "Not created yet." : "Unsaved changes."}</p>
                {isNew ? (
                  <Button asChild variant="ghost" className="max-sm:h-11">
                    <Link href="/dashboard/settings/roles">Cancel</Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="max-sm:h-11"
                    disabled={!!busy}
                    onClick={() => {
                      setDraft(saved);
                      setError(null);
                      setStatus("");
                    }}
                  >
                    Discard changes
                  </Button>
                )}
                <Button onClick={save} disabled={!!busy} className="max-sm:h-11">
                  {busy === "save" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isNew ? "Create role" : "Save role"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Summary and people */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:self-start" aria-label="About this role">
          <section aria-labelledby="role-summary-h" className="rounded-[10px] bg-tile p-4 sm:p-5">
            <h2 id="role-summary-h" className="text-[17px] font-semibold leading-snug text-ink">
              What this role can do
            </h2>
            <p className="mt-2 text-sm text-ink">
              {creatorScopeSentence(draft.creatorScope, names)} {teamScopeSentence(draft.teamScope, names)}
            </p>
            {summary.lines.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">Nothing yet. Switch on permissions to give this role access.</p>
            ) : (
              <dl className="mt-3 space-y-2">
                {summary.lines.map((l) => (
                  <div key={l.area}>
                    <dt className="text-[13px] font-semibold text-ink">{l.title}</dt>
                    <dd className="text-[13px] text-ink-2">{l.text.charAt(0).toUpperCase() + l.text.slice(1)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {summary.hiddenInfo.length > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink">
                <Lock className="mr-1 inline size-3.5 align-[-2px] text-icon" aria-hidden="true" />
                Hidden from them: creators&apos; {summary.hiddenInfo.join(", ")}.
              </p>
            )}
            {summary.none.length > 0 && summary.lines.length > 0 && (
              <p className="mt-3 text-[13px] text-ink-2">No access to {summary.none.join(", ").toLowerCase()}.</p>
            )}
          </section>

          {!isNew && (
            <section aria-labelledby="role-people-h" className="rounded-[10px] bg-tile p-4 sm:p-5">
              <h2 id="role-people-h" className="text-[17px] font-semibold leading-snug text-ink">
                People with this role
              </h2>
              <p className="mt-0.5 text-sm tabular-nums text-ink-2">
                {holders.length === 0 ? "Nobody yet." : `${plural(holders.length, "person", "people")}.`}
              </p>
              {holders.length > 0 && (
                <ul className="mt-3 divide-y divide-line">
                  {holders.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {s.name}
                          {s.id === data.me.id && <span className="font-normal text-ink-2"> (you)</span>}
                        </p>
                        <p className="truncate text-[13px] text-ink-2">{s.email}</p>
                      </div>
                      {movable(s) && (
                        <Select value="" onValueChange={(v) => v && assign(s.id, v)} disabled={!!busy}>
                          <SelectTrigger aria-label={`Change role for ${s.name}`} className="h-11 md:h-9">
                            <SelectValue placeholder="Change role" />
                          </SelectTrigger>
                          <SelectContent>
                            {targets
                              .filter((r) => r.id !== role.id)
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {addable.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <Label htmlFor="role-add-person">Move someone onto this role</Label>
                  <Select value="" onValueChange={(v) => v && assign(v, role.id)} disabled={!!busy || dirty}>
                    <SelectTrigger id="role-add-person" className="h-11 md:h-9" aria-describedby={dirty ? "role-add-hint" : undefined}>
                      <SelectValue placeholder="Choose a teammate" />
                    </SelectTrigger>
                    <SelectContent>
                      {addable.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · now {names.roles[s.roleId] ?? "no role"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dirty && (
                    <p id="role-add-hint" className="text-[13px] text-ink-2">
                      Save your changes first.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <InviteConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Put ${role.name} back to its defaults?`}
        description={`Every permission, the creators it sees and the teammates it sees go back to how ${role.name} started. ${plural(holders.length, "person", "people")} with this role get the change straight away.`}
        confirmLabel="Reset to default"
        onConfirm={reset}
      />
      <InviteConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${role.name}?`}
        description="The role is removed for good. Nobody has it, so nobody loses access."
        confirmLabel="Delete role"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

// ---------- scope pickers ----------

function Choice({
  name,
  value,
  checked,
  onChange,
  disabled,
  title,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-tile-hi has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent",
        checked && "bg-tile-hi"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-ctl-hi bg-well transition-[border-width,border-color] checked:border-[5px] checked:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        <span className="block text-[13px] text-ink-2">{hint}</span>
      </span>
    </label>
  );
}

function CheckList<T extends { id: string; name: string }>({
  items,
  chosen,
  onChange,
  disabled,
  detail,
  label: groupLabel,
  filterable,
}: {
  items: T[];
  chosen: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  detail?: (item: T) => string;
  label: string;
  filterable?: boolean;
}) {
  const [filter, setFilter] = React.useState("");
  const f = filter.trim().toLowerCase();
  const shown = f ? items.filter((i) => i.name.toLowerCase().includes(f)) : items;
  const set = new Set(chosen);
  return (
    <div className="ml-7 mt-1 space-y-2">
      {filterable && items.length > 8 && (
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Find in ${groupLabel.toLowerCase()}`} aria-label={`Find in ${groupLabel.toLowerCase()}`} />
      )}
      <div role="group" aria-label={groupLabel} className="max-h-[280px] overflow-y-auto rounded-[8px] bg-well p-1">
        {shown.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-ink-2">Nothing matches.</p>
        ) : (
          shown.map((i) => (
            <label key={i.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[6px] px-3 py-2 hover:bg-tile md:min-h-9">
              <Checkbox
                checked={set.has(i.id)}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v === true ? [...chosen, i.id] : chosen.filter((x) => x !== i.id))}
                aria-label={i.name}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{i.name}</span>
              {detail && <span className="shrink-0 text-[13px] tabular-nums text-ink-2">{detail(i)}</span>}
            </label>
          ))
        )}
      </div>
      <p className="text-[13px] tabular-nums text-ink-2">{chosen.length} chosen.</p>
    </div>
  );
}

function ScopeBlock({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line px-4 py-4">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="text-[15px] font-semibold text-ink">
        {title}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">{hint}</p>
      <div className="mt-3 space-y-1">{children}</div>
    </fieldset>
  );
}

function CreatorScopePicker({
  value,
  onChange,
  groups,
  creators,
  disabled,
}: {
  value: CreatorScope;
  onChange: (s: CreatorScope) => void;
  groups: RoleEditorData["groups"];
  creators: RoleEditorData["creators"];
  disabled?: boolean;
}) {
  const groupIds = value.type === "groups" ? value.groupIds : [];
  const creatorIds = value.type === "creators" ? value.creatorIds : [];
  return (
    <ScopeBlock title="Which creators" hint="Creators outside this are invisible to them everywhere: lists, requests, messages, search, counts and exports.">
      <Choice name="creator-scope" value="all" checked={value.type === "all"} onChange={() => onChange({ type: "all" })} disabled={disabled} title="Every creator" hint="Including creators added later." />
      <Choice
        name="creator-scope"
        value="groups"
        checked={value.type === "groups"}
        onChange={() => onChange({ type: "groups", groupIds })}
        disabled={disabled}
        title="Creators in chosen groups"
        hint="Follows the groups: adding a creator to a group shows them to this role."
      />
      {value.type === "groups" &&
        (groups.length === 0 ? (
          <p className="ml-7 text-[13px] text-ink-2">
            There are no creator groups yet.{" "}
            <Link href="/dashboard/creators/groups" className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
              Make groups
            </Link>{" "}
            first.
          </p>
        ) : (
          <CheckList
            label="Creator groups"
            items={groups}
            chosen={groupIds}
            onChange={(ids) => onChange({ type: "groups", groupIds: ids })}
            disabled={disabled}
            detail={(g) => plural(g.count, "creator")}
          />
        ))}
      <Choice
        name="creator-scope"
        value="creators"
        checked={value.type === "creators"}
        onChange={() => onChange({ type: "creators", creatorIds })}
        disabled={disabled}
        title="Chosen creators"
        hint="Only the creators you tick. New creators stay hidden until you add them."
      />
      {value.type === "creators" && (
        <CheckList label="Creators" items={creators} chosen={creatorIds} onChange={(ids) => onChange({ type: "creators", creatorIds: ids })} disabled={disabled} filterable />
      )}
      <Choice
        name="creator-scope"
        value="assigned"
        checked={value.type === "assigned"}
        onChange={() => onChange({ type: "assigned" })}
        disabled={disabled}
        title="Creators assigned to them"
        hint="Each person sees only the creators assigned to them. Assign on a creator's profile (Looked after by) or on the Team page."
      />
    </ScopeBlock>
  );
}

function TeamScopePicker({
  value,
  onChange,
  roles,
  staff,
  disabled,
}: {
  value: TeamScope;
  onChange: (s: TeamScope) => void;
  roles: RoleEditorData["roles"];
  staff: RoleEditorData["staff"];
  disabled?: boolean;
}) {
  const roleIds = value.type === "roles" ? value.roleIds : [];
  const memberIds = value.type === "members" ? value.memberIds : [];
  return (
    <ScopeBlock
      title="Which team members"
      hint="Applies to the Team page, people pickers (assignees, watchers, mentions, chats), oversight and activity. They always see themselves."
    >
      <Choice name="team-scope" value="all" checked={value.type === "all"} onChange={() => onChange({ type: "all" })} disabled={disabled} title="Everyone" hint="The whole team." />
      <Choice
        name="team-scope"
        value="roles"
        checked={value.type === "roles"}
        onChange={() => onChange({ type: "roles", roleIds })}
        disabled={disabled}
        title="People with chosen roles"
        hint="Follows the roles as people move between them."
      />
      {value.type === "roles" && (
        <CheckList
          label="Roles"
          items={roles}
          chosen={roleIds}
          onChange={(ids) => onChange({ type: "roles", roleIds: ids })}
          disabled={disabled}
          detail={(r) => plural(r.memberCount, "person", "people")}
        />
      )}
      <Choice
        name="team-scope"
        value="members"
        checked={value.type === "members"}
        onChange={() => onChange({ type: "members", memberIds })}
        disabled={disabled}
        title="Chosen people"
        hint="Only the teammates you tick."
      />
      {value.type === "members" && (
        <CheckList label="Teammates" items={staff} chosen={memberIds} onChange={(ids) => onChange({ type: "members", memberIds: ids })} disabled={disabled} filterable />
      )}
      <Choice name="team-scope" value="self" checked={value.type === "self"} onChange={() => onChange({ type: "self" })} disabled={disabled} title="Only themselves" hint="Nobody else on the team appears anywhere for them." />
    </ScopeBlock>
  );
}

