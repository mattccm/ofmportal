"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, ChevronLeft, Info, Loader2, LogOut, Plus, Search, SendHorizontal, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHead, Initials, UnreadCount, EmptyLine, Pill } from "@/components/creators/people-ui";
import {
  ago,
  cityOf,
  contactLabel,
  quietLabel,
  plural,
  usualPhrase,
  type DeliverySummary,
  type QuietHours,
} from "@/components/creators/insights";
import { TitleCard, arrive, formatDay, type FieldSummary } from "@/components/title-wall";
import { MentionInput } from "@/components/mentions/mention-input";
import { textToMentionSegments } from "@/lib/mention-parser";

// ---------------------------------------------------------------- types

interface Member {
  id: string;
  name: string;
}

interface Convo {
  id: string;
  type: string;
  name: string;
  creatorId: string | null;
  /** Team groups only: everyone in the group, you included */
  members: Member[] | null;
  last: { content: string; createdAt: string; fromCreator: boolean; mine: boolean; sender: string | null } | null;
  lastMessageAt: string | null;
  unread: number;
}

interface Msg {
  id: string;
  content: string;
  createdAt: string;
  mine: boolean;
  fromCreator: boolean;
  author: string;
  forwarded: { type: string; id: string; title: string | null }[];
}

interface Details {
  creator: { id: string; name: string; preferredContact: string; timezone: string; lastLoginAt: string | null };
  quiet: QuietHours;
  active: { id: string; title: string; due: string | null; fields: FieldSummary[] }[];
  delivery: DeliverySummary;
}

type View = "all" | "unread" | "creator" | "team";

const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "creator", label: "Creators" },
  { key: "team", label: "Team" },
];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatDay(d);
}

