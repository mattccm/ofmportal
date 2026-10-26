"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDay, useViewerTimeZone } from "@/components/title-wall";
import { localDay, zonedParts } from "@/lib/due";
import { STATUS_WORD } from "@/components/portal/creator-words";
import { cn } from "@/lib/utils";

interface ForwardedItem {
  type: string;
  id: string;
  data?: { id: string; originalName?: string; title?: string; status?: string };
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  /** true when the creator wrote it */
  mine: boolean;
  /** The team member's first name ("Sam") */
  from?: string;
  forwardedContent?: ForwardedItem[];
}

interface RequestThread {
  id: string;
  title: string;
  status: string;
  messages: ChatMessage[];
}

const DESKTOP = "(min-width: 1024px)";

/** True from 1024px: the list and the conversation sit side by side */
function useDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false
  );
}

/* Every moment here reads in the creator's own time zone */
function timeOf(iso: string, tz: string) {
  const z = zonedParts(new Date(iso), tz);
  return `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

function dayKey(iso: string, tz: string) {
  return localDay(iso, tz);
}

function dayLabel(iso: string, tz: string) {
  const now = Date.now();
  const k = dayKey(iso, tz);
  if (k === dayKey(new Date(now).toISOString(), tz)) return "Today";
  if (k === dayKey(new Date(now - 86_400_000).toISOString(), tz)) return "Yesterday";
  return formatDay(iso, tz);
}

function token() {
  try {
    return localStorage.getItem("creatorToken") || "";
  } catch {
    return "";
  }
}

/** Who wrote it: "You", or the team member's first name */
function senderName(m: ChatMessage) {
  return m.mine ? "You" : m.from || "Your team";
}

/** The conversation, oldest first, with a day line where the day changes */
function Timeline({ messages, emptyText }: { messages: ChatMessage[]; emptyText: string }) {
  const tz = useViewerTimeZone();
  if (messages.length === 0) {
    return <p className="mt-6 text-center text-[15px] leading-normal text-ink-2">{emptyText}</p>;
  }
  return (
    <ol className="mt-4 space-y-3" aria-label="Messages">
      {messages.map((m, i) => {
        const newDay = i === 0 || dayKey(messages[i - 1].createdAt, tz) !== dayKey(m.createdAt, tz);
        return (
          <li key={m.id}>
            {newDay && (
              <p className="mb-3 mt-5 text-center text-[13px] font-medium text-ink-2 first:mt-0">
                {dayLabel(m.createdAt, tz)}
              </p>
            )}
            <div className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-[12px] px-3.5 py-2.5 lg:max-w-[70%]",
                  m.mine ? "bg-tile-hi" : "bg-tile"
                )}
              >
                {m.content && (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-normal">{m.content}</p>
                )}
                {m.forwardedContent && m.forwardedContent.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {m.forwardedContent.map((item, idx) => (
                      <li
                        key={`${item.id}-${idx}`}
                        className="flex items-center gap-2 rounded-md bg-well px-2.5 py-2 text-[14px]"
                      >
                        {item.type === "request" ? (
                          <>
                            <FileText className="size-4 shrink-0 text-icon" aria-hidden="true" />
                            {item.data?.id ? (
                              <Link href={`/creator/requests/${item.data.id}`} className="truncate underline underline-offset-[3px]">
                                {item.data?.title || "A request"}
                              </Link>
                            ) : (
                              <span className="truncate">{item.data?.title || "A request"}</span>
                            )}
                          </>
                        ) : (
                          <>
                            {/* No thumbnail here: previews stay out of the chat */}
                            <ImageIcon className="size-4 shrink-0 text-icon" aria-hidden="true" />
                            <span className="truncate">{item.data?.originalName || "A file"}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                {senderName(m)} · {timeOf(m.createdAt, tz)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The composer. On a phone it is pinned above the tab bar (at the foot on a
 * tablet); on a desktop it is docked at the bottom of the conversation panel.
 */
function Composer({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  docked = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  docked?: boolean;
}) {
  const form = (
    <form
      className={cn(
        docked
          ? "border-t border-line"
          : "fixed inset-x-0 z-30 border-t border-line bg-ground bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:pb-[env(safe-area-inset-bottom,0px)]"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 py-3",
          docked
            ? "px-4"
            : "mx-auto max-w-[560px] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:max-w-[720px]"
        )}
      >
        <label htmlFor="composer" className="sr-only">
          {placeholder}
        </label>
        <Textarea
          id="composer"
          rows={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; Shift+Enter is a new line
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
              e.preventDefault();
              onSend();
            }
          }}
          className={cn("max-h-36 resize-none", docked ? "min-h-11 py-2.5" : "min-h-12 py-3")}
        />
        <Button
          type="submit"
          className={cn("shrink-0 px-4 text-[15px]", docked ? "h-11" : "h-12")}
          disabled={!value.trim() || sending}
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          Send
        </Button>
      </div>
    </form>
  );
  if (docked) return form;
  return (
    <>
      <div aria-hidden="true" className="h-24" />
      {form}
    </>
  );
}

export default function CreatorMessagesPage() {
  const router = useRouter();
  const tz = useViewerTimeZone();
  const desktop = useDesktop();
  const [view, setView] = useState<"team" | "requests">("team");
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamFailed, setTeamFailed] = useState(false);
  const [teamMessages, setTeamMessages] = useState<ChatMessage[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threads, setThreads] = useState<RequestThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrolledFor = useRef<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const fetchTeam = useCallback(async () => {
    setTeamFailed(false);
    try {
      const res = await fetch("/api/portal/inbox", { headers: { "x-creator-token": token() } });
      if (!res.ok) throw new Error("inbox");
      const data = await res.json();
      const list: Array<{
        id: string;
        content: string;
        createdAt: string;
        isFromCreator: boolean;
        sender?: { name?: string } | null;
        forwardedContent?: ForwardedItem[];
      }> = data.messages || [];
      setTeamMessages(
        list.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
          mine: m.isFromCreator,
          from: m.sender?.name,
          forwardedContent: m.forwardedContent,
        }))
      );
    } catch {
      setTeamFailed(true);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/requests", { headers: { "x-creator-token": token() } });
      if (!res.ok) throw new Error("requests");
      const requests: Array<{ id: string; title: string; status: string }> = await res.json();
      const withMessages = await Promise.all(
        requests.map(async (r) => {
          try {
            // The side-effect-free comments endpoint (the request detail route
            // marks the request viewed and signs upload previews)
            const c = await fetch(`/api/portal/requests/${r.id}/comments`, { headers: { "x-creator-token": token() } });
            const data = c.ok ? await c.json() : [];
            const comments: Array<{ id: string; content: string; createdAt: string; isAgency: boolean; user?: { name: string } }> =
              Array.isArray(data) ? data : [];
            return {
              id: r.id,
              title: r.title,
              status: r.status,
              messages: comments.map((m) => ({
                id: m.id,
                content: m.content,
                createdAt: m.createdAt,
                mine: !m.isAgency,
                from: m.isAgency ? m.user?.name : undefined,
              })),
            };
          } catch {
            return { id: r.id, title: r.title, status: r.status, messages: [] };
          }
        })
      );
      // Conversations first (most recent message first), then the open requests without one
      withMessages.sort((a, b) => {
        const la = a.messages.at(-1)?.createdAt;
        const lb = b.messages.at(-1)?.createdAt;
        if (la && lb) return new Date(lb).getTime() - new Date(la).getTime();
        if (la) return -1;
        if (lb) return 1;
        return 0;
      });
      setThreads(withMessages);
    } catch {
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token() || !localStorage.getItem("creatorId")) {
      router.push("/login");
      return;
    }
    fetchTeam();
    fetchThreads();
  }, [router, fetchTeam, fetchThreads]);

  const selected = threads.find((t) => t.id === selectedId) || null;
  const visibleMessages = view === "team" ? teamMessages : selected?.messages || [];
  const conversationKey = view === "team" ? "team" : selectedId;

  // Open a conversation at its latest message; follow new ones as they arrive.
  // A phone scrolls the page; a desktop scrolls the conversation panel.
  useLayoutEffect(() => {
    if (!conversationKey || (view === "team" && teamLoading)) return;
    const first = scrolledFor.current !== conversationKey;
    scrolledFor.current = conversationKey;
    const behavior: ScrollBehavior = first ? "auto" : "smooth";
    if (desktop) {
      const el = threadRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    }
  }, [conversationKey, visibleMessages.length, view, teamLoading, desktop]);

  const sendTeam = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch("/api/portal/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-creator-token": token() },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("send");
      const data = await res.json();
      setTeamMessages((prev) => [
        ...prev,
        {
          id: data.message.id,
          content: data.message.content,
          createdAt: data.message.createdAt,
          mine: true,
          forwardedContent: data.message.forwardedContent,
        },
      ]);
      setDraft("");
    } catch {
      toast.error("Your message didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const sendRequest = async () => {
    const text = draft.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/requests/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-creator-token": token() },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("send");
      const msg: ChatMessage = { id: `local-${Date.now()}`, content: text, createdAt: new Date().toISOString(), mine: true };
      setThreads((prev) => prev.map((t) => (t.id === selected.id ? { ...t, messages: [...t.messages, msg] } : t)));
      setDraft("");
    } catch {
      toast.error("Your message didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const openTeam = () => {
    setView("team");
    setSelectedId(null);
  };
  const openThread = (id: string) => {
    setView("requests");
    setSelectedId(id);
  };

  const lastFromTeam = [...teamMessages].reverse().find((m) => !m.mine);
  const teamLede = lastFromTeam
    ? `Your conversation with your team. ${lastFromTeam.from || "Your team"} last wrote ${formatDay(lastFromTeam.createdAt, tz)}.`
    : "Your conversation with your team. Ask anything, any time.";

  const teamEmpty = "No messages yet. Write to your team below; they usually reply the same day.";
  const threadEmpty = "No messages about this request yet. Ask anything below.";

  const teamState = teamLoading ? (
    <div className="mt-5 space-y-3" role="status" aria-label="Loading messages">
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="ml-auto h-12 w-2/3" />
      <Skeleton className="h-20 w-4/5" />
    </div>
  ) : teamFailed ? (
    <div className="mt-5 rounded-[10px] bg-tile p-4">
      <p className="text-[15px]">Your messages didn&apos;t load. Check your connection, then try again.</p>
      <Button variant="outline" className="mt-3 h-11 md:h-9" onClick={() => { setTeamLoading(true); fetchTeam(); }}>
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  ) : null;

  /* ---------- Desktop: the conversation list beside the open conversation ---------- */
  if (desktop) {
    const lastTeam = teamMessages.at(-1);
    return (
      <div className="px-6 pt-10">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">Messages</h1>
        <p className="mt-1 text-[15px] leading-normal text-ink-2">
          Your team, and notes on each request. Enter sends; Shift+Enter adds a new line.
        </p>

        <div className="mt-6 grid h-[calc(100dvh-11rem)] min-h-[480px] grid-cols-[minmax(260px,320px)_minmax(0,1fr)] overflow-hidden rounded-[10px] border border-line">
          <nav aria-label="Conversations" className="flex min-h-0 flex-col border-r border-line bg-tile">
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              <li>
                <ConversationItem
                  current={view === "team"}
                  onClick={openTeam}
                  icon={<Users className="size-4 text-icon" aria-hidden="true" />}
                  title="Your team"
                  preview={lastTeam ? `${senderName(lastTeam)}: ${lastTeam.content}` : "No messages yet"}
                  when={lastTeam ? formatDay(lastTeam.createdAt, tz) : undefined}
                />
              </li>
              <li aria-hidden="true" className="px-3 pb-1 pt-3 text-[13px] font-medium text-ink-2">
                About a request
              </li>
              {threadsLoading ? (
                <li className="space-y-2 px-1" role="status" aria-label="Loading requests">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </li>
              ) : threads.length === 0 ? (
                <li className="px-3 py-2 text-[14px] leading-normal text-ink-2">
                  No open requests. When your team sends one, you can write about it here.
                </li>
              ) : (
                threads.map((t) => {
                  const last = t.messages.at(-1);
                  return (
                    <li key={t.id}>
                      <ConversationItem
                        current={view === "requests" && selectedId === t.id}
                        onClick={() => openThread(t.id)}
                        icon={<FileText className="size-4 text-icon" aria-hidden="true" />}
                        title={t.title}
                        preview={last ? `${senderName(last)}: ${last.content}` : `${STATUS_WORD[t.status] || "Open"} · no messages yet`}
                        when={last ? formatDay(last.createdAt, tz) : undefined}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </nav>

          <section aria-labelledby="thread-h" className="flex min-h-0 flex-col">
            <header className="flex min-h-16 items-center gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="thread-h" className="truncate text-[17px] font-semibold leading-snug">
                  {view === "team" ? "Your team" : selected ? selected.title : "About a request"}
                </h2>
                <p className="truncate text-[14px] text-ink-2">
                  {view === "team"
                    ? teamLede
                    : selected
                      ? STATUS_WORD[selected.status] || "Open"
                      : "Choose a request on the left."}
                </p>
              </div>
              {view === "requests" && selected && (
                <Button asChild variant="outline" className="shrink-0">
                  <Link href={`/creator/requests/${selected.id}`}>Open the request</Link>
                </Button>
              )}
            </header>

            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {view === "team"
                ? teamState ?? <Timeline messages={teamMessages} emptyText={teamEmpty} />
                : selected
                  ? <Timeline messages={selected.messages} emptyText={threadEmpty} />
                  : null}
            </div>

            {view === "team" && !teamLoading && !teamFailed && (
              <Composer docked value={draft} onChange={setDraft} onSend={sendTeam} sending={sending} placeholder="Message your team" />
            )}
            {view === "requests" && selected && (
              <Composer
                docked
                value={draft}
                onChange={setDraft}
                onSend={sendRequest}
                sending={sending}
                placeholder="Message your team about this request"
              />
            )}
          </section>
        </div>
      </div>
    );
  }

  /* ---------- Phone and tablet: one conversation at a time ---------- */
  return (
    <div className="px-4 pt-5">
      {view === "requests" && selected ? (
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-[15px] text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          All requests
        </button>
      ) : null}

      {view === "requests" && selected ? (
        <>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">{selected.title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {STATUS_WORD[selected.status] || "Open"} ·{" "}
            <Link href={`/creator/requests/${selected.id}`} className="text-ink underline underline-offset-[3px]">
              Open the request
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">Messages</h1>
          <p className="mt-1 text-[15px] leading-normal text-ink-2">
            {view === "team" ? teamLede : "Notes on each request, between you and your team."}
          </p>
          <div className="mt-4 inline-flex rounded-[var(--tw-r-ctl)] bg-well p-1" role="group" aria-label="Conversations">
            {(
              [
                ["team", "Your team"],
                ["requests", "About a request"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => {
                  setView(key);
                  setSelectedId(null);
                }}
                className={cn(
                  "min-h-11 rounded-md px-3.5 text-[14px] font-medium transition-colors md:min-h-9",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  view === key ? "!bg-tile-hi text-ink" : "text-ink-2 hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {view === "team" &&
        (teamState ?? (
          <>
            <Timeline messages={teamMessages} emptyText={teamEmpty} />
            <Composer value={draft} onChange={setDraft} onSend={sendTeam} sending={sending} placeholder="Message your team" />
          </>
        ))}

      {view === "requests" && !selected && (
        <section aria-label="Requests" className="mt-5">
          {threadsLoading ? (
            <div className="space-y-2" role="status" aria-label="Loading requests">
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-[15px] leading-normal text-ink-2">
              No open requests. When your team sends one, you can write about it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {threads.map((t) => {
                const last = t.messages.at(-1);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-center gap-3 rounded-[10px] bg-tile p-4 text-left transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold">{t.title}</span>
                        <span className="mt-0.5 block truncate text-[14px] text-ink-2">
                          {last
                            ? `${senderName(last)}: ${last.content}`
                            : `${STATUS_WORD[t.status] || "Open"} · no messages yet`}
                        </span>
                      </span>
                      {last && <span className="shrink-0 text-[13px] text-ink-2">{formatDay(last.createdAt, tz)}</span>}
                      <ChevronRight className="size-4 shrink-0 text-icon" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {view === "requests" && selected && (
        <>
          <Timeline messages={selected.messages} emptyText={threadEmpty} />
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={sendRequest}
            sending={sending}
            placeholder="Message your team about this request"
          />
        </>
      )}
    </div>
  );
}

/** A row in the desktop conversation list */
function ConversationItem({
  current,
  onClick,
  icon,
  title,
  preview,
  when,
}: {
  current: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  preview: string;
  when?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        current ? "bg-tile-hi text-ink" : "hover:bg-tile-hi"
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
          {when && <span className="shrink-0 text-[12px] text-ink-2">{when}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-2">{preview}</span>
      </span>
    </button>
  );
}
