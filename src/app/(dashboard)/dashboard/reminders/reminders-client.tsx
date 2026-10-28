"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, MessageSquare, RefreshCw, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyLine, Panel, Pill } from "@/components/creators/people-ui";
import { TimingPanel } from "@/components/reminders/timing-panel";
import { TextsPanel, type TemplateTexts } from "@/components/reminders/texts-panel";
import { TextSetupPanel } from "@/components/reminders/text-setup-panel";
import { WordingPanel } from "@/components/reminders/wording-panel";
import type { AgencyCopy } from "@/lib/message-copy";
import type { EmailBranding } from "@/lib/email-layout";
import { useAccess } from "@/lib/access/client";
import type { AgencyMessaging } from "@/lib/messaging";

// TYPES

interface Reminder {
  id: string;
  requestId: string;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: "EMAIL" | "SMS";
  scheduledAt: string;
  sentAt: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  request: {
    id: string;
    title: string;
    creator: { id: string; name: string };
  };
}

interface Creator {
  id: string;
  name: string;
}

export type ReminderTab = "scheduled" | "sent" | "timing" | "texts" | "wording" | "setup";

interface RemindersClientProps {
  initialReminders: Reminder[];
  creators: Creator[];
  /** Tabs this person can open, in order */
  tabs: ReminderTab[];
  messaging: AgencyMessaging;
  templates: TemplateTexts[];
  copy: AgencyCopy;
  branding: EmailBranding;
}

const TAB_LABEL: Record<ReminderTab, string> = {
  scheduled: "Scheduled",
  sent: "Sent",
  timing: "Timing",
  texts: "Email and texts",
  wording: "Wording",
  setup: "Text setup",
};

const TYPE_LABEL: Record<Reminder["type"], string> = {
  UPCOMING: "Before the due day",
  DUE_TODAY: "On the due day",
  OVERDUE: "Overdue",
  ESCALATION: "Overdue, by text",
};

function Channel({ channel }: { channel: Reminder["channel"] }) {
  const Icon = channel === "SMS" ? MessageSquare : Mail;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
      <Icon className="size-3.5 text-icon" aria-hidden="true" />
      {channel === "SMS" ? "Text" : "Email"}
    </span>
  );
}

// MAIN COMPONENT

