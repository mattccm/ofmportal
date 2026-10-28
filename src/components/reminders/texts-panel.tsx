"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyLine, Panel, SettingsSection } from "@/components/creators/people-ui";
import {
  DEFAULT_AGENCY_MESSAGING,
  MESSAGE_EVENTS,
  SCHEDULE_EVENTS,
  describeChoice,
  readPlan,
  type AgencyMessaging,
  type ChannelChoice,
  type EventChoice,
  type MessageEvent,
  type MessagingPlan,
} from "@/lib/messaging";

export interface TemplateTexts {
  id: string;
  name: string;
  messaging: unknown;
}

const same = (a: AgencyMessaging, b: AgencyMessaging) => JSON.stringify(a) === JSON.stringify(b);
const textsIn = (c: EventChoice | undefined) => c === "sms" || c === "both";

/** Does this template text for the event? Its own choice, or the agency's when it has none */
function templateTexts(plan: MessagingPlan | null, event: MessageEvent, agency: AgencyMessaging): boolean {
  const c = plan?.events[event];
  return c && c !== "inherit" ? textsIn(c) : agency.events[event].sms;
}

/** The template's choice that makes `on` true for the event, keeping the email */
function choiceFor(on: boolean, event: MessageEvent, agency: AgencyMessaging): EventChoice {
  if (on) return "both";
  return agency.events[event].sms ? "email" : "inherit";
}

/**
 * Reminders > Email and texts: every message goes by email; texts cost money,
 * so each one is switched on here, for every creator or only for requests
 * from chosen templates (e.g. Payslip). Decisions live in src/lib/messaging.ts.
 */
