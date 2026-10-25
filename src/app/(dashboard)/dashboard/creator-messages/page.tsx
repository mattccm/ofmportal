"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyLine, Initials, PageHead } from "@/components/creators/people-ui";
import { ago, plural } from "@/components/creators/insights";
import { useAccess } from "@/lib/access/client";
import { NoAccess } from "@/components/access/no-access";

interface CreatorMessage {
  id: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  request: { id: string; title: string; status: string } | null;
  creator: { id: string; name: string; avatar: string | null } | null;
}

interface MessagesResponse {
  messages: CreatorMessage[];
  total: number;
  unreadCount: number;
}

/** Request states in the product's words */
const STATE: Record<string, string> = {
  PENDING: "Not started",
  IN_PROGRESS: "Uploading",
  SUBMITTED: "Ready to review",
  UNDER_REVIEW: "In review",
  NEEDS_REVISION: "Needs changes",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export default function CreatorMessagesPage() {
  const { can, roleName } = useAccess();
  // Comments live on requests: the Comments nav item needs "See requests"
  if (!can("requests.view")) return <NoAccess what="creator comments" roleName={roleName} />;
  return <CreatorComments />;
}

function CreatorComments() {
  const [messages, setMessages] = useState<CreatorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/creator-messages?limit=100");
      if (!res.ok) throw new Error();
      const data: MessagesResponse = await res.json();
      setMessages(data.messages);
      setTotal(data.total);
      setUnreadAtOpen(data.unreadCount);
      // Viewing the page marks every comment read
      if (data.unreadCount > 0) {
        fetch("/api/creator-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAllRead: true }),
        })
          .then(() => window.dispatchEvent(new Event("creator-messages:read")))
          .catch(() => {});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const creators = new Set(messages.map((m) => m.creator?.id).filter(Boolean)).size;
  const lede = loading
    ? "Loading comments"
    : error
      ? "Comments could not be loaded."
      : total === 0
        ? "No comments from creators yet."
        : `${plural(total, "comment")} from ${plural(creators, "creator")} on their requests${unreadAtOpen ? `, ${unreadAtOpen} new since you last looked` : ""}. Opening this page marks them read.`;

  return (
    <div className="mx-auto max-w-[880px] space-y-6">
      <PageHead
        title="Comments"
        lede={lede}
        actions={
          <Button variant="outline" onClick={() => void fetchMessages()} disabled={loading}>
            <RefreshCw className={cn(loading && "motion-safe:animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {loading && messages.length === 0 ? (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-24 rounded-[10px] bg-tile motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : error ? (
        <EmptyLine>
          Comments could not be loaded.{" "}
          <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => void fetchMessages()}>
            Try again
          </button>
        </EmptyLine>
      ) : messages.length === 0 ? (
        <EmptyLine>
          When a creator writes a comment on one of their requests, it lands here and on the request itself. Direct messages are in{" "}
          <Link href="/dashboard/messages" className="font-medium text-ink underline underline-offset-[3px]">
            Messages
          </Link>
          .
        </EmptyLine>
      ) : (
        <ol className="space-y-2">
          {messages.map((m) => (
            <li key={m.id}>
              <article
                aria-label={`${m.creator?.name ?? "A creator"}${m.isRead ? "" : ", new"}`}
                className={cn("flex gap-3 rounded-[10px] p-4 sm:p-5", m.isRead ? "bg-tile" : "bg-tile-hi")}
              >
                <Initials name={m.creator?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {m.creator ? (
                      <Link href={`/dashboard/creators/${m.creator.id}`} className="font-semibold text-ink underline-offset-[3px] hover:underline">
                        {m.creator.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">A creator</span>
                    )}
                    {!m.isRead && <span className="text-[13px] font-semibold text-ink">New</span>}
                    <time className="ml-auto text-[13px] text-ink-2" dateTime={m.createdAt} suppressHydrationWarning>
                      {ago(m.createdAt)}
                    </time>
                  </p>
                  {m.request && (
                    <p className="text-[13px] text-ink-2">
                      on{" "}
                      <Link href={`/dashboard/requests/${m.request.id}`} className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
                        {m.request.title}
                      </Link>
                      {STATE[m.request.status] ? ` · ${STATE[m.request.status]}` : ""}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{m.message}</p>
                  {m.request && (
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link href={`/dashboard/requests/${m.request.id}`}>Reply on the request</Link>
                    </Button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