export function RemindersClient({ initialReminders, creators, tabs, messaging, templates, copy, branding }: RemindersClientProps) {
  const { can } = useAccess();
  const canSend = can("reminders.send");
  const canCancel = can("reminders.delete");
  const canPick = canSend || canCancel;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asked = searchParams.get("tab") as ReminderTab | null;
  const tab: ReminderTab = asked && tabs.includes(asked) ? asked : tabs[0];
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === tabs[0]) params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [reminders, setReminders] = React.useState<Reminder[]>(initialReminders);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<"all" | "SENT" | "FAILED">("all");
  const [creatorFilter, setCreatorFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return reminders.filter((r) => {
      if (creatorFilter !== "all" && r.request.creator.id !== creatorFilter) return false;
      return !q || r.request.title.toLowerCase().includes(q) || r.request.creator.name.toLowerCase().includes(q);
    });
  }, [reminders, creatorFilter, query]);
  // Soonest first; the history stays newest first
  const pending = filtered.filter((r) => r.status === "PENDING").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const history = filtered.filter((r) => r.status !== "PENDING" && (statusFilter === "all" || r.status === statusFilter));

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/reminders?limit=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReminders(data.reminders);
    } catch {
      toast.error("Couldn't refresh reminders. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const bulk = async (action: "cancel" | "sendNow", ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reminderIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work");
      toast.success(data.message || (action === "cancel" ? "Cancelled" : "Sent"));
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendOne = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The reminder didn't send");
      toast.success("Reminder sent");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The reminder didn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const filters = (withStatus: boolean) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
        <Input
          placeholder="Search by request or creator"
          aria-label="Search reminders"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {withStatus && (
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger aria-label="Filter by result" className="sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sent and failed</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={creatorFilter} onValueChange={setCreatorFilter}>
        <SelectTrigger aria-label="Filter by creator" className="sm:w-[190px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Every creator</SelectItem>
          {creators.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button aria-label="Refresh reminders" variant="outline" size="icon" onClick={() => void refresh()} disabled={busy}>
        <RefreshCw className={busy ? "motion-safe:animate-spin" : undefined} aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" className="w-full min-w-max justify-start border-b">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className="flex items-center gap-2">
              {TAB_LABEL[t]}
              {t === "scheduled" && pending.length > 0 && <span className="text-[13px] tabular-nums text-ink-2">{pending.length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.includes("scheduled") && (
        <TabsContent value="scheduled" className="space-y-4">
          {filters(false)}
          {canPick && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-tile px-4 py-3">
              <span className="mr-auto text-sm font-medium text-ink">{selected.size} selected</span>
              {canSend && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk("sendNow", [...selected])}>
                  <Send aria-hidden="true" />
                  Send now
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk("cancel", [...selected])}>
                  <X aria-hidden="true" />
                  Cancel them
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          )}
          {pending.length === 0 ? (
            <EmptyLine>
              Nothing is scheduled{query || creatorFilter !== "all" ? " that matches" : ""}. Reminders appear here once a request with a due date goes out.
            </EmptyLine>
          ) : (
            <Panel className="p-0 sm:p-0">
              <ul className="divide-y divide-line">
                {canPick && (
                  <li className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <Checkbox
                      aria-label="Select every scheduled reminder"
                      checked={pending.every((r) => selected.has(r.id))}
                      onCheckedChange={(v) => setSelected(v ? new Set(pending.map((r) => r.id)) : new Set())}
                    />
                    <span className="text-[13px] text-ink-2">{pending.length === 1 ? "1 reminder" : `${pending.length} reminders`}, soonest first</span>
                  </li>
                )}
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    {canPick && (
                      <Checkbox
                        aria-label={`Select the reminder to ${r.request.creator.name}`}
                        checked={selected.has(r.id)}
                        onCheckedChange={(v) => toggle(r.id, !!v)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {r.request.creator.name}
                        <span className="font-normal text-ink-2"> · </span>
                        <Link href={`/dashboard/requests/${r.request.id}`} className="font-normal text-ink-2 hover:text-ink hover:underline">
                          {r.request.title}
                        </Link>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                        <span className="tabular-nums">{format(new Date(r.scheduledAt), "EEE d MMM, h:mm a")}</span>
                        <span>{TYPE_LABEL[r.type]}</span>
                        <Channel channel={r.channel} />
                      </p>
                    </div>
                    {canSend && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void sendOne(r.id)}>
                        Send now
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Cancel the reminder to ${r.request.creator.name}`}
                        disabled={busy}
                        onClick={() => void bulk("cancel", [r.id])}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </TabsContent>
      )}

      {tabs.includes("sent") && (
        <TabsContent value="sent" className="space-y-4">
          {filters(true)}
          {history.length === 0 ? (
            <EmptyLine>Nothing has gone out{query || creatorFilter !== "all" || statusFilter !== "all" ? " that matches" : " yet"}.</EmptyLine>
          ) : (
            <Panel className="p-0 sm:p-0">
              <ul className="divide-y divide-line">
                {history.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {r.request.creator.name}
                        <span className="font-normal text-ink-2"> · </span>
                        <Link href={`/dashboard/requests/${r.request.id}`} className="font-normal text-ink-2 hover:text-ink hover:underline">
                          {r.request.title}
                        </Link>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                        {r.sentAt && (
                          <span className="tabular-nums" title={format(new Date(r.sentAt), "EEE d MMM, h:mm a")}>
                            {formatDistanceToNow(new Date(r.sentAt), { addSuffix: true })}
                          </span>
                        )}
                        <span>{TYPE_LABEL[r.type]}</span>
                        <Channel channel={r.channel} />
                      </p>
                      {r.error && <p className="mt-1 text-[13px] text-late">{r.error}</p>}
                    </div>
                    <Pill tone={r.status === "SENT" ? "approved" : "late"}>{r.status === "SENT" ? "Sent" : "Failed"}</Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </TabsContent>
      )}

      {tabs.includes("timing") && (
        <TabsContent value="timing">
          <TimingPanel messaging={messaging} copy={copy} />
        </TabsContent>
      )}

      {tabs.includes("texts") && (
        <TabsContent value="texts">
          <TextsPanel initial={messaging} templates={templates} canEditAgency={can("reminders.rules")} canEditTemplates={can("templates.edit")} />
        </TabsContent>
      )}

      {tabs.includes("wording") && (
        <TabsContent value="wording">
          <WordingPanel initial={copy} branding={branding} canEdit={can("reminders.templates") || can("settings.emailTemplates")} />
        </TabsContent>
      )}

      {tabs.includes("setup") && (
        <TabsContent value="setup">
          <TextSetupPanel />
        </TabsContent>
      )}

    </Tabs>
  );
}