export function TextsPanel({
  initial,
  templates: initialTemplates,
  canEditAgency,
  canEditTemplates,
}: {
  initial: AgencyMessaging;
  templates: TemplateTexts[];
  canEditAgency: boolean;
  canEditTemplates: boolean;
}) {
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [savingTemplate, setSavingTemplate] = React.useState<string | null>(null);
  const dirty = !same(saved, draft);
  const isDefault = same(draft, DEFAULT_AGENCY_MESSAGING);

  const setEvent = (e: MessageEvent, c: ChannelChoice) => setDraft((d) => ({ ...d, events: { ...d.events, [e]: { ...c, pick: "all" } } }));

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

  const setTemplateTexts = async (t: TemplateTexts, events: MessageEvent[], on: boolean, what: string) => {
    const plan: MessagingPlan = readPlan(t.messaging) ?? { v: 1, events: {}, schedule: null };
    const next: MessagingPlan = { ...plan, events: { ...plan.events } };
    for (const e of events) next.events[e] = choiceFor(on, e, saved);
    setSavingTemplate(`${t.id}:${what}`);
    try {
      const res = await fetch(`/api/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaging: { v: 1, events: next.events, schedule: next.schedule } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the template");
      setTemplates((list) => list.map((x) => (x.id === t.id ? { ...x, messaging: next } : x)));
      toast.success(`${t.name}: ${what.toLowerCase()} ${on ? "texted" : "by email only"} from now on`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the template. Try again.");
    } finally {
      setSavingTemplate(null);
    }
  };

  // The finding line: what is texted right now
  const everyone = MESSAGE_EVENTS.filter((e) => saved.events[e.id].sms).map((e) => e.label.toLowerCase());
  const textingTemplates = templates.filter((t) => {
    const plan = readPlan(t.messaging);
    return [...SCHEDULE_EVENTS, "request.new" as const].some((e) => textsIn(plan?.events[e]) || plan?.schedule?.some((s) => s.sms));
  });
  const parts = [
    everyone.length ? `for everyone: ${everyone.join(", ")}` : null,
    textingTemplates.length ? `for ${textingTemplates.length === 1 ? "the template" : "the templates"} ${textingTemplates.map((t) => t.name).join(", ")}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8 pb-6">
      <p className="max-w-[72ch] text-[15px] leading-normal text-ink">
        Every message goes by email. Texts cost money, so one only goes where a switch is on.{" "}
        {parts.length ? `Texted now ${parts.join("; and ")}.` : "Nothing is texted right now."}
      </p>

      <SettingsSection
        id="templates-texts"
        title="Texts for some requests"
        description="Switch texts on for the requests that need one, like Payslip. Requests already sent keep what they had; new ones follow these switches."
      >
        {templates.length === 0 ? (
          <EmptyLine>
            No request templates yet. Make one in{" "}
            <Link href="/dashboard/templates" className="font-medium text-ink underline underline-offset-[3px]">
              Templates
            </Link>{" "}
            (for example Payslip), and its texts can be switched on here.
          </EmptyLine>
        ) : (
          <Panel className="p-0 sm:p-0">
            <div role="table" aria-label="Texts for each request template" className="divide-y divide-line">
              <div role="row" className="hidden grid-cols-[minmax(0,1fr)_96px_96px] items-center gap-4 px-5 py-3 text-[13px] font-medium text-ink-2 sm:grid">
                <span role="columnheader">Template</span>
                <span role="columnheader" className="text-center">
                  New request
                </span>
                <span role="columnheader" className="text-center">
                  Reminders
                </span>
              </div>
              {templates.map((t) => {
                const plan = readPlan(t.messaging);
                const newOn = templateTexts(plan, "request.new", saved);
                const ownSteps = !!plan?.schedule;
                const remindersOn = ownSteps ? plan!.schedule!.some((s) => s.sms) : SCHEDULE_EVENTS.every((e) => templateTexts(plan, e, saved));
                const busy = savingTemplate?.startsWith(`${t.id}:`) ?? false;
                return (
                  <div key={t.id} role="row" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_96px_96px] sm:px-5">
                    <div role="cell" className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                      <Link href={`/dashboard/templates/${t.id}/edit`} className="text-[13px] text-ink-2 underline-offset-[3px] hover:text-ink hover:underline">
                        Edit template
                      </Link>
                    </div>
                    <div role="cell" className="flex flex-col items-center gap-1">
                      <Switch
                        checked={newOn}
                        disabled={!canEditTemplates || busy}
                        onCheckedChange={(v) => void setTemplateTexts(t, ["request.new"], !!v, "New request")}
                        aria-label={`Text the new request for ${t.name}`}
                      />
                      <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                        New
                      </span>
                    </div>
                    <div role="cell" className="flex flex-col items-center gap-1">
                      {ownSteps ? (
                        <Link
                          href={`/dashboard/templates/${t.id}/edit`}
                          className="text-center text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink"
                        >
                          {remindersOn ? "Own steps, some texted" : "Own steps, email"}
                        </Link>
                      ) : (
                        <>
                          <Switch
                            checked={remindersOn}
                            disabled={!canEditTemplates || busy}
                            onCheckedChange={(v) => void setTemplateTexts(t, SCHEDULE_EVENTS, !!v, "Reminders")}
                            aria-label={`Text the reminders for ${t.name}`}
                          />
                          <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                            Reminders
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
        {!canEditTemplates && templates.length > 0 && <p className="mt-2 text-[13px] text-ink-2">Your role doesn&rsquo;t include editing templates.</p>}
      </SettingsSection>

      <SettingsSection
        id="grid"
        title="Messages for every creator"
        description="Applies to every request unless its template says otherwise. A template or a single request can set its own."
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
              return (
                <div key={e.id} role="row" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_72px_72px] sm:px-5">
                  <div role="cell" className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{e.label}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{describeChoice(c, draft.respectPreference)}</p>
                  </div>
                  <div role="cell" className="flex flex-col items-center gap-1 pt-0.5">
                    <Switch
                      checked={c.email}
                      disabled={!canEditAgency}
                      onCheckedChange={(v) => setEvent(e.id, { ...c, email: !!v })}
                      aria-label={`${e.label} by email`}
                    />
                    <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                      Email
                    </span>
                  </div>
                  <div role="cell" className="flex flex-col items-center gap-1 pt-0.5">
                    <Switch
                      checked={c.sms}
                      disabled={!canEditAgency}
                      onCheckedChange={(v) => setEvent(e.id, { ...c, sms: !!v })}
                      aria-label={`${e.label} by text`}
                    />
                    <span aria-hidden="true" className="text-[12px] text-ink-2 sm:hidden">
                      Text
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </SettingsSection>

      <SettingsSection id="consent" title="Contact preference" description="Each creator's profile says email, texts or both.">
        <Panel>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p id="respect-label" className="text-sm font-semibold text-ink">
                Only text creators who chose texts
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                {draft.respectPreference
                  ? "On: a creator whose profile says email never gets a text, even where a switch above is on."
                  : "Off: wherever a text is switched on, every creator with a phone number gets it."}{" "}
                A message that can&rsquo;t go by text goes by email instead, so nothing switched on is lost.
              </p>
            </div>
            <Switch
              checked={draft.respectPreference}
              disabled={!canEditAgency}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, respectPreference: !!v }))}
              aria-labelledby="respect-label"
            />
          </div>
        </Panel>
      </SettingsSection>

      {canEditAgency && (
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
            Save messages for every creator
          </Button>
        </div>
      )}
    </div>
  );
}
