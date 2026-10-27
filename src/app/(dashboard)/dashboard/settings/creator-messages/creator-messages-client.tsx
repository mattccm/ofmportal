"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHead, Panel, SettingsSection } from "@/components/creators/people-ui";
import { Segmented } from "@/components/messaging/plan-editor";
import {
  DEFAULT_AGENCY_MESSAGING,
  MESSAGE_EVENTS,
  describeChoice,
  type AgencyMessaging,
  type ChannelChoice,
  type MessageEvent,
} from "@/lib/messaging";

const same = (a: AgencyMessaging, b: AgencyMessaging) => JSON.stringify(a) === JSON.stringify(b);

export default function CreatorMessagesClient({ initial }: { initial: AgencyMessaging }) {
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = !same(saved, draft);
  const isDefault = same(draft, DEFAULT_AGENCY_MESSAGING);

  const setEvent = (e: MessageEvent, c: ChannelChoice) => setDraft((d) => ({ ...d, events: { ...d.events, [e]: c } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaging: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setSaved(data.messaging);
      setDraft(data.messaging);
      toast.success(data.rescheduled ? `Saved. Reminders for ${data.rescheduled} open ${data.rescheduled === 1 ? "request" : "requests"} follow the new settings.` : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const textOn = MESSAGE_EVENTS.filter((e) => draft.events[e.id].sms).length;

  return (
    <div className="space-y-8 pb-6">
      <PageHead
        title="Creator messages"
        lede={`What creators get by email and by text, for each message. ${textOn === 0 ? "No message is texted." : `${textOn} of ${MESSAGE_EVENTS.length} messages can go by text.`} Templates and single requests can set their own.`}
        back={{ href: "/dashboard/settings", label: "Settings" }}
      />

      <SettingsSection
        id="grid"
        title="Each message"
        description={
          <>
            The agency default for every request. A template&rsquo;s own plan, a request&rsquo;s own plan, and a creator&rsquo;s own reminder settings come first. When reminders go out is set in{" "}
            <Link href="/dashboard/settings/reminder-rules" className="text-ink underline underline-offset-[3px]">
              Reminder rules
            </Link>
            .
          </>
        }
      >
        <Panel className="p-0 sm:p-0">
          <div role="table" aria-label="Channels for each creator message" className="divide-y divide-line">
            <div role="row" className="hidden grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-4 px-5 py-3 text-[13px] font-medium text-ink-2 sm:grid">
              <span role="columnheader">Message</span>
              <span role="columnheader" className="text-center">
                Email
              </span>
              <span role="columnheader" className="text-center">
                Text
              </span>
            </div>
            {MESSAGE_EVENTS.map((e) => {
              const c = draft.events[e.id];
              const labelId = `ev-${e.id.replace(".", "-")}`;
              return (
                <div key={e.id} role="row" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_72px_72px] sm:px-5">
                  <div role="cell" className="min-w-0">
                    <p id={labelId} className="text-sm font-semibold text-ink">
                      {e.label}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{describeChoice(c, draft.respectPreference)}</p>
                  </div>
                  <div role="cell" className="flex flex-col items-center gap-1 pt-0.5">
                    <Switch checked={c.email} onCheckedChange={(v) => setEvent(e.id, { ...c, email: !!v })} aria-label={`${e.label} by email`} />
                    <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                      Email
                    </span>
                  </div>
                  <div role="cell" className="flex flex-col items-center gap-1 pt-0.5">
                    <Switch checked={c.sms} onCheckedChange={(v) => setEvent(e.id, { ...c, sms: !!v })} aria-label={`${e.label} by text`} />
                    <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                      Text
                    </span>
                  </div>
                  {c.email && c.sms && (
                    <div role="cell" className="col-span-3 sm:col-span-1">
                      <Segmented
                        label={`${e.label}: when both are on`}
                        value={c.pick === "preferred" ? "preferred" : "all"}
                        options={[
                          { id: "all", label: "Send both" },
                          { id: "preferred", label: "One, by preference" },
                        ]}
                        onChange={(v) => setEvent(e.id, { ...c, pick: v })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </SettingsSection>

      <SettingsSection
        id="consent"
        title="Contact preference"
        description="Each creator chooses email, texts or both on their profile."
      >
        <Panel>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p id="respect-label" className="text-sm font-semibold text-ink">
                Respect each creator&rsquo;s contact preference
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                {draft.respectPreference
                  ? "On: creators who prefer email never get a text. Creators who prefer texts still get the emails above, which carry the full details."
                  : "Off: texts go to every creator with a phone number, whatever they chose."}{" "}
                A message that can&rsquo;t reach someone by text goes by email instead, so nothing switched on is lost.
              </p>
            </div>
            <Switch
              checked={draft.respectPreference}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, respectPreference: !!v }))}
              aria-labelledby="respect-label"
            />
          </div>
        </Panel>
      </SettingsSection>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
        {!isDefault && (
          <Button type="button" variant="ghost" onClick={() => setDraft(DEFAULT_AGENCY_MESSAGING)} disabled={saving}>
            Go back to the standard settings
          </Button>
        )}
        {dirty && (
          <Button type="button" variant="outline" onClick={() => setDraft(saved)} disabled={saving}>
            Discard changes
          </Button>
        )}
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save creator messages
        </Button>
      </div>
    </div>
  );
}
