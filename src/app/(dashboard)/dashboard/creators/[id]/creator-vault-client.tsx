"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Archive,
  Bell,
  Copy,
  Download,
  Edit2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditableCreatorName } from "@/components/editable";
import { ActivityTimelineWidget } from "@/components/activity/activity-timeline";
import { NotesPanel } from "@/components/notes/notes-panel";
import { type Note } from "@/lib/notes-utils";
import { CommunicationStatus } from "@/components/creators/communication-status";
import { CommunicationPreferencesForm } from "@/components/creators/communication-preferences-form";
import { ContactCreatorModal } from "@/components/creators/contact-creator-modal";
import { EditCreatorProfileModal } from "@/components/creators/edit-creator-profile-modal";
import { CreatorUploads, type VaultUpload } from "@/components/creators/creator-uploads";
import { OnTimeChart, type OnTimePoint } from "@/components/creators/on-time-chart";
import { CreatorInviteActions, type CreatorInviteUiState } from "@/components/creators/creator-invite-actions";
import { BackLink, EmptyLine, Panel, Pill, SectionHead, UnreadCount } from "@/components/creators/people-ui";
import {
  ago,
  cityOf,
  contactLabel,
  countState,
  creatorStatus,
  plural,
  quietLabel,
  usualPhrase,
  type DeliverySummary,
  type QuietHours,
} from "@/components/creators/insights";
import { Shelf, TitleCard, formatDay, timeLeft, type FieldSummary } from "@/components/title-wall";
import type { CommunicationPreferences } from "@/types/communication-preferences";
import { cn } from "@/lib/utils";

export interface ProfileData {
  creator: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    inviteStatus: string;
    /** Until they accept: the invite's state and when its link expires */
    invite?: { state: CreatorInviteUiState; expiresAt: string | null } | null;
    archivedAt: string | null;
    timezone: string;
    preferredContact: string;
    createdAt: string;
    lastLoginAt: string | null;
    notes: string | null;
    totalRequests: number;
    totalUploads: number;
  };
  quiet: QuietHours;
  pause: { paused: boolean; resumeAt: string | null };
  active: { id: string; title: string; kind: string | null; due: string | null; fields: FieldSummary[] }[];
  finished: {
    id: string;
    title: string;
    kind: string | null;
    status: string;
    due: string | null;
    finishedAt: string | null;
    daysEarly: number | null;
    onTime: boolean | null;
  }[];
  points: OnTimePoint[];
  delivery: DeliverySummary;
  thread: {
    id: string;
    messages: { id: string; content: string; createdAt: string; fromCreator: boolean; author: string; unread: boolean }[];
  } | null;
  uploads: VaultUpload[];
  internalNotes: { id: string; content: string; createdAt: string; updatedAt: string; authorId: string; authorName: string }[];
  communicationPreferences: CommunicationPreferences;
}

const PAUSES = [
  { key: "3", label: "For 3 days", days: 3 },
  { key: "7", label: "For a week", days: 7 },
  { key: "14", label: "For 2 weeks", days: 14 },
  { key: "open", label: "Until I resume", days: null },
] as const;

function localTime(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  } catch {
    return null;
  }
}

function fmtDays(d: number) {
  if (d === 0) return "On the day";
  return d > 0 ? `${plural(d, "day")} early` : `${plural(-d, "day")} late`;
}