function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "7 min", "3 h", "Yesterday", "Thu 22 Oct" for the list */
function short(iso: string | null): string {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h`;
  return dayLabel(iso);
}

// ---------------------------------------------------------------- page

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const me = session?.user?.id ?? "";

  const [convos, setConvos] = React.useState<Convo[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [listError, setListError] = React.useState(false);
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [threadError, setThreadError] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [newSince, setNewSince] = React.useState<number>(0);
  const [details, setDetails] = React.useState<Details | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);

  const selectedId = searchParams.get("conversation");
  // ?creatorId= (Message buttons on the Overview, request and profile); ?creator= is the older spelling
  const creatorParam = searchParams.get("creatorId") ?? searchParams.get("creator");
  const selected = convos.find((c) => c.id === selectedId) ?? null;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const arrivedId = React.useRef<string | null>(null);

  // ---------- conversation list
  const fetchConvos = React.useCallback(async () => {
    setListError(false);
    try {
      const res = await fetch("/api/inbox?limit=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: Convo[] = (data.conversations ?? []).map(
        (c: {
          id: string;
          type: string;
          name: string;
          creator?: { id: string } | null;
          members?: Member[];
          lastMessage?: {
            content: string;
            createdAt: string;
            isFromCreator: boolean;
            isMine?: boolean;
            senderName?: string | null;
          } | null;
          lastMessageAt: string | null;
          hasUnread: boolean;
          unreadCount?: number;
        }) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          creatorId: c.creator?.id ?? null,
          members: c.type === "GROUP" ? c.members ?? [] : null,
          last: c.lastMessage
            ? {
                content: c.lastMessage.content,
                createdAt: c.lastMessage.createdAt,
                fromCreator: c.lastMessage.isFromCreator,
                mine: !!c.lastMessage.isMine,
                sender: c.lastMessage.senderName ?? null,
              }
            : null,
          lastMessageAt: c.lastMessageAt,
          unread: c.unreadCount ?? (c.hasUnread ? 1 : 0),
        })
      );
      setConvos(list);
      return list;
    } catch {
      setListError(true);
      return null;
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchConvos();
  }, [fetchConvos]);

  // ?creatorId= opens (or starts) that creator's thread
  const starting = React.useRef(false);
  React.useEffect(() => {
    if (!creatorParam || loadingList || starting.current) return;
    const found = convos.find((c) => c.creatorId === creatorParam);
    if (found) {
      router.replace(`/dashboard/messages?conversation=${found.id}`);
      return;
    }
    starting.current = true;
    (async () => {
      try {
        const res = await fetch("/api/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "CREATOR", creatorId: creatorParam }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        await fetchConvos();
        router.replace(`/dashboard/messages?conversation=${data.conversation.id}`);
      } catch {
        toast.error("That creator's thread could not be opened. Pick them from New conversation instead.");
        router.replace("/dashboard/messages");
      } finally {
        starting.current = false;
      }
    })();
  }, [creatorParam, convos, loadingList, fetchConvos, router]);

  // ---------- thread
  const mapMsg = React.useCallback(
    (m: {
      id: string;
      content: string;
      createdAt: string;
      isFromCreator: boolean;
      sender?: { id: string; name: string } | null;
      creator?: { id: string; name: string } | null;
      forwardedContent?: { type: string; id: string; data: { title?: string; originalName?: string } | null }[];
    }): Msg => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      mine: !m.isFromCreator && m.sender?.id === me,
      fromCreator: m.isFromCreator,
      author: m.isFromCreator ? m.creator?.name ?? "Creator" : m.sender?.name ?? "Staff",
      forwarded: (m.forwardedContent ?? []).map((f) => ({
        type: f.type,
        id: f.id,
        title: f.data?.title ?? f.data?.originalName ?? null,
      })),
    }),
    [me]
  );

  const loadThread = React.useCallback(
    async (id: string, before?: string) => {
      setLoadingThread(true);
      setThreadError(false);
      try {
        const p = new URLSearchParams({ limit: "50" });
        if (before) p.set("before", before);
        // Opening a thread marks its messages read (the inbox API does it on GET)
        const res = await fetch(`/api/inbox/${id}?${p}`);
        if (res.status === 404) {
          // Removed from the group (or it never was yours): drop it from the list
          setConvos((prev) => prev.filter((c) => c.id !== id));
          toast.error("You are no longer in that conversation.");
          router.replace("/dashboard/messages");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list: Msg[] = (data.messages ?? []).map(mapMsg);
        setMessages((prev) => (before ? [...list, ...prev] : list));
        setHasMore(!!data.hasMore);
        if (!before) {
          setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
          window.dispatchEvent(new Event("inbox:read"));
        }
      } catch {
        setThreadError(true);
      } finally {
        setLoadingThread(false);
      }
    },
    [mapMsg, router]
  );

  // A new selection starts with an empty draft and its own "new since" mark
  React.useEffect(() => {
    if (!selectedId) return;
    const c = convos.find((x) => x.id === selectedId);
    setNewSince(c?.unread ?? 0);
    setDraft("");
    // only when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // (Re)load the thread; this also re-runs once the session arrives, so it
  // must not touch the draft someone is already typing
  React.useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  // Details column: the creator behind the thread
  const creatorId = selected?.creatorId ?? null;
  React.useEffect(() => {
    setDetails(null);
    if (!creatorId) return;
    const ctrl = new AbortController();
    fetch(`/api/creators/${creatorId}/thread-details`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDetails(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [creatorId]);

  // Keep the newest message in view; animate a just-sent one in
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (arrivedId.current) {
      const node = el.querySelector(`[data-msg="${arrivedId.current}"]`);
      arrivedId.current = null;
      if (node) arrive(node);
    }
  }, [messages]);

  const select = (id: string) => {
    setDetailsOpen(false);
    router.push(`/dashboard/messages?conversation=${id}`);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments: [] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "The message was not sent");
      }
      const data = await res.json();
      const msg: Msg = {
        id: data.message.id,
        content: data.message.content,
        createdAt: data.message.createdAt,
        mine: true,
        fromCreator: false,
        author: session?.user?.name ?? "You",
        forwarded: [],
      };
      arrivedId.current = msg.id;
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      setNewSince(0);
      setConvos((prev) =>
        prev
          .map((c) =>
            c.id === selectedId
              ? {
                  ...c,
                  unread: 0,
                  lastMessageAt: msg.createdAt,
                  last: { content: msg.content, createdAt: msg.createdAt, fromCreator: false, mine: true, sender: null },
                }
              : c
          )
          .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
      );
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "The message was not sent"}. Your draft is kept; try again.`);
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  const createConversation = async (participantIds: string[], name?: string, creatorIdArg?: string) => {
    try {
      const body = creatorIdArg
        ? { type: "CREATOR", creatorId: creatorIdArg }
        : name !== undefined
          ? { type: "GROUP", participantIds, name }
          : { type: "DIRECT", participantIds };
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(`${d?.error || "The conversation could not be started"}. Try again.`);
        return false;
      }
      const data = await res.json();
      await fetchConvos();
      setNewOpen(false);
      setGroupOpen(false);
      router.push(`/dashboard/messages?conversation=${data.conversation.id}`);
      return true;
    } catch {
      toast.error("The conversation could not be started. Try again.");
      return false;
    }
  };

  // ---------- team groups: rename, add, remove, leave
  const updateGroup = async (id: string, change: { name?: string; add?: string[]; remove?: string[] }) => {
    try {
      const res = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const d = await res.json().catch(() => null);
      if (res.status === 404) {
        setConvos((prev) => prev.filter((c) => c.id !== id));
        router.replace("/dashboard/messages");
        toast.error("You are no longer in that group.");
        return false;
      }
      if (!res.ok) {
        toast.error(`${d?.error || "The group could not be changed"}. Try again.`);
        return false;
      }
      setConvos((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, name: d.name ?? c.name, members: (d.members as Member[]) ?? c.members } : c
        )
      );
      return true;
    } catch {
      toast.error("The group could not be changed. Try again.");
      return false;
    }
  };

  const leaveGroup = async (id: string) => {
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const d = await res.json().catch(() => null);
        toast.error(`${d?.error || "You could not leave the group"}. Try again.`);
        return;
      }
      const name = convos.find((c) => c.id === id)?.name;
      setConvos((prev) => prev.filter((c) => c.id !== id));
      setDetailsOpen(false);
      router.replace("/dashboard/messages");
      toast(`You left ${name ?? "the group"}.`);
    } catch {
      toast.error("You could not leave the group. Try again.");
    }
  };

  // ---------- derived
  const totalUnread = convos.reduce((n, c) => n + c.unread, 0);
  const unreadThreads = convos.filter((c) => c.unread > 0);
  const latest = [...unreadThreads].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))[0];
  const lede = loadingList
    ? "Loading conversations"
    : listError
      ? "Conversations could not be loaded."
      : totalUnread
        ? `${plural(totalUnread, "unread message")} in ${plural(unreadThreads.length, "conversation")}. Latest: ${latest?.name} wrote ${ago(latest?.lastMessageAt ?? null)}.`
        : convos.length
          ? `Everything is read across ${plural(convos.length, "conversation")}.`
          : "No conversations yet.";

  const q = query.trim().toLowerCase();
  const shown = convos.filter((c) => {
    if (view === "unread" && c.unread === 0) return false;
    if (view === "creator" && c.type !== "CREATOR") return false;
    if (view === "team" && c.type === "CREATOR") return false;
    if (q && !c.name.toLowerCase().includes(q) && !(c.last?.content ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
  const counts: Record<View, number> = {
    all: convos.length,
    unread: unreadThreads.length,
    creator: convos.filter((c) => c.type === "CREATOR").length,
    team: convos.filter((c) => c.type !== "CREATOR").length,
  };

  const first = selected?.name.split(/\s+/)[0] ?? "";
  const groupMembers = selected?.members;
  const groupOthers = React.useMemo(
    () => (groupMembers ?? []).filter((m) => m.id !== me).map((m) => m.id),
    [groupMembers, me]
  );
  // Phone and tablet: one region at a time
  // A deep link (?creatorId= or ?conversation=) is still resolving: hold the thread region, not the list
  const opening = !selected && (!!creatorParam || (!!selectedId && loadingList));
  const region: "list" | "thread" | "details" = opening ? "thread" : !selected ? "list" : detailsOpen ? "details" : "thread";

  // Index where "New since you last read" goes: before the last N messages from others
  let dividerAt = -1;
  if (newSince > 0) {
    let n = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].mine) n++;
      if (n === newSince) {
        dividerAt = i;
        break;
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title="Messages"
        lede={lede}
        actions={
          <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
            <Button variant="outline" onClick={() => setGroupOpen(true)}>
              <Users aria-hidden="true" />
              New group
            </Button>
            <Button variant="light" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden="true" />
              New conversation
            </Button>
          </div>
        }
        className={cn(region !== "list" && "max-lg:hidden")}
      />

      <div
        className={cn(
          "grid min-h-[520px] grid-cols-[minmax(0,1fr)] gap-4 lg:h-[calc(100dvh-190px)] lg:grid-cols-[320px_minmax(0,1fr)]",
          (selected || opening) && "xl:grid-cols-[320px_minmax(0,1fr)_300px]"
        )}
      >
        {/* ---------------- list ---------------- */}
        <section
          aria-label="Conversations"
          className={cn("flex min-h-0 flex-col rounded-[10px] bg-tile", region !== "list" && "max-lg:hidden")}
        >
          <div className="space-y-3 p-3">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages" className="pl-9" type="search" />
            </label>
            <div role="group" aria-label="Show" className="flex gap-0.5 overflow-x-auto">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={view === v.key}
                  onClick={() => setView(v.key)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1 rounded-[7px] px-2 text-[13px] font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring md:h-8",
                    view === v.key && "bg-tile-hi text-ink"
                  )}
                >
                  {v.label}
                  <span className="tabular-nums">{counts[v.key]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {loadingList ? (
              <ul aria-hidden="true" className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="flex gap-3 rounded-[8px] p-3">
                    <span className="size-9 rounded-full bg-tile-hi" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3.5 w-24 rounded bg-tile-hi" />
                      <span className="block h-3 w-40 rounded bg-tile-hi" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : listError ? (
              <EmptyLine className="m-1">
                Conversations could not be loaded.{" "}
                <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => void fetchConvos()}>
                  Try again
                </button>
              </EmptyLine>
            ) : shown.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-2">
                {q
                  ? `Nothing matches “${query.trim()}”.`
                  : view === "unread"
                    ? "Everything is read."
                    : "No conversations here yet. Start one with New conversation, or message a creator from their profile."}
              </p>
            ) : (
              <ul ref={listRef} className="space-y-0.5">
                {shown.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => select(c.id)}
                        aria-current={active ? "true" : undefined}
                        aria-label={`${c.name}${c.members ? `, team group of ${c.members.length}` : ""}${c.unread ? `, ${c.unread} unread` : ""}`}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-[8px] px-2.5 py-2.5 text-left transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                          active && "bg-tile-hi"
                        )}
                      >
                        {c.members ? <GroupMark members={c.members} me={me} active={active} /> : <Initials name={c.name} />}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={cn("min-w-0 flex-1 truncate text-sm text-ink", c.unread ? "font-bold" : "font-semibold")}>{c.name}</span>
                            <span className="shrink-0 text-[12px] text-ink-2" suppressHydrationWarning>
                              {short(c.lastMessageAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "text-ink" : "text-ink-2")}>
                              {c.last
                                ? `${c.last.mine ? "You: " : c.members && c.last.sender ? `${c.last.sender.split(/\s+/)[0]}: ` : ""}${c.last.content || "Shared content"}`
                                : c.members
                                  ? memberLine(c.members, me)
                                  : "No messages yet"}
                            </span>
                            <UnreadCount n={c.unread} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {!loadingList && !listError && (
            <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2">
              {plural(shown.length, "conversation")}, newest first
            </p>
          )}
        </section>

        {/* ---------------- thread ---------------- */}
        <section
          aria-label={selected ? `Conversation with ${selected.name}` : "Conversation"}
          className={cn("flex min-h-[520px] min-w-0 flex-col rounded-[10px] bg-tile lg:min-h-0", region !== "thread" && "max-lg:hidden", detailsOpen && "lg:max-xl:hidden")}
        >
          {opening ? (
            <div className="flex flex-1 flex-col" role="status" aria-label="Opening the conversation">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className="size-9 rounded-full bg-tile-hi" />
                <span className="h-3.5 w-28 rounded bg-tile-hi" />
              </div>
              <div className="flex-1 space-y-3 p-4">
                <span className="block h-10 w-2/3 max-w-[360px] rounded-[10px] bg-tile-hi" />
                <span className="block h-10 w-1/2 max-w-[280px] rounded-[10px] bg-tile-hi" />
              </div>
            </div>
          ) : !selected ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-[34ch]">
                <h2 className="text-[17px] font-semibold text-ink">Pick a conversation</h2>
                <p className="mt-1 text-sm text-ink-2">
                  {totalUnread ? `${plural(unreadThreads.length, "conversation")} ${unreadThreads.length === 1 ? "has" : "have"} unread messages.` : "Everything is read."} Opening one marks it read.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Back to conversations"
                  onClick={() => router.push("/dashboard/messages")}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                {selected.members ? <GroupMark members={selected.members} me={me} /> : <Initials name={selected.name} />}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold text-ink">{selected.name}</h2>
                  <p className="truncate text-[13px] text-ink-2" suppressHydrationWarning>
                    {selected.members
                      ? memberLine(selected.members, me)
                      : details
                      ? `Prefers ${contactLabel(details.creator.preferredContact)} · ${
                          details.creator.lastLoginAt ? `last seen ${ago(details.creator.lastLoginAt)}` : "not signed in yet"
                        }`
                      : selected.type === "CREATOR"
                        ? "Creator"
                        : selected.type === "GROUP"
                          ? "Team group"
                          : "Team"}
                  </p>
                </div>
                {(selected.creatorId || selected.members) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="xl:hidden"
                    aria-pressed={detailsOpen}
                    onClick={() => setDetailsOpen(true)}
                  >
                    {selected.members ? <Users aria-hidden="true" /> : <Info aria-hidden="true" />}
                    <span className="max-sm:sr-only">{selected.members ? "Members" : "Details"}</span>
                  </Button>
                )}
              </header>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
                {hasMore && (
                  <div className="mb-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingThread}
                      onClick={() => selectedId && messages[0] && void loadThread(selectedId, messages[0].createdAt)}
                    >
                      Load earlier messages
                    </Button>
                  </div>
                )}
                {loadingThread && messages.length === 0 ? (
                  <div className="grid h-full place-items-center">
                    <Loader2 className="size-5 animate-spin text-icon" aria-label="Loading messages" />
                  </div>
                ) : threadError ? (
                  <EmptyLine>
                    This conversation could not be loaded.{" "}
                    <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => selectedId && void loadThread(selectedId)}>
                      Try again
                    </button>
                  </EmptyLine>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-2">No messages yet. Say hello below.</p>
                ) : (
                  <ol className="space-y-3">
                    {messages.map((m, i) => {
                      const prev = messages[i - 1];
                      const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                      return (
                        <React.Fragment key={m.id}>
                          {newDay && (
                            <li className="py-1 text-center text-[12.5px] font-medium text-ink-2" aria-hidden="true" suppressHydrationWarning>
                              {dayLabel(m.createdAt)}
                            </li>
                          )}
                          {i === dividerAt && (
                            <li className="flex items-center gap-3 py-1 text-[12.5px] font-semibold text-ink">
                              <span className="h-px flex-1 bg-ctl" aria-hidden="true" />
                              New since you last read
                              <span className="h-px flex-1 bg-ctl" aria-hidden="true" />
                            </li>
                          )}
                          <li data-msg={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
                            <div
                              className={cn(
                                "max-w-[min(560px,85%)] whitespace-pre-wrap break-words rounded-[10px] px-3.5 py-2.5 text-[15px] leading-snug text-ink",
                                m.mine ? "bg-raised-hi" : "bg-tile-hi"
                              )}
                            >
                              <MessageText text={m.content} />
                              {m.forwarded.length > 0 && (
                                <ul className="mt-2 space-y-1 text-[13px]">
                                  {m.forwarded.map((f) => (
                                    <li key={`${f.type}-${f.id}`} className="text-ink-2">
                                      {f.type === "request" ? (
                                        <Link className="text-ink underline underline-offset-[3px]" href={`/dashboard/requests/${f.id}`}>
                                          {f.title ?? "A request"}
                                        </Link>
                                      ) : (
                                        <>Shared file: {f.title ?? "an upload"}</>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <span className="mt-1 text-[12px] text-ink-2" suppressHydrationWarning>
                              {m.mine ? "You" : m.author.split(/\s+/)[0]}, {clock(m.createdAt)}
                            </span>
                          </li>
                        </React.Fragment>
                      );
                    })}
                  </ol>
                )}
              </div>

              <form
                className="border-t border-line p-3 sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <label htmlFor="composer" className="sr-only">
                  Reply to {selected.name}
                </label>
                {selected.members ? (
                  // Team groups: type @ to mention a member of this group
                  <MentionInput
                    key={selected.id}
                    id="composer"
                    value={draft}
                    onChange={(v) => setDraft(v.slice(0, 5000))}
                    onSubmit={() => void send()}
                    onlyUserIds={groupOthers}
                    suggestionsAbove
                    placeholder={`Message ${selected.name}`}
                    rows={2}
                    className="min-h-[64px]"
                  />
                ) : (
                  <Textarea
                    id="composer"
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={`Reply to ${first}`}
                    rows={2}
                    className="min-h-[64px] resize-none"
                    maxLength={5000}
                  />
                )}
                <div className="mt-2 flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-[12.5px] text-ink-2">
                    {selected.type === "CREATOR"
                      ? `${first} reads this in their portal. `
                      : selected.members
                        ? "Only the people in this group see it. Type @ to mention one of them. "
                        : ""}
                    <span className="max-sm:hidden">
                      <kbd className="font-mono text-[12px]">Enter</kbd> sends, <kbd className="font-mono text-[12px]">Shift</kbd>+
                      <kbd className="font-mono text-[12px]">Enter</kbd> adds a line.
                    </span>
                  </p>
                  <Button type="submit" disabled={!draft.trim() || sending}>
                    {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
                    Reply
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* ---------------- details ---------------- */}
        <aside
          aria-label="Details"
          className={cn(
            "min-h-0 min-w-0 overflow-y-auto",
            region !== "details" && "max-lg:hidden",
            !detailsOpen && "lg:max-xl:hidden",
            !selected && !opening && "hidden",
            "max-xl:rounded-[10px] max-xl:bg-tile max-xl:p-4"
          )}
        >
          {selected && (
            <div className="mb-3 flex items-center gap-2 xl:hidden">
              <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(false)}>
                <X aria-hidden="true" />
                Back to the conversation
              </Button>
            </div>
          )}
          {selected?.members ? (
            <GroupPanel
              key={selected.id}
              group={selected}
              me={me}
              onUpdate={(change) => updateGroup(selected.id, change)}
              onLeave={() => leaveGroup(selected.id)}
            />
          ) : (
            <ThreadDetails selected={selected} details={details} />
          )}
        </aside>
      </div>

      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} onCreate={createConversation} currentUserId={me} />
      <NewGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        onCreate={(ids, name) => createConversation(ids, name)}
        currentUserId={me}
      />
    </div>
  );
}

// ---------------------------------------------------------------- details column

function ThreadDetails({ selected, details }: { selected: Convo | null; details: Details | null }) {
  if (!selected) return null;
  if (!selected.creatorId) {
    return <p className="px-1 text-sm text-ink-2">A team conversation. Only staff see it.</p>;
  }
  if (!details) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-5 w-32 rounded bg-tile-hi" />
        <div className="h-40 rounded-[10px] bg-tile-hi" />
      </div>
    );
  }
  const c = details.creator;
  const first = c.name.split(/\s+/)[0];
  const r = details.active[0];
  const usual = usualPhrase(details.delivery.usualDaysEarly);
  return (
    <div className="space-y-6">
      <section aria-labelledby="det-req">
        <h3 id="det-req" className="mb-2 text-[15px] font-semibold text-ink">
          {details.active.length > 1 ? `Active request, 1 of ${details.active.length}` : "Active request"}
        </h3>
        {r ? (
          <div className="max-w-[300px]">
            <TitleCard title={r.title} creator={c.name} fields={r.fields} due={r.due} href={`/dashboard/requests/${r.id}`} headingLevel="h4" />
          </div>
        ) : (
          <p className="text-sm text-ink-2">Nothing open for {first}.</p>
        )}
        {r && (
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/dashboard/requests/${r.id}`}>Open request</Link>
          </Button>
        )}
      </section>
      <section aria-labelledby="det-who" className="rounded-[10px] bg-tile p-4 xl:bg-tile">
        <h3 id="det-who" className="mb-2 text-[15px] font-semibold text-ink">
          {c.name}
        </h3>
        <dl className="divide-y divide-line text-sm">
          {[
            ["Prefers", contactLabel(c.preferredContact)],
            ["Time zone", cityOf(c.timezone)],
            ["Quiet hours", quietLabel(details.quiet)],
            ["Last seen", c.lastLoginAt ? ago(c.lastLoginAt) : "Not yet"],
            [
              "Finished",
              details.delivery.finished ? `${details.delivery.onTime} of ${details.delivery.finished} on time` : "None yet",
            ],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <dt className="text-ink-2">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-ink" suppressHydrationWarning>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        {usual && (
          <p className="mt-2">
            <Pill tone="neutral">{usual.replace(/^usually/, "Usually")}</Pill>
          </p>
        )}
        <Link
          href={`/dashboard/creators/${c.id}`}
          className="mt-3 inline-block text-sm font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
        >
          Open {first}&rsquo;s profile
        </Link>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- new conversation

interface Person {
  id: string;
  name: string;
  email: string;
  isCreator?: boolean;
}

function NewConversationDialog({
  open,
  onOpenChange,
  onCreate,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (participantIds: string[], name?: string, creatorId?: string) => Promise<boolean>;
  currentUserId: string;
}) {
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<"team" | "creators">("creators");
  const [results, setResults] = React.useState<Person[]>([]);
  const [picked, setPicked] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (kind === "team") {
          // Both endpoints exclude creator pseudo-users (src/lib/staff.ts)
          const endpoint = query.trim() ? `/api/users/search?q=${encodeURIComponent(query)}` : "/api/team/members";
          const res = await fetch(endpoint);
          if (res.ok) {
            const d = await res.json();
            const list: Person[] = d.users ?? d.members ?? [];
            setResults(list.filter((u) => u.id !== currentUserId && !u.email?.endsWith(".internal")));
          }
        } else {
          const qs = query.trim() ? `search=${encodeURIComponent(query)}&` : "";
          const res = await fetch(`/api/creators?${qs}limit=50`);
          if (res.ok) {
            const d = await res.json();
            setResults((d.data ?? []).map((c: Person) => ({ ...c, isCreator: true })));
          }
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind, open, currentUserId]);

  const reset = () => {
    setPicked([]);
    setQuery("");
    setKind("creators");
  };

  const creator = picked.find((p) => p.isCreator);

  const create = async () => {
    if (!picked.length) return;
    setCreating(true);
    const ok = creator ? await onCreate([], undefined, creator.id) : await onCreate([picked[0].id]);
    setCreating(false);
    if (ok) reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>Message a creator, or one person on the team. For several teammates, use New group.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {picked.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Chosen">
              {picked.map((p) => (
                <li key={p.id} className="inline-flex h-8 items-center gap-1 rounded-full bg-tile pl-3 pr-1 text-sm text-ink">
                  {p.name}
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}
                    className="grid size-6 place-items-center rounded-full text-icon hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!creator && (
            <div role="group" aria-label="Who" className="inline-flex rounded-[8px] bg-well p-0.5">
              {(["creators", "team"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => {
                    setKind(k);
                    setQuery("");
                  }}
                  className={cn(
                    "h-9 rounded-[7px] px-3 text-sm font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring md:h-8",
                    kind === k && "bg-tile-hi text-ink"
                  )}
                >
                  {k === "creators" ? "A creator" : "A teammate"}
                </button>
              ))}
            </div>
          )}
          <div>
            <label htmlFor="people-search" className="mb-1.5 block text-sm font-medium">
              {kind === "team" ? "Search the team" : "Search creators"}
            </label>
            <Input
              id="people-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              disabled={!!creator}
            />
          </div>
          {!creator && results.length > 0 && (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-[8px] bg-well p-1">
              {results.map((p) => {
                const on = picked.some((x) => x.id === p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={on}
                      onClick={() => setPicked(kind === "creators" ? [{ ...p, isCreator: true }] : [p])}
                      className="flex w-full items-center gap-3 rounded-[7px] p-2 text-left hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-ring disabled:text-ink-2"
                    >
                      <Initials name={p.name} className="size-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-2">{p.email}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {loading && <p className="text-sm text-ink-2">Searching</p>}
          {query && !loading && results.length === 0 && (
            <p className="text-sm text-ink-2">No {kind === "team" ? "team member" : "creator"} matches &ldquo;{query}&rdquo;.</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!picked.length || creating}>
              {creating
                ? "Starting"
                : picked[0]
                  ? `Message ${picked[0].name.split(/\s+/)[0]}`
                  : "Start conversation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- team groups

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "?";
}

/** "You, Riley and Jordan" (you first, then first names) */
function memberLine(members: Member[], me: string): string {
  const others = members.filter((m) => m.id !== me).map((m) => m.name.split(/\s+/)[0]);
  const names = members.some((m) => m.id === me) ? ["You", ...others] : others;
  if (names.length <= 1) return names[0] ?? "No members";
  if (names.length > 4) return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * A team group's mark: the first letters of up to three members on a rounded
 * square, so a group never reads as a creator's round initials disc.
 */
function GroupMark({ members, me, active }: { members: Member[]; me: string; active?: boolean }) {
  const shown = [...members.filter((m) => m.id !== me), ...members.filter((m) => m.id === me)].slice(0, 3);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-[8px] text-[12px] font-bold tracking-[0.04em] text-ink",
        active ? "bg-raised" : "bg-tile-hi group-hover:bg-raised"
      )}
    >
      {shown.map((m) => initialsOf(m.name)[0]).join("")}
    </span>
  );
}

/** Message text with @mentions set in a heavier weight, never as raw @[Name](id) */
function MessageText({ text }: { text: string }) {
  if (!text.includes("@[")) return <>{text}</>;
  return (
    <>
      {textToMentionSegments(text).map((seg, i) =>
        seg.type === "mention" ? (
          <span key={i} className="font-semibold">
            @{seg.username}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.content}</React.Fragment>
        )
      )}
    </>
  );
}

/** The agency's staff (creator pseudo-users are excluded by the API, src/lib/staff.ts) */
function useTeam(enabled: boolean) {
  const [team, setTeam] = React.useState<Person[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || team) return;
    let live = true;
    fetch("/api/team/members")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("team"))))
      .then((d) => {
        if (!live) return;
        const list: Person[] = (d.members ?? []).filter((u: Person) => !u.email?.endsWith(".internal"));
        setTeam(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [enabled, team]);
  return { team, failed };
}

function GroupPanel({
  group,
  me,
  onUpdate,
  onLeave,
}: {
  group: Convo;
  me: string;
  onUpdate: (change: { name?: string; add?: string[]; remove?: string[] }) => Promise<boolean>;
  onLeave: () => Promise<void>;
}) {
  const members = group.members ?? [];
  const { team, failed } = useTeam(true);
  const [name, setName] = React.useState(group.name);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const ordered = [...members.filter((m) => m.id === me), ...members.filter((m) => m.id !== me)];
  const outside = (team ?? []).filter((t) => !members.some((m) => m.id === t.id));
  const trimmed = name.replace(/\s+/g, " ").trim();
  const canRename = !!trimmed && trimmed !== group.name;

  return (
    <div className="space-y-6 xl:space-y-4">
      <form
        aria-labelledby="grp-name"
        className="xl:rounded-[10px] xl:bg-tile xl:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canRename) return;
          void run("rename", async () => {
            if (await onUpdate({ name: trimmed })) toast(`Renamed to ${trimmed}.`);
          });
        }}
      >
        <h3 id="grp-name" className="mb-2 text-[15px] font-semibold text-ink">
          <label htmlFor="group-rename">Group name</label>
        </h3>
        <Input id="group-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="mt-2 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-[13px] text-ink-2">Only the people in this group can see it or read it.</p>
          <Button type="submit" variant="outline" size="sm" disabled={!canRename || busy === "rename"}>
            {busy === "rename" && <Loader2 className="animate-spin" aria-hidden="true" />}
            Rename
          </Button>
        </div>
      </form>

      <section aria-labelledby="grp-members" className="xl:rounded-[10px] xl:bg-tile xl:p-4">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 id="grp-members" className="text-[15px] font-semibold text-ink">
            Members
          </h3>
          <span className="text-[13px] tabular-nums text-ink-2">{plural(members.length, "person", "people")}</span>
        </div>
        <ul className="divide-y divide-line">
          {ordered.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <Initials name={m.name} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {m.name}
                {m.id === me && <span className="font-normal text-ink-2"> (you)</span>}
              </span>
              {m.id !== me && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={members.length <= 2 || busy === `rm-${m.id}`}
                  title={members.length <= 2 ? "A group needs at least two people" : undefined}
                  aria-label={`Remove ${m.name} from the group`}
                  onClick={() =>
                    void run(`rm-${m.id}`, async () => {
                      if (await onUpdate({ remove: [m.id] })) toast(`${m.name} was removed from the group.`);
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="mt-2 border-t border-line pt-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">Add a teammate</h4>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Done
              </Button>
            </div>
            {failed ? (
              <p className="text-sm text-ink-2">The team could not be loaded. Reload the page and try again.</p>
            ) : !team ? (
              <p className="text-sm text-ink-2">Loading the team</p>
            ) : outside.length === 0 ? (
              <p className="text-sm text-ink-2">Everyone on the team is already in this group.</p>
            ) : (
              <ul>
                {outside.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-1.5">
                    <Initials name={p.name} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-2">{p.email}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === `add-${p.id}`}
                      aria-label={`Add ${p.name} to the group`}
                      onClick={() =>
                        void run(`add-${p.id}`, async () => {
                          if (await onUpdate({ add: [p.id] })) toast(`${p.name} was added to the group.`);
                        })
                      }
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden="true" />
            Add a teammate
          </Button>
        )}
      </section>

      {confirmLeave ? (
        <div className="rounded-[10px] bg-tile-hi p-4 xl:bg-tile" role="group" aria-label="Leave the group">
          <p className="text-sm text-ink">Leave {group.name}? You stop seeing its messages until someone adds you back.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy === "leave"} onClick={() => void run("leave", onLeave)}>
              {busy === "leave" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              Leave group
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>
              Stay in the group
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => setConfirmLeave(true)}>
          <LogOut aria-hidden="true" />
          Leave group
        </Button>
      )}
    </div>
  );
}

function NewGroupDialog({
  open,
  onOpenChange,
  onCreate,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (participantIds: string[], name: string) => Promise<boolean>;
  currentUserId: string;
}) {
  const { team, failed } = useTeam(open);
  const [name, setName] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [tried, setTried] = React.useState(false);

  const reset = () => {
    setName("");
    setQuery("");
    setPicked([]);
    setTried(false);
  };

  const people = (team ?? []).filter((p) => p.id !== currentUserId);
  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) : people;
  const trimmed = name.replace(/\s+/g, " ").trim();
  const nameMissing = tried && !trimmed;
  const tooFew = tried && picked.length < 2;

  const create = async () => {
    setTried(true);
    if (!trimmed || picked.length < 2) return;
    setCreating(true);
    const ok = await onCreate(picked, trimmed);
    setCreating(false);
    if (ok) reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>A thread for you and two or more people on the team. Creators never see it.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div>
            <label htmlFor="new-group-name" className="mb-1.5 block text-sm font-medium">
              Group name
            </label>
            <Input
              id="new-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend shoots"
              maxLength={60}
              aria-invalid={nameMissing || undefined}
              aria-describedby={nameMissing ? "new-group-name-err" : undefined}
            />
            {nameMissing && (
              <p id="new-group-name-err" className="mt-1.5 text-[13px] text-late">
                Give the group a name.
              </p>
            )}
          </div>
          <fieldset aria-describedby={tooFew ? "new-group-few" : undefined}>
            <legend className="mb-1.5 text-sm font-medium">
              Team members <span className="font-normal text-ink-2">({picked.length} chosen, at least 2)</span>
            </legend>
            <label className="relative mb-2 block">
              <span className="sr-only">Search the team</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" className="pl-9" />
            </label>
            {failed ? (
              <p className="text-sm text-ink-2">The team could not be loaded. Close this and try again.</p>
            ) : !team ? (
              <p className="text-sm text-ink-2">Loading the team</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-ink-2">
                {q ? <>No team member matches &ldquo;{query.trim()}&rdquo;.</> : "There is no one else on the team yet."}
              </p>
            ) : (
              <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-[8px] bg-well p-1">
                {shown.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPicked((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[7px] p-2 text-left hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-ring",
                          on && "bg-tile-hi"
                        )}
                      >
                        <Initials name={p.name} className="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-[12.5px] text-ink-2">{p.email}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-[5px] border",
                            on ? "border-ink bg-ink text-ground" : "border-ctl"
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {tooFew && (
              <p id="new-group-few" className="mt-1.5 text-[13px] text-late">
                Pick at least two team members.
              </p>
            )}
          </fieldset>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating" : "Create group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
