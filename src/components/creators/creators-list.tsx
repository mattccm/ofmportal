"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MessageSquare, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlipLayout } from "@/components/title-wall";
import { cn } from "@/lib/utils";
import type { CreatorStatus } from "./insights";
import { EmptyLine, Initials, Pill, UnreadCount } from "./people-ui";

export interface CreatorTile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  archived: boolean;
  inviteStatus: string;
  /** "SMS and email · Sydney · last seen 5 days ago" (sits after the name) */
  meta: string;
  /** One sentence: "2 active, on time 8 of 9, usually 2 days early." */
  sentence: string;
  status: CreatorStatus;
  unread: number;
  owed: number;
  activeCount: number;
  lastSeen: string | null;
  onTimeRate: number | null;
  finished: number;
  onTime: number;
}

type SortKey = "chase" | "seen" | "ontime" | "name";
const SORTS: { key: SortKey; label: string; cmp: (a: CreatorTile, b: CreatorTile) => number }[] = [
  {
    key: "chase",
    label: "Most to chase first",
    cmp: (a, b) =>
      b.owed - a.owed || (a.lastSeen ?? "").localeCompare(b.lastSeen ?? "") || a.name.localeCompare(b.name),
  },
  { key: "seen", label: "Last seen longest ago", cmp: (a, b) => (a.lastSeen ?? "").localeCompare(b.lastSeen ?? "") },
  {
    key: "ontime",
    label: "Lowest on-time rate",
    cmp: (a, b) => (a.onTimeRate ?? 2) - (b.onTimeRate ?? 2) || b.finished - a.finished,
  },
  { key: "name", label: "Name A to Z", cmp: (a, b) => a.name.localeCompare(b.name) },
];

export function CreatorsList({ creators }: { creators: CreatorTile[] }) {
  const [view, setView] = React.useState<"active" | "archived">("active");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("chase");
  const gridRef = React.useRef<HTMLUListElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const capture = useFlipLayout(gridRef, "[data-creator]", [sort, view, query]);

  const activeCount = creators.filter((c) => !c.archived).length;
  const archivedCount = creators.length - activeCount;
  const inView = creators.filter((c) => (view === "archived" ? c.archived : !c.archived));
  const q = query.trim().toLowerCase();
  const shown = inView
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    .sort(SORTS.find((s) => s.key === sort)!.cmp);

  // "/" focuses the search, like the other lists
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sortLabel = SORTS.find((s) => s.key === sort)!.label.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block w-full md:max-w-[360px]">
          <span className="sr-only">Search creators by name or email</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              capture();
              setQuery(e.target.value);
            }}
            placeholder="Search by name or email"
            className="pl-9"
            type="search"
          />
        </label>
        <div className="flex items-center gap-2 md:ml-auto">
          <div role="group" aria-label="Show" className="inline-flex rounded-[8px] bg-well p-0.5">
            {(["active", "archived"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  capture();
                  setView(v);
                }}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-8",
                  view === v && "bg-tile-hi text-ink"
                )}
              >
                {v === "active" ? "Active" : "Archived"}
                <span className="tabular-nums text-ink-2">{v === "active" ? activeCount : archivedCount}</span>
              </button>
            ))}
          </div>
          <Select
            value={sort}
            onValueChange={(v) => {
              capture();
              setSort(v as SortKey);
            }}
          >
            <SelectTrigger className="w-full md:w-[220px]" aria-label="Sort creators">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-ink-2" aria-live="polite">
        {q ? (
          <>
            <b className="font-semibold text-ink">{shown.length}</b> of {inView.length} {view} creators match
            &ldquo;{query.trim()}&rdquo;
          </>
        ) : (
          <>
            <b className="font-semibold text-ink">{inView.length}</b> {view} {inView.length === 1 ? "creator" : "creators"}, {sortLabel}
          </>
        )}
      </p>

      {shown.length === 0 ? (
        q ? (
          <EmptyLine>
            No {view} creator matches &ldquo;{query.trim()}&rdquo;.{" "}
            <button
              type="button"
              className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              Clear the search
            </button>
          </EmptyLine>
        ) : view === "archived" ? (
          <EmptyLine>No archived creators. Archiving a creator from their profile moves them here, and it can be undone.</EmptyLine>
        ) : (
          <EmptyLine>
            No creators yet. <Link className="font-medium text-ink underline underline-offset-[3px]" href="/dashboard/creators/invite">Invite a creator</Link> to send them their first request, or import a list from a CSV.
          </EmptyLine>
        )
      ) : (
        <ul ref={gridRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
          {shown.map((c) => (
            <li key={c.id} data-creator={c.id}>
              <CreatorCard c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreatorCard({ c }: { c: CreatorTile }) {
  const [sending, setSending] = React.useState(false);
  const canResend = !c.archived && (c.inviteStatus === "PENDING" || c.inviteStatus === "EXPIRED");

  const resend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/creators/${c.id}/resend-invite`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "The invite could not be sent");
      }
      toast.success(`Invite sent to ${c.name}`);
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "The invite could not be sent"}. Try again in a minute.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <article
      aria-labelledby={`cr-${c.id}`}
      className="relative flex h-full flex-col gap-3 rounded-[10px] bg-tile p-4 transition-colors hover:bg-tile-hi sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            <Link
              id={`cr-${c.id}`}
              href={`/dashboard/creators/${c.id}`}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {c.name}
            </Link>
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">{c.meta}</p>
        </div>
        <Initials name={c.name} />
      </div>
      <p className="text-[15px] leading-snug text-ink">{c.sentence}</p>
      <div>
        <Pill tone={c.status.tone}>{c.status.label}</Pill>
      </div>
      <div className="relative z-[1] mt-auto flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/dashboard/messages?creatorId=${c.id}`}
            aria-label={`Message ${c.name}${c.unread ? `, ${c.unread} unread` : ""}`}
          >
            <MessageSquare aria-hidden="true" />
            Message
            <UnreadCount n={c.unread} />
          </Link>
        </Button>
        {canResend ? (
          <Button variant="outline" size="sm" onClick={resend} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {sending ? "Sending" : "Resend invite"}
          </Button>
        ) : (
          !c.archived && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/requests/new?creatorId=${c.id}`} aria-label={`New request for ${c.name}`}>
                <Plus aria-hidden="true" />
                New request
              </Link>
            </Button>
          )
        )}
      </div>
    </article>
  );
}

export default CreatorsList;