export function CreatorVaultClient({
  data,
  currentUser,
}: {
  data: ProfileData;
  currentUser: { id: string; name: string; role: string };
}) {
  const router = useRouter();
  const [creator, setCreator] = useState(data.creator);
  const [pause, setPause] = useState(data.pause);
  const [pauseChoice, setPauseChoice] = useState<string>("3");
  const [pausing, setPausing] = useState(false);
  const [notes, setNotes] = useState(data.internalNotes);
  const [prefs, setPrefs] = useState<CommunicationPreferences>(data.communicationPreferences);
  const [showPrefsForm, setShowPrefsForm] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState("uploads");
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState("90d");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(currentUser.role);
  const canDelete = ["OWNER", "ADMIN"].includes(currentUser.role);
  const archived = creator.archivedAt !== null;
  const first = creator.name.split(/\s+/)[0];
  const tzTime = useMemo(() => localTime(creator.timezone), [creator.timezone]);

  const status = creatorStatus({
    archived,
    inviteStatus:
      creator.invite?.state === "cancelled"
        ? "CANCELLED"
        : creator.invite?.state === "expired"
          ? "EXPIRED"
          : creator.inviteStatus,
    paused: pause.paused,
    pausedUntil: pause.resumeAt ? new Date(pause.resumeAt) : null,
    active: data.active.map((r) => ({ ...r, due: r.due ? new Date(r.due) : null })),
  });

  // The header's one sentence: what is open and when the next one is due
  const owed = data.active.reduce((n, r) => n + countState(r.fields, "waiting", "overdue", "changes"), 0);
  const ready = data.active.reduce((n, r) => n + countState(r.fields, "ready"), 0);
  const next = data.active.find((r) => r.due);
  const summary = data.active.length
    ? `${plural(data.active.length, "active request")}${owed ? `, ${plural(owed, "field")} still to come` : ", everything uploaded"}${
        ready ? `, ${plural(ready, "field")} ready to review` : ""
      }.${next?.due ? ` Next due ${formatDay(next.due)}, ${timeLeft(next.due).text}.` : ""}`
    : `Nothing open for ${first} right now.`;

  const channel = creator.preferredContact === "SMS" ? "SMS" : creator.preferredContact === "BOTH" ? "BOTH" : "EMAIL";

  const announce = (text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  const sendReminder = useCallback(
    async (requestIds: string[], label: string) => {
      setReminding(label);
      try {
        const results = await Promise.all(
          requestIds.map((requestId) =>
            fetch("/api/reminders/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestId, channel }),
            })
          )
        );
        const failed = results.filter((r) => !r.ok).length;
        if (failed) throw new Error(`${failed} of ${requestIds.length} reminders could not be sent`);
        const text = requestIds.length > 1 ? `${requestIds.length} reminders sent to ${first}` : `Reminder sent to ${first}`;
        toast.success(text);
        if (liveRef.current) liveRef.current.textContent = text;
      } catch (e) {
        toast.error(`${e instanceof Error ? e.message : "The reminder could not be sent"}. Check ${first}'s contact details and try again.`);
      } finally {
        setReminding(null);
      }
    },
    [channel, first]
  );

  const doPause = async (resumeAt: string | null) => {
    const res = await fetch(`/api/creators/${creator.id}/reminder-pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resumeAt ? { resumeAt } : {}),
    });
    if (!res.ok) throw new Error("Reminders could not be paused");
    setPause({ paused: true, resumeAt });
  };
  const doResume = async () => {
    const res = await fetch(`/api/creators/${creator.id}/reminder-pause`, { method: "DELETE" });
    if (!res.ok) throw new Error("Reminders could not be resumed");
    setPause({ paused: false, resumeAt: null });
  };

  const onPause = async () => {
    const choice = PAUSES.find((p) => p.key === pauseChoice)!;
    const resumeAt = choice.days ? new Date(Date.now() + choice.days * 86_400_000).toISOString() : null;
    setPausing(true);
    try {
      await doPause(resumeAt);
      const text = resumeAt ? `Reminders to ${first} paused until ${formatDay(resumeAt)}` : `Reminders to ${first} paused until you resume them`;
      announce(text);
      toast(text, {
        action: {
          label: "Undo",
          onClick: () =>
            doResume()
              .then(() => toast(`Reminders to ${first} are back on`))
              .catch(() => toast.error("Undo failed. Use Resume reminders instead.")),
        },
      });
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "Something went wrong"}. Try again.`);
    } finally {
      setPausing(false);
    }
  };

  const onResume = async () => {
    const before = pause.resumeAt;
    setPausing(true);
    try {
      await doResume();
      announce(`Reminders to ${first} are back on`);
      toast(`Reminders to ${first} are back on`, {
        action: {
          label: "Undo",
          onClick: () =>
            doPause(before)
              .then(() => toast(`Reminders to ${first} paused again`))
              .catch(() => toast.error("Undo failed. Pause them again from this page.")),
        },
      });
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "Something went wrong"}. Try again.`);
    } finally {
      setPausing(false);
    }
  };

  const archive = async () => {
    try {
      const res = await fetch(`/api/creators/${creator.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`${creator.name} archived`);
      router.push("/dashboard/creators");
    } catch {
      toast.error(`${creator.name} could not be archived. Try again.`);
    }
  };
  const unarchive = async () => {
    try {
      const res = await fetch(`/api/creators/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) throw new Error();
      setCreator((c) => ({ ...c, archivedAt: null }));
      toast.success(`${creator.name} restored`);
      router.refresh();
    } catch {
      toast.error(`${creator.name} could not be restored. Try again.`);
    }
  };
  const hardDelete = async () => {
    if (deleteText !== creator.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/creators/${creator.id}?hard=true`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "The creator could not be deleted");
      }
      toast.success(`${creator.name} permanently deleted`);
      router.push("/dashboard/creators");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The creator could not be deleted");
      setDeleting(false);
    }
  };

  const exportContent = async () => {
    const id = toast.loading("Preparing the export");
    try {
      const res = await fetch(`/api/uploads/export?creatorId=${creator.id}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${creator.name.replace(/\s+/g, "-")}-content-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { id });
    } catch {
      toast.error("The export could not be made. Try again.", { id });
    }
  };

  const loadAnalytics = useCallback(
    async (range: string) => {
      setAnalyticsLoading(true);
      try {
        const res = await fetch(`/api/creators/${creator.id}/analytics?range=${range}`);
        if (!res.ok) throw new Error();
        setAnalytics(await res.json());
      } catch {
        toast.error("Upload figures could not be loaded. Try again.");
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [creator.id]
  );

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`${what} could not be copied`);
    }
  };

  const convertedNotes: Note[] = notes.map((n) => ({
    id: n.id,
    content: n.content,
    entityType: "creator" as const,
    entityId: creator.id,
    authorId: n.authorId,
    authorName: n.authorName,
    isPinned: false,
    isInternal: true,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    mentions: [],
    hashtags: [],
  }));

  const messages = data.thread?.messages ?? [];
  const unread = messages.filter((m) => m.unread).length;
  const threadHref = `/dashboard/messages?creatorId=${creator.id}`;
  const usual = usualPhrase(data.delivery.usualDaysEarly);
  const worst = data.points.filter((p) => !p.onTime).sort((a, b) => a.daysEarly - b.daysEarly)[0];

  return (
    <div className="space-y-8">
      <BackLink href="/dashboard/creators" label="Creators" />

      {/* header: the name, then everything about how to reach them */}
      <section aria-labelledby="creator-name" className="grid gap-6 rounded-[10px] bg-tile p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 id="creator-name" className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">
              <EditableCreatorName
                creatorId={creator.id}
                name={creator.name}
                onUpdate={(name) => setCreator((c) => ({ ...c, name }))}
                size="lg"
                className="!text-[28px] font-extrabold tracking-[-0.025em] sm:!text-[32px]"
              />
            </h1>
            <Pill tone={status.tone}>{status.label}</Pill>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-[13px] text-ink-2">Prefers</dt>
              <dd className="mt-0.5 font-semibold text-ink">{contactLabel(creator.preferredContact)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-2">Time zone</dt>
              <dd className="mt-0.5 font-semibold text-ink">{cityOf(creator.timezone)}</dd>
              {tzTime && (
                <dd className="text-[13px] text-ink-2" suppressHydrationWarning>
                  {tzTime} there now
                </dd>
              )}
            </div>
            <div>
              <dt className="text-[13px] text-ink-2">Quiet hours</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">{quietLabel(data.quiet)}</dd>
              <dd className="text-[13px] text-ink-2">{data.quiet.isDefault ? "the default, their time" : "their time"}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-2">Joined</dt>
              <dd className="mt-0.5 font-semibold text-ink">{format(new Date(creator.createdAt), "d MMM yyyy")}</dd>
              <dd className="text-[13px] text-ink-2" suppressHydrationWarning>
                {creator.lastLoginAt ? `last seen ${ago(creator.lastLoginAt)}` : "not signed in yet"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
            <button
              type="button"
              onClick={() => copy(creator.email, "Email")}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
            >
              {creator.email}
              <Copy className="size-3.5 text-icon" aria-hidden="true" />
              <span className="sr-only">Copy email</span>
            </button>
            {creator.phone && (
              <button
                type="button"
                onClick={() => copy(creator.phone!, "Phone number")}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-sm tabular-nums hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
              >
                {creator.phone}
                <Copy className="size-3.5 text-icon" aria-hidden="true" />
                <span className="sr-only">Copy phone number</span>
              </button>
            )}
          </div>
          <p className="mt-4 text-[15px] text-ink" suppressHydrationWarning>
            {summary}
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:border-l lg:border-line lg:pl-6">
          {!archived && (
            <Button asChild>
              <Link href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                <Plus aria-hidden="true" />
                New request for {first}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={threadHref}>
              <MessageSquare aria-hidden="true" />
              Message {first}
              <UnreadCount n={unread} />
            </Link>
          </Button>
          {canManage && !archived && creator.invite && (
            <div className="mt-3">
              <CreatorInviteActions
                variant="panel"
                creatorId={creator.id}
                name={creator.name}
                email={creator.email}
                state={creator.invite.state}
                expiresAt={creator.invite.expiresAt}
              />
            </div>
          )}
          {canManage && !archived && (
            <div className="mt-3">
              <p className="mb-1.5 text-[13px] text-ink-2" id="pause-label">
                {pause.paused
                  ? pause.resumeAt
                    ? `Reminders paused until ${formatDay(pause.resumeAt)}`
                    : "Reminders paused until you resume them"
                  : "Pause reminders"}
              </p>
              {pause.paused ? (
                <Button variant="outline" className="w-full" onClick={onResume} disabled={pausing}>
                  {pausing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                  Resume reminders
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Select value={pauseChoice} onValueChange={setPauseChoice}>
                    <SelectTrigger className="min-w-0 flex-1" aria-labelledby="pause-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAUSES.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={onPause} disabled={pausing}>
                    {pausing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Pause aria-hidden="true" />}
                    Pause
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="mt-auto flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
              <Edit2 aria-hidden="true" />
              Edit profile
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={`More for ${creator.name}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {data.active.length > 0 && (
                  <DropdownMenuItem disabled={!!reminding} onClick={() => sendReminder(data.active.map((r) => r.id), "all")}>
                    <Bell aria-hidden="true" />
                    {data.active.length > 1 ? `Remind about all ${data.active.length}` : "Send a reminder"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setContactOpen(true)}>
                  <Send aria-hidden="true" />
                  Contact by email or SMS
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportContent}>
                  <Download aria-hidden="true" />
                  Export upload list
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {archived ? (
                  <DropdownMenuItem onClick={unarchive}>
                    <RefreshCw aria-hidden="true" />
                    Restore creator
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setArchiveOpen(true)} className="text-late focus:text-late">
                    <Archive aria-hidden="true" />
                    Archive creator
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteText("");
                      setDeleteOpen(true);
                    }}
                    className="text-late focus:text-late"
                  >
                    <Trash2 aria-hidden="true" />
                    Delete permanently
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <Shelf
        title="Active"
        sub={
          data.active.length
            ? ready
              ? `${plural(ready, "field")} ready to review`
              : `${plural(data.active.length, "request")} open`
            : undefined
        }
        empty={
          <EmptyLine>
            Nothing is open for {first}.{" "}
            {!archived && (
              <Link className="font-medium text-ink underline underline-offset-[3px]" href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                Send a new request
              </Link>
            )}
          </EmptyLine>
        }
      >
        {data.active.map((r) => {
          const n = countState(r.fields, "ready");
          return (
            <TitleCard
              key={r.id}
              title={r.title}
              creator={r.kind ?? creator.name}
              fields={r.fields}
              due={r.due}
              href={`/dashboard/requests/${r.id}`}
              actions={
                <>
                  {n > 0 && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/requests/${r.id}`}>Review {n}</Link>
                    </Button>
                  )}
                  {canManage && countState(r.fields, "waiting", "overdue", "changes") > 0 && (
                    <Button size="sm" variant="outline" disabled={reminding === r.id} onClick={() => sendReminder([r.id], r.id)}>
                      {reminding === r.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bell aria-hidden="true" />}
                      Remind
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
      </Shelf>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="finished-h" className="min-w-0">
          <SectionHead
            id="finished-h"
            title="Finished"
            sub={data.delivery.finished ? `${data.delivery.onTime} of ${data.delivery.finished} on time` : undefined}
          />
          {data.finished.length === 0 ? (
            <EmptyLine>Finished requests land here once every field is approved. {first} has none yet.</EmptyLine>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {data.finished.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <Link href={`/dashboard/requests/${r.id}`} className="font-semibold text-ink underline-offset-[3px] hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-[13px] text-ink-2">
                      {[r.kind, r.finishedAt ? `finished ${formatDay(r.finishedAt)}` : null, r.due ? `due ${formatDay(r.due)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      r.status === "CANCELLED" ? "text-ink-2" : r.onTime === false ? "text-late" : "text-ink"
                    )}
                  >
                    {r.status === "CANCELLED" ? "Cancelled" : r.daysEarly != null ? fmtDays(r.daysEarly) : "No due date"}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/templates/new?fromRequest=${r.id}`} aria-label={`Use ${r.title} as a template`}>
                      Use as template
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8">
            <section aria-labelledby="msgs-h">
              <SectionHead id="msgs-h" title="Latest messages" sub={unread ? `${unread} unread` : undefined} />
              <Panel className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-ink-2">No messages with {first} yet. Start the thread and they see it in their portal.</p>
                ) : (
                  <ol className="space-y-4">
                    {messages.map((m) => (
                      <li key={m.id}>
                        <p className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="font-semibold text-ink">
                            {m.fromCreator ? m.author : m.author === currentUser.name ? "You" : m.author}
                            {m.unread && <span className="ml-2 font-semibold text-ink">New</span>}
                          </span>
                          <time className="shrink-0 text-ink-2" dateTime={m.createdAt} suppressHydrationWarning>
                            {ago(m.createdAt)}
                          </time>
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-sm text-ink">{m.content}</p>
                      </li>
                    ))}
                  </ol>
                )}
                <Link
                  href={threadHref}
                  className="inline-block text-sm font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
                >
                  {messages.length ? `Open the thread with ${first}` : `Message ${first}`}
                </Link>
              </Panel>
            </section>
          </div>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="ontime-h">
            <SectionHead id="ontime-h" title="On time" />
            <Panel>
              {data.points.length === 0 ? (
                <p className="text-sm text-ink-2">
                  The chart fills in as {first}&rsquo;s requests finish: each one shows how many days early or late it came in.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[15px] text-ink">
                    <b className="font-semibold">
                      {data.delivery.onTime} of {plural(data.delivery.finished, "finished request")}
                    </b>{" "}
                    on time{usual ? `, ${usual}` : ""}.
                    {worst ? ` ${worst.title} came in ${plural(-worst.daysEarly, "day")} late.` : ""}
                  </p>
                  <OnTimeChart points={data.points} name={creator.name} />
                </>
              )}
            </Panel>
          </section>

        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          if (v === "analytics" && !analytics) void loadAnalytics(analyticsRange);
        }}
        className="space-y-5"
      >
        <TabsList aria-label={`More about ${first}`}>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="contact">Contact and notes</TabsTrigger>
          <TabsTrigger value="analytics">Upload figures</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="uploads">
          <CreatorUploads creatorId={creator.id} creatorName={creator.name} initial={data.uploads} />
        </TabsContent>

        <TabsContent value="contact" className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-semibold text-ink">How {first} likes to be reached</h3>
                <p className="text-sm text-ink-2">Used when you contact them from here.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={showPrefsForm ? "Close contact preferences" : "Edit contact preferences"}
                aria-pressed={showPrefsForm}
                onClick={() => setShowPrefsForm((s) => !s)}
              >
                <Settings aria-hidden="true" />
              </Button>
            </div>
            {showPrefsForm ? (
              <CommunicationPreferencesForm
                creatorId={creator.id}
                initialPreferences={prefs}
                onSave={(p) => {
                  setPrefs(p);
                  setShowPrefsForm(false);
                }}
                onCancel={() => setShowPrefsForm(false)}
                compact
              />
            ) : (
              <CommunicationStatus
                preferences={prefs}
                creatorName={creator.name}
                onContactClick={() => setContactOpen(true)}
                showQuickActions
              />
            )}
          </Panel>
          <NotesPanel
            entityType="creator"
            entityId={creator.id}
            initialNotes={convertedNotes}
            currentUser={currentUser}
            apiBasePath={`/api/creators/${creator.id}/notes`}
            title="Internal notes"
            description="Only staff see these."
            onNotesChange={(next) =>
              setNotes(
                next.map((n) => ({
                  id: n.id,
                  content: n.content,
                  createdAt: n.createdAt,
                  updatedAt: n.updatedAt,
                  authorId: n.authorId,
                  authorName: n.authorName,
                }))
              )
            }
          />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel
            data={analytics}
            loading={analyticsLoading}
            range={analyticsRange}
            onRange={(r) => {
              setAnalyticsRange(r);
              void loadAnalytics(r);
            }}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimelineWidget
            title={`${first}'s activity`}
            entityType="Creator"
            entityId={creator.id}
            limit={20}
            showFilters
            showSearch
            viewAllHref={`/dashboard/activity?entityType=Creator&entityId=${creator.id}`}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {creator.name}?</DialogTitle>
            <DialogDescription>
              They lose access to the portal and stop getting requests and reminders. Their requests and uploads stay here, and you can restore them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Keep {first}
            </Button>
            <Button variant="destructive" onClick={archive}>
              Archive {first}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (deleting) return;
          setDeleteOpen(o);
          if (!o) setDeleteText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-late">Permanently delete {creator.name}?</DialogTitle>
            <DialogDescription>
              This removes {creator.name} and <strong>all of their requests, uploads, media and messages</strong>. It cannot be undone. To only remove their portal access, archive them instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="delete-confirm" className="text-sm font-medium">
              Type <span className="font-semibold">{creator.name}</span> to confirm
            </label>
            <Input
              id="delete-confirm"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={creator.name}
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={hardDelete} disabled={deleting || deleteText !== creator.name}>
              {deleting ? "Deleting" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditCreatorProfileModal
        open={editOpen}
        onOpenChange={setEditOpen}
        creator={creator}
        onUpdate={(u) => setCreator((c) => ({ ...c, ...u }))}
        currentUserRole={currentUser.role}
      />

      <ContactCreatorModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        creator={{ id: creator.id, name: creator.name, email: creator.email }}
        preferences={prefs}
        senderName={currentUser.name}
        onSend={async (payload) => {
          const res = await fetch(`/api/creators/${creator.id}/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Failed to send message");
        }}
      />
    </div>
  );
}

function AnalyticsPanel({
  data,
  loading,
  range,
  onRange,
}: {
  data: Record<string, unknown> | null;
  loading: boolean;
  range: string;
  onRange: (r: string) => void;
}) {
  const o = (data?.overview as Record<string, number> | undefined) ?? null;
  const weeks = ((data?.uploadFrequency as Array<{ week: string; count: number }> | undefined) ?? []).slice(-8);
  const types = (data?.contentTypeBreakdown as Array<{ type: string; count: number; percentage: number }> | undefined) ?? [];
  const peak = Math.max(1, ...weeks.map((w) => w.count));
  const rangeLabel = ({ "7d": "7 days", "30d": "30 days", "90d": "90 days", "365d": "year" } as Record<string, string>)[range] ?? "period";

  return (
    <Panel className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[15px] text-ink" aria-live="polite">
          {loading
            ? "Counting uploads"
            : o
              ? `${plural(o.totalUploads ?? 0, "upload")} in the last ${rangeLabel}: ${o.approved ?? 0} approved, ${o.pending ?? 0} waiting for review, ${o.approvalRate ?? 0}% approved overall.`
              : "Upload figures could not be loaded."}
        </p>
        <Select value={range} onValueChange={onRange}>
          <SelectTrigger className="w-[160px]" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="365d">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!loading && o && (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Uploads per week</h3>
            {weeks.length === 0 ? (
              <p className="text-sm text-ink-2">No uploads in this period.</p>
            ) : (
              <ol className="flex h-36 items-end gap-2 border-b border-ctl-hi">
                {weeks.map((w) => (
                  <li key={w.week} className="flex h-full flex-1 flex-col justify-end" title={`Week of ${w.week}: ${w.count}`}>
                    <span className="mb-1 text-center text-[12px] tabular-nums text-ink-2">{w.count}</span>
                    {w.count > 0 && <span className="block rounded-t-[3px] bg-ready" style={{ height: `${(w.count / peak) * 100}px` }} />}
                    <span className="sr-only">week of {w.week}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">By file type</h3>
            {types.length === 0 ? (
              <p className="text-sm text-ink-2">Nothing to break down yet.</p>
            ) : (
              <ul className="space-y-3">
                {types.map((t) => (
                  <li key={t.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink">{t.type}</span>
                      <span className="tabular-nums text-ink-2">
                        {t.count} ({t.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-well">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${t.percentage}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
