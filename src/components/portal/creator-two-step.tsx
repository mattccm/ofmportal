"use client";

import * as React from "react";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Creator Settings > Two-step sign-in: after their password, a code from an
 * authenticator app. Turning it on: add CCM to the app (one tap on a phone,
 * the key, or the QR code from a computer), type its code, keep the backup
 * codes. Turning it off or new backup codes: a current code.
 */

type Step =
  | { name: "loading" }
  | { name: "off" }
  | { name: "setup"; secret: string; qr: string; uri: string }
  | { name: "codes"; codes: string[] }
  | { name: "on"; left: number }
  | { name: "prove"; why: "disable" | "new-codes"; left: number };

function headers(): Record<string, string> {
  try {
    return { "Content-Type": "application/json", "x-creator-token": localStorage.getItem("creatorToken") || "" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

async function call(body?: unknown) {
  const res = await fetch("/api/portal/two-factor", body ? { method: "POST", headers: headers(), body: JSON.stringify(body) } : { headers: headers(), cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
  return data;
}

export function CreatorTwoStep() {
  const [step, setStep] = React.useState<Step>({ name: "loading" });
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    call()
      .then((d) => setStep(d.enabled ? { name: "on", left: d.backupCodesLeft ?? 0 } : { name: "off" }))
      .catch(() => setStep({ name: "off" }));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy. Select it and copy it instead.");
    }
  };

  const codeField = (label: string) => (
    <div className="mt-3 max-w-[260px]">
      <Label htmlFor="two-step-code">{label}</Label>
      <Input
        id="two-step-code"
        inputMode="text"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9a-fA-F-]/g, "").slice(0, 9))}
        placeholder="000000"
        className="mt-1.5 h-12 text-center text-xl font-semibold tracking-[0.25em] tabular-nums"
      />
    </div>
  );

  const errorLine = problem && (
    <p className="mt-2 text-[14px] text-late" role="alert">
      {problem}
    </p>
  );

  if (step.name === "loading") return <p className="text-[14px] text-ink-2">Checking…</p>;

  if (step.name === "off") {
    return (
      <div>
        <p className="text-[14px] leading-normal text-ink-2">
          Off. Turn it on and signing in with your password also needs a code from an authenticator app on your phone, so
          nobody gets in with just your password.
        </p>
        <Button
          className="mt-3 h-11 md:h-9"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const d = await call({ action: "start" });
              setCode("");
              setStep({ name: "setup", secret: d.secret, qr: d.qr, uri: d.uri });
            })
          }
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          Turn on two-step sign-in
        </Button>
        {errorLine}
      </div>
    );
  }

  if (step.name === "setup") {
    const key = step.secret.replace(/(.{4})/g, "$1 ").trim();
    return (
      <div>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-normal text-ink-2">
          <li>
            Add CCM to an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, or the Passwords app
            on an iPhone).
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-11 md:h-9">
                <a href={step.uri}>Add to my authenticator app</a>
              </Button>
              <Button variant="ghost" className="h-11 md:h-9" onClick={() => void copy(step.secret, "Key")}>
                <Copy aria-hidden="true" />
                Copy the key
              </Button>
            </div>
            <p className="mt-2 font-mono text-[13px] text-ink">{key}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the server */}
            <img src={step.qr} alt="QR code to scan with an authenticator app" width={160} height={160} className="mt-2 hidden rounded-md bg-white p-1 sm:block" />
            <p className="mt-1 hidden text-[13px] sm:block">On a computer? Scan this with the app on your phone.</p>
          </li>
          <li>Type the 6-digit code the app shows for CCM.</li>
        </ol>
        {codeField("Code from the app")}
        {errorLine}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="h-11 md:h-9"
            disabled={busy || code.replace(/\D/g, "").length !== 6}
            onClick={() =>
              void run(async () => {
                const d = await call({ action: "confirm", code });
                setCode("");
                setStep({ name: "codes", codes: d.backupCodes ?? [] });
              })
            }
          >
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Turn on
          </Button>
          <Button variant="ghost" className="h-11 md:h-9" onClick={() => setStep({ name: "off" })} disabled={busy}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === "codes") {
    return (
      <div>
        <p className="text-[14px] font-semibold text-ink">Two-step sign-in is on. Keep these backup codes somewhere safe.</p>
        <p className="mt-1 text-[14px] leading-normal text-ink-2">
          If you lose your phone, each one signs you in once instead of a code from the app. You won&rsquo;t see them again.
        </p>
        <ul className="mt-3 grid max-w-[320px] grid-cols-2 gap-x-6 gap-y-1 font-mono text-[15px] text-ink" aria-label="Backup codes">
          {step.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => void copy(step.codes.join("\n"), "Backup codes")}>
            <Copy aria-hidden="true" />
            Copy the codes
          </Button>
          <Button className="h-11 md:h-9" onClick={() => setStep({ name: "on", left: step.codes.length })}>
            I&rsquo;ve saved them
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === "prove") {
    const off = step.why === "disable";
    return (
      <div>
        <p className="text-[14px] leading-normal text-ink-2">
          {off ? "To turn it off, type a code from your authenticator app (or a backup code)." : "To get new backup codes, type a code from your authenticator app. The old backup codes stop working."}
        </p>
        {codeField("Code")}
        {errorLine}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={off ? "destructive" : "default"}
            className="h-11 md:h-9"
            disabled={busy || code.length < 6}
            onClick={() =>
              void run(async () => {
                const d = await call({ action: step.why, code });
                setCode("");
                if (off) {
                  setStep({ name: "off" });
                  toast("Two-step sign-in is off.");
                } else setStep({ name: "codes", codes: d.backupCodes ?? [] });
              })
            }
          >
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {off ? "Turn off" : "Get new codes"}
          </Button>
          <Button variant="ghost" className="h-11 md:h-9" onClick={() => setStep({ name: "on", left: step.left })} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // on
  return (
    <div>
      <p className="text-[14px] leading-normal text-ink-2">
        On. Signing in with your password also needs a code from your authenticator app.{" "}
        {step.left > 0 ? `${step.left} backup ${step.left === 1 ? "code" : "codes"} left.` : "No backup codes left: get new ones."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" className="h-11 md:h-9" onClick={() => (setCode(""), setProblem(null), setStep({ name: "prove", why: "new-codes", left: step.left }))}>
          New backup codes
        </Button>
        <Button variant="ghost" className="h-11 md:h-9" onClick={() => (setCode(""), setProblem(null), setStep({ name: "prove", why: "disable", left: step.left }))}>
          Turn off
        </Button>
      </div>
    </div>
  );
}
