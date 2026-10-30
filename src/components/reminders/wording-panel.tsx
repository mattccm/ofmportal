"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/creators/people-ui";
import { Segmented } from "@/components/messaging/plan-editor";
import { composeSample } from "@/lib/creator-emails";
import type { EmailBranding } from "@/lib/email-layout";
import { withBrandPrefix } from "@/lib/reminder-copy";
import {
  COPY_KEYS,
  COPY_MESSAGES,
  DEFAULT_COPY,
  composeSms,
  copyProblems,
  copyWarnings,
  isEdited,
  sampleValues,
  smsSegments,
  type AgencyCopy,
  type CopyField,
  type CopyKey,
} from "@/lib/message-copy";
import { cn } from "@/lib/utils";

const FIELD_LABEL: Record<CopyField, string> = {
  subject: "Subject",
  heading: "Heading",
  body: "Message",
  button: "Button",
  sms: "Text message",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Reminders > Wording: what every creator email and text says. Staff edit
 * plain text with fill-ins; the layout stays fixed. The preview renders the
 * real email (src/lib/creator-emails.ts) with sample values.
 */
export function WordingPanel({ initial, branding, canEdit }: { initial: AgencyCopy; branding: EmailBranding; canEdit: boolean }) {
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [key, setKey] = React.useState<CopyKey>("invite");
  const [view, setView] = React.useState<"email" | "text">("email");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const fieldRefs = React.useRef<Partial<Record<CopyField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const lastField = React.useRef<CopyField>("body");

  const copy = draft[key];
  const meta = COPY_MESSAGES[key];
  const problems = copyProblems(key, copy);
  const warnings = copyWarnings(key, copy);
  const allProblems = COPY_KEYS.flatMap((k) => copyProblems(k, draft[k]).map((p) => ({ ...p, key: k })));
  const dirty = !same(saved, draft);
  const edited = COPY_KEYS.filter((k) => isEdited(saved[k], k)).length;

  const deferred = React.useDeferredValue(copy);
  const email = React.useMemo(() => composeSample(key, deferred, branding), [key, deferred, branding]);
  const sms = withBrandPrefix(composeSms(deferred, sampleValues(key)));
  const seg = smsSegments(sms);

  const set = (field: CopyField, value: string) => setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));

  const insert = (fillIn: string) => {
    const field = fillIn === "link" ? "sms" : lastField.current;
    const el = fieldRefs.current[field];
    const token = `{{${fillIn}}}`;
    const value = copy[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(field, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/message-copy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save the wording");
      setSaved(data.copy);
      setDraft(data.copy);
      toast.success("Wording saved. Messages from now on use it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the wording. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/message-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, copy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The test email didn't send");
      toast.success(`Test email sent to ${data.sentTo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The test email didn't send. Try again.");
    } finally {
      setTesting(false);
    }
  };

  const field = (f: CopyField, opts: { multiline?: number; hint?: string } = {}) => {
    const id = `wording-${f}`;
    const own = problems.filter((p) => p.field === f);
    const heads = warnings.filter((w) => w.field === f);
    const describedBy = [opts.hint ? `${id}-hint` : null, heads.length ? `${id}-warn` : null, own.length ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
    const common = {
      id,
      value: copy[f],
      disabled: !canEdit,
      "aria-invalid": own.length > 0 || undefined,
      "aria-describedby": describedBy,
      onFocus: () => {
        lastField.current = f;
      },
    };
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {FIELD_LABEL[f]}
        </label>
        {opts.multiline ? (
          <Textarea
            {...common}
            rows={opts.multiline}
            ref={(el) => {
              fieldRefs.current[f] = el;
            }}
            onChange={(e) => set(f, e.target.value)}
          />
        ) : (
          <Input
            {...common}
            ref={(el) => {
              fieldRefs.current[f] = el;
            }}
            onChange={(e) => set(f, e.target.value)}
          />
        )}
        {opts.hint && (
          <p id={`${id}-hint`} className="mt-1 text-[13px] text-ink-2">
            {opts.hint}
          </p>
        )}
        {heads.length > 0 && (
          <p id={`${id}-warn`} className="mt-1 text-[13px] text-ink">
            <span className="font-semibold">Heads-up:</span> {heads.map((w) => w.message).join(" ")}
          </p>
        )}
        {own.length > 0 && (
          <p id={`${id}-err`} className="mt-1 text-[13px] text-late">
            {own.map((p) => p.message).join(". ")}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-6">
      <p className="max-w-[72ch] text-[15px] leading-normal text-ink">
        What each email and text says. The layout stays the same; the words are yours.{" "}
        {edited === 0 ? "Every message uses the standard wording." : `${edited} of ${COPY_KEYS.length} messages use your own wording.`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Messages" className="self-start overflow-hidden rounded-[10px] bg-tile">
          <ul className="divide-y divide-line">
            {COPY_KEYS.map((k) => {
              const unsaved = !same(saved[k], draft[k]);
              const broken = copyProblems(k, draft[k]).length > 0;
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setKey(k)}
                    aria-current={k === key ? "true" : undefined}
                    className={cn(
                      "flex w-full min-h-[56px] flex-col items-start justify-center px-4 py-2.5 text-left transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      k === key && "bg-tile-hi"
                    )}
                  >
                    <span className="text-sm font-semibold text-ink">{COPY_MESSAGES[k].label}</span>
                    <span className={cn("text-[13px]", broken ? "text-late" : "text-ink-2")}>
                      {broken ? "Needs a fix" : unsaved ? "Changed, not saved" : isEdited(saved[k], k) ? "Your wording" : "Standard wording"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel className="space-y-5">
              <div>
                <h2 className="text-[17px] font-semibold text-ink">{meta.label}</h2>
                <p className="mt-0.5 text-[13px] text-ink-2">Goes out when: {meta.when.charAt(0).toLowerCase() + meta.when.slice(1)}.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-[15px] font-semibold text-ink">Email</h3>
                {field("subject", { hint: "Shows on lock screens, in notifications and in inbox lists." })}
                {field("heading")}
                {field("body", { multiline: 6, hint: "A blank line starts a new paragraph. The request and the button are added for you." })}
                {field("button")}
              </div>

              <div className="space-y-2 border-t border-line pt-5">
                <h3 className="text-[15px] font-semibold text-ink">Text</h3>
                {field("sms", { multiline: 3, hint: "Starts with “CCM:”. Only sent where Email and texts switches a text on." })}
                <p className={cn("text-[13px] tabular-nums", seg.segments > 1 ? "font-semibold text-ink" : "text-ink-2")}>
                  About {seg.length} of {seg.perSegment} characters with a typical link.{" "}
                  {seg.segments > 1 ? `That's ${seg.segments} texts each time, so it costs ${seg.segments === 2 ? "double" : `${seg.segments} times as much`}.` : "One text each time."}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[13px] text-ink-2">Fill-ins: click one to add it where you&rsquo;re typing.</p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.fillIns.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => insert(f.key)}
                      title={f.label}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-ctl bg-well px-2 font-mono text-[12px] text-ink transition-colors hover:border-ctl-hi hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                    >
                      {`{{${f.key}}}`}
                      <span className="font-sans text-ink-2">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel className="space-y-3 self-start">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-ink">Preview</h3>
                <Segmented
                  label="Preview"
                  value={view}
                  options={[
                    { id: "email", label: "Email" },
                    { id: "text", label: "Text" },
                  ]}
                  onChange={setView}
                />
              </div>
              {view === "email" ? (
                <EmailPreview subject={email.subject} html={email.html} />
              ) : (
                <div className="rounded-[10px] bg-ground p-4">
                  <div className="rounded-[16px] bg-raised p-3">
                    <p className="text-[12.5px] font-semibold text-ink">Messages · CCM</p>
                    <p className="mt-1 break-words text-[13.5px] leading-snug text-ink">{sms}</p>
                  </div>
                  <p className="mt-2 text-[13px] text-ink-2">With sample details. Links are shortened when sent.</p>
                </div>
              )}
            </Panel>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              {isEdited(copy, key) && (
                <Button type="button" variant="ghost" onClick={() => setDraft((d) => ({ ...d, [key]: DEFAULT_COPY[key] }))} disabled={saving}>
                  Use the standard wording
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={testing || problems.some((p) => p.field !== "sms")}>
                {testing && <Loader2 className="animate-spin" aria-hidden="true" />}
                Email me a test
              </Button>
              {dirty && (
                <Button type="button" variant="outline" onClick={() => setDraft(saved)} disabled={saving}>
                  Discard changes
                </Button>
              )}
              <Button type="button" onClick={() => void save()} disabled={!dirty || saving || allProblems.length > 0}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                Save wording
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">Your role can see the wording but not change it.</p>
          )}
          {dirty && allProblems.length > 0 && (
            <p className="text-right text-[13px] text-late">
              Fix {COPY_MESSAGES[allProblems[0].key].label} first: {allProblems[0].message.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** The real email in a sandboxed frame, sized to its content */
function EmailPreview({ subject, html }: { subject: string; html: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(640);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(320, doc.documentElement.scrollHeight));
  };
  return (
    <div>
      <p className="mb-2 truncate text-[13px] text-ink-2">
        Subject: <span className="font-medium text-ink">{subject}</span>
      </p>
      <iframe
        ref={ref}
        title="Email preview"
        srcDoc={html}
        sandbox="allow-same-origin allow-popups"
        onLoad={fit}
        style={{ height }}
        className="w-full rounded-[8px] border border-line bg-ground"
      />
    </div>
  );
}
