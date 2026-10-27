"use client";

import * as React from "react";
import { Loader2, Mail, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatStamp } from "@/components/title-wall";
import { PlanEditor, useAgencyMessaging } from "@/components/messaging/plan-editor";
import type { ChannelChoice, MessagingPlan } from "@/lib/messaging";

interface Resolved {
  plan: MessagingPlan | null;
  source: "creator" | "request" | "template" | "rule" | "default";
  sourceLabel: string;
  disabled: boolean;
  summary: string;
  escalation: { afterDays: number } | null;
  events: {
    id: string;
    label: string;
    choice: ChannelChoice;
    source: "request" | "template" | "agency";
    creatorGets: { email: boolean; sms: boolean; note: string | null } | null;
  }[];
  templateName: string | null;
  respectPreference: boolean;
  pending: { id: string; scheduledAt: string; type: string; channel: "EMAIL" | "SMS" | null; isEscalation: boolean }[];
}

const gets = (g: { email: boolean; sms: boolean }) => (g.email && g.sms ? "email and text" : g.email ? "email" : g.sms ? "text" : "nothing");

/** Groups pending rows (one per channel) into one line per send time */
function upcoming(pending: Resolved["pending"]) {
  const byTime = new Map<string, { at: string; email: boolean; sms: boolean; unknown: boolean }>();
  for (const r of pending) {
    const k = r.scheduledAt;
    const cur = byTime.get(k) ?? { at: k, email: false, sms: false, unknown: false };
    if (r.channel === "EMAIL") cur.email = true;
    else if (r.channel === "SMS") cur.sms = true;
    else cur.unknown = true;
    byTime.set(k, cur);
  }
  return [...byTime.values()];
}

/**
 * The request page's Reminders panel: the plan that applies, where it comes
 * from, what's scheduled, and Edit (reminders.edit) for this request's own plan.
 */
export function RequestRemindersPanel({
  requestId,
  firstName,
  canEdit,
  tz,
  active,
}: {
  requestId: string;
  firstName: string;
  canEdit: boolean;
  tz: string;
  /** Still open (not approved/archived): reminders can go out */
  active: boolean;
}) {
  const [data, setData] = React.useState<Resolved | null>(null);
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MessagingPlan | null>(null);
  const [saving, setSaving] = React.useState(false);
  const agency = useAgencyMessaging(canEdit);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/requests/${requestId}/messaging`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    }
  }, [requestId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/messaging`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaging: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't save");
      setData(d);
      setOpen(false);
      toast.success(active ? `Saved. ${d.rescheduled === 1 ? "1 reminder is" : `${d.rescheduled} reminders are`} scheduled.` : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = data ? upcoming(data.pending) : [];
  const ownSchedule = data?.source === "creator";

  return (
    <section aria-labelledby="reminders-h">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="reminders-h" className="text-[17px] font-semibold text-ink">
          Reminders
        </h2>
        {canEdit && data && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(data.plan);
              setOpen(true);
            }}
          >
            Edit
          </Button>
        )}
      </div>
      <div className="space-y-3 rounded-[10px] bg-tile p-4 text-[14px]">
        {error ? (
          <p className="text-ink-2">
            Couldn&rsquo;t load the reminder plan.{" "}
            <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : !data ? (
          <p className="flex items-center gap-2 text-ink-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : (
          <>
            <div>
              <p className="text-ink">{data.summary}</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {data.sourceLabel}
                {data.escalation ? ` · texts from ${data.escalation.afterDays} ${data.escalation.afterDays === 1 ? "day" : "days"} overdue` : ""}
              </p>
              {ownSchedule && canEdit && (
                <p className="mt-1 text-[13px] text-ink-2">{firstName}&rsquo;s own settings come first, so a plan set here only changes how the other messages go.</p>
              )}
            </div>

            {active && (
              <div>
                <h3 className="text-[13px] font-medium text-ink-2">Scheduled</h3>
                {next.length === 0 ? (
                  <p className="mt-1 text-ink-2">{data.disabled ? "None: reminders are off for this creator." : "Nothing scheduled."}</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {next.slice(0, 6).map((r) => (
                      <li key={r.at} className="flex items-center justify-between gap-3">
                        <time dateTime={r.at} className="tabular-nums text-ink">
                          {formatStamp(r.at, tz)}
                        </time>
                        {!r.unknown && (
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                            {r.email && <Mail className="size-3.5 text-icon" aria-hidden="true" />}
                            {r.sms && <MessageSquareText className="size-3.5 text-icon" aria-hidden="true" />}
                            {gets(r)}
                          </span>
                        )}
                      </li>
                    ))}
                    {next.length > 6 && <li className="text-[13px] text-ink-2">and {next.length - 6} more</li>}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[13px] font-medium text-ink-2">Other messages</h3>
              <ul className="mt-1 space-y-1">
                {data.events.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <span className="text-ink">{e.label}</span>
                    <span className="text-right text-[13px] text-ink-2">
                      {e.creatorGets ? gets(e.creatorGets) : gets(e.choice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Reminders for this request</DialogTitle>
            <DialogDescription>
              {data?.templateName && data.plan?.origin?.kind === "template"
                ? `Copied from the template ${data.templateName} when it was sent. Changes here affect only this request.`
                : "Changes here affect only this request. Its scheduled reminders are rebuilt when you save."}
            </DialogDescription>
          </DialogHeader>
          <PlanEditor value={draft} onChange={setDraft} agency={agency} scope="request" idPrefix="req-plan" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save and reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
