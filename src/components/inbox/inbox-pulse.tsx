"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAccess } from "@/lib/access/client";

/**
 * Keeps staff screens current without a refresh. While a tab is open it asks
 * /api/inbox/pulse what arrived since the last check (every few seconds when
 * the tab is in front, less often behind other tabs), then:
 *  - keeps the Messages badge's unread count right (useInboxUnread)
 *  - pops up who wrote, unless that conversation is already open in front of you
 *  - tells an open Messages page or Comments badge to refresh
 *    (window events "inbox:new" and "creator-messages:new")
 */

export const INBOX_NEW_EVENT = "inbox:new";
export const COMMENTS_NEW_EVENT = "creator-messages:new";
export interface InboxNewDetail {
  conversationIds: string[];
}

const FRONT_MS = 5_000;
const BEHIND_MS = 30_000;

interface PulseMessage {
  id: string;
  conversationId: string;
  from: string;
  group: string | null;
  preview: string;
}
interface PulseComment {
  id: string;
  requestId: string | null;
  from: string;
}

const UnreadContext = React.createContext(0);
/** Conversations with unread messages, for the Messages badge */
export const useInboxUnread = () => React.useContext(UnreadContext);

export function InboxPulse({ children }: { children: React.ReactNode }) {
  const { can } = useAccess();
  const inbox = can("messages.creators") || can("messages.team");
  const comments = can("requests.view");
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);

  const refreshUnread = React.useCallback(async () => {
    if (!inbox) return;
    try {
      const res = await fetch("/api/inbox/unread", { cache: "no-store" });
      if (res.ok) setUnread(Number((await res.json()).count) || 0);
    } catch {
      /* the next check tries again */
    }
  }, [inbox]);

  React.useEffect(() => {
    if (!inbox && !comments) return;
    let since: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const seen = new Set<string>();

    const tell = (msgs: PulseMessage[], notes: PulseComment[]) => {
      const front = document.visibilityState === "visible";
      // Where the person is right now
      const path = window.location.pathname;
      const open = new URLSearchParams(window.location.search).get("conversation");
      // One pop-up per conversation, newest wording
      const byConvo = new Map<string, { m: PulseMessage; n: number }>();
      for (const m of msgs) byConvo.set(m.conversationId, { m, n: (byConvo.get(m.conversationId)?.n ?? 0) + 1 });
      for (const [id, { m, n }] of byConvo) {
        const reading = front && path === "/dashboard/messages" && open === id;
        if (reading) continue;
        toast(m.group ? `${m.from} in ${m.group}` : m.from, {
          id: `msg-${id}`,
          description: n > 1 ? `${n} new messages. ${m.preview}` : m.preview,
          action: { label: "Open", onClick: () => router.push(`/dashboard/messages?conversation=${id}`) },
        });
      }
      const byRequest = new Map<string, PulseComment>();
      for (const c of notes) byRequest.set(c.requestId ?? c.id, c);
      for (const [, c] of byRequest) {
        if (front && c.requestId && path === `/dashboard/requests/${c.requestId}`) continue;
        toast(`${c.from} left a comment`, {
          id: `comment-${c.requestId ?? c.id}`,
          action: c.requestId ? { label: "Open", onClick: () => router.push(`/dashboard/requests/${c.requestId}`) } : undefined,
        });
      }
    };

    const check = async () => {
      clearTimeout(timer);
      try {
        const res = await fetch(`/api/inbox/pulse${since ? `?since=${encodeURIComponent(since)}` : ""}`, { cache: "no-store" });
        if (res.ok) {
          const data: { now: string; messages: PulseMessage[]; comments: PulseComment[] } = await res.json();
          since = data.now;
          const msgs = (data.messages ?? []).filter((m) => !seen.has(m.id));
          const notes = (data.comments ?? []).filter((c) => !seen.has(c.id));
          for (const x of [...msgs, ...notes]) seen.add(x.id);
          if (msgs.length) {
            window.dispatchEvent(new CustomEvent<InboxNewDetail>(INBOX_NEW_EVENT, { detail: { conversationIds: [...new Set(msgs.map((m) => m.conversationId))] } }));
            void refreshUnread();
          }
          if (notes.length) window.dispatchEvent(new Event(COMMENTS_NEW_EVENT));
          if (msgs.length || notes.length) tell(msgs, notes);
        }
      } catch {
        /* offline for a moment: the next check catches up (up to 10 minutes back) */
      }
      if (!stopped) timer = setTimeout(check, document.visibilityState === "visible" ? FRONT_MS : BEHIND_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void refreshUnread();
    void check();
    document.addEventListener("visibilitychange", onVisible);
    const onRead = () => void refreshUnread();
    window.addEventListener("inbox:read", onRead);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("inbox:read", onRead);
    };
  }, [inbox, comments, refreshUnread, router]);

  return <UnreadContext.Provider value={inbox ? unread : 0}>{children}</UnreadContext.Provider>;
}
