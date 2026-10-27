"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyLine, PageHead, Panel, SettingsSection } from "@/components/creators/people-ui";
import { cn } from "@/lib/utils";

interface Status {
  provider: "bird" | "twilio" | "none";
  region?: string;
  sender?: string;
  senderNumber?: string | null;
}
interface Destination {
  country_code: string;
  enabled: boolean;
  [field: string]: unknown;
}
interface SentMessage {
  id?: string;
  status?: string;
  segments?: { count?: number; encoding?: string };
  cost?: { amount?: string | number; currency_code?: string } | null;
  last_error?: unknown;
}

// Where most creators are: one press switches these on
const SUGGESTED = ["AU", "GB", "AR", "US"];

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Bird marks countries it can't currently deliver to; read whichever flag it sends */
function undeliverable(d: Destination): boolean {
  for (const k of ["deliverable", "available", "supported", "is_deliverable"]) if (d[k] === false) return true;
  return typeof d.status === "string" && /unavailable|unsupported|blocked/i.test(d.status);
}

export default function SmsSettingsClient() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [destinations, setDestinations] = React.useState<Destination[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sms");
      const data = await res.json();
      setStatus(data.status ?? null);
      setDestinations(Array.isArray(data.destinations) ? data.destinations : []);
      setLoadError(data.error ?? (res.ok ? null : "Couldn't load text message settings"));
    } catch {
      setLoadError("Couldn't load text message settings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = async (changes: { country_code: string; enabled: boolean }[], label: string) => {
    setSaving(label);
    try {
      const res = await fetch("/api/settings/sms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinations: changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bird didn't save that");
      if (Array.isArray(data.destinations)) setDestinations(data.destinations);
      toast.success(
        changes.length === 1
          ? `${countryName(changes[0].country_code)} ${changes[0].enabled ? "switched on" : "switched off"}`
          : `${changes.length} countries switched on`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bird didn't save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const enabled = destinations.filter((d) => d.enabled).sort((a, b) => countryName(a.country_code).localeCompare(countryName(b.country_code)));
  const missingSuggested = SUGGESTED.filter((c) => !destinations.some((d) => d.country_code === c && d.enabled));
  const q = query.trim().toLowerCase();
  const matches = q
    ? destinations
        .filter((d) => countryName(d.country_code).toLowerCase().includes(q) || d.country_code.toLowerCase() === q)
        .sort((a, b) => countryName(a.country_code).localeCompare(countryName(b.country_code)))
        .slice(0, 30)
    : [];

  const connected = status?.provider === "bird";
  const lede = loading
    ? "Checking the connection to Bird…"
    : connected
      ? `Texts go out through Bird as “${status?.sender ?? "CCM"}”. ${enabled.length === 0 ? "No countries are switched on yet." : `${enabled.length} ${enabled.length === 1 ? "country is" : "countries are"} switched on.`}`
      : "Texts aren't connected yet, so the portal only logs them.";

  return (
    <div className="space-y-8">
      <PageHead title="Text messages" lede={lede} back={{ href: "/dashboard/settings", label: "Settings" }} />

      {loadError && (
        <EmptyLine>
          {loadError}{" "}
          <button type="button" onClick={() => void load()} className="font-medium text-ink underline underline-offset-[3px]">
            Try again
          </button>
        </EmptyLine>
      )}

      <SettingsSection id="connection" title="Connection" description="The SMS provider the portal sends through. Its key lives in Vercel and is never shown here.">
        <Panel>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
            </p>
          ) : connected ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-[180px_1fr]">
              <dt className="text-ink-2">Provider</dt>
              <dd className="text-ink">Bird ({status?.region === "eu1" ? "EU region" : status?.region === "us1" ? "US region" : status?.region})</dd>
              <dt className="text-ink-2">Shown as</dt>
              <dd className="text-ink">“{status?.sender}” where networks allow a sender name</dd>
              <dt className="text-ink-2">US and Canada</dt>
              <dd className="text-ink">
                {status?.senderNumber ? (
                  <>From {status.senderNumber}</>
                ) : (
                  <span className="text-ink-2">
                    Can&rsquo;t receive texts yet. These countries need a number your Bird workspace owns, added in Vercel as BIRD_SENDER_NUMBER.
                  </span>
                )}
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-ink-2">
              {status?.provider === "twilio"
                ? "Texts go out through Twilio. Add BIRD_API_KEY in Vercel to switch to Bird."
                : "Add BIRD_API_KEY in Vercel (Settings → Environment Variables), then redeploy."}
            </p>
          )}
        </Panel>
      </SettingsSection>

      {connected && (
        <SettingsSection
          id="countries"
          title="Countries"
          description="Bird only texts countries you switch on here. Each country costs a different amount per text."
        >
          <Panel className="space-y-5">
            {missingSuggested.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink">
                  Where your creators are: {missingSuggested.map(countryName).join(", ")}
                  {missingSuggested.length === 1 ? " isn't" : " aren't"} on yet.
                </p>
                <Button
                  size="sm"
                  onClick={() => void update(missingSuggested.map((c) => ({ country_code: c, enabled: true })), "suggested")}
                  disabled={saving !== null}
                >
                  {saving === "suggested" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Switch {missingSuggested.length === 1 ? "it" : "them"} on
                </Button>
              </div>
            )}

            <div>
              <h3 className="text-[15px] font-semibold text-ink">Switched on</h3>
              {enabled.length === 0 ? (
                <p className="mt-1 text-sm text-ink-2">None yet. Texts to every country are refused until you switch it on.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {enabled.map((d) => (
                    <CountryRow key={d.country_code} d={d} busy={saving === d.country_code} disabled={saving !== null} onChange={(v) => void update([{ country_code: d.country_code, enabled: v }], d.country_code)} />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label htmlFor="sms-country-search" className="text-[15px] font-semibold text-ink">
                Add a country
              </label>
              <Input
                id="sms-country-search"
                className="mt-2 max-w-sm"
                placeholder="Search, e.g. Spain"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {q && (
                <ul className="mt-2 divide-y divide-line">
                  {matches.length === 0 ? (
                    <li className="py-3 text-sm text-ink-2">No country matches “{query}”.</li>
                  ) : (
                    matches.map((d) => (
                      <CountryRow key={d.country_code} d={d} busy={saving === d.country_code} disabled={saving !== null} onChange={(v) => void update([{ country_code: d.country_code, enabled: v }], d.country_code)} />
                    ))
                  )}
                </ul>
              )}
            </div>
          </Panel>
        </SettingsSection>
      )}

      {connected && <TestText />}
    </div>
  );
}

function CountryRow({
  d,
  busy,
  disabled,
  onChange,
}: {
  d: Destination;
  busy: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const name = countryName(d.country_code);
  const blocked = undeliverable(d);
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{name}</p>
        {blocked && <p className="text-[13px] text-ink-2">Bird can&rsquo;t deliver here at the moment</p>}
      </div>
      {busy && <Loader2 className="size-4 animate-spin text-ink-2" aria-hidden="true" />}
      <Switch checked={d.enabled} disabled={disabled} onCheckedChange={(v) => onChange(!!v)} aria-label={`Texts to ${name}`} />
    </li>
  );
}

function TestText() {
  const [to, setTo] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string; detail?: string } | null>(null);
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }, []);

  // Delivery is reported a few seconds after Bird accepts the text
  const follow = (id: string, tries = 0) => {
    pollRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/settings/sms?message=${encodeURIComponent(id)}`);
        const data = await res.json();
        const m: SentMessage | undefined = data.message;
        if (!m) return;
        const cost = m.cost?.amount != null ? `${m.cost.amount} ${m.cost.currency_code ?? ""}`.trim() : null;
        const detail = [
          m.segments?.count ? `${m.segments.count} segment${m.segments.count === 1 ? "" : "s"}` : null,
          m.segments?.encoding ? m.segments.encoding.replace("_", " ") : null,
          cost ? `cost ${cost}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const done = ["delivered", "undelivered", "failed", "rejected", "expired"].includes(m.status ?? "");
        setResult({
          ok: !["undelivered", "failed", "rejected", "expired"].includes(m.status ?? ""),
          text: m.status === "delivered" ? "Delivered" : done ? `Not delivered (${m.status})` : `Sent, waiting for the phone network (${m.status ?? "accepted"})`,
          detail: detail || undefined,
        });
        if (!done && tries < 10) follow(id, tries + 1);
      } catch {
        /* keep the last known result */
      }
    }, 3000);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The text didn't send");
      setResult({ ok: true, text: "Sent to Bird, waiting for the phone network" });
      if (data.sent?.id) follow(data.sent.id);
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "The text didn't send" });
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsSection id="test" title="Send a test text" description="Texts the number below once, from the portal, exactly as creators receive texts.">
      <Panel>
        <form onSubmit={send} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 sm:max-w-sm">
            <label htmlFor="sms-test-to" className="text-sm font-medium text-ink">
              Mobile number
            </label>
            <Input
              id="sms-test-to"
              className="mt-1.5"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+61 412 345 678"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-describedby="sms-test-hint"
            />
            <p id="sms-test-hint" className="mt-1.5 text-[13px] text-ink-2">
              With the country code.
            </p>
          </div>
          <Button type="submit" disabled={sending || !to.trim()} className="sm:mb-[26px]">
            {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Send test text
          </Button>
        </form>
        {result && (
          <p role="status" className={cn("mt-4 text-sm", result.ok ? "text-ink" : "text-late")}>
            {result.text}
            {result.detail && <span className="block text-[13px] text-ink-2">{result.detail}</span>}
          </p>
        )}
      </Panel>
    </SettingsSection>
  );
}
