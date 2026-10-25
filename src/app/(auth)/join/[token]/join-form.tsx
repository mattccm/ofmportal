"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSignedOutFlag } from "@/lib/remember-token";
import { formatDay } from "@/components/title-wall";

const requirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
];

type Problem = { text: string; signIn?: boolean } | null;

export function JoinForm({
  token,
  agencyName,
  roleLabel,
  invitedBy,
  name: initialName,
  email: initialEmail,
  emailLocked,
  expiresAt,
}: {
  token: string;
  agencyName: string;
  roleLabel: string;
  invitedBy: string | null;
  name: string;
  email: string;
  emailLocked: boolean;
  expiresAt: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  const article = /^[aeiou]/i.test(roleLabel) ? "an" : "a";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (password !== confirm) {
      setProblem({ text: "The two passwords don't match. Type them again." });
      return;
    }
    if (requirements.some((r) => !r.test(password))) {
      setProblem({ text: "Your password needs everything in the list under it." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password, confirmPassword: confirm }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.reason && data.reason !== "email_taken" && res.status === 410) {
          // The link stopped working while the form was open: show the calm page
          router.refresh();
        }
        setProblem({
          text: data?.error || "Your account could not be set up. Try again.",
          signIn: data?.reason === "email_taken" || data?.reason === "accepted",
        });
        setBusy(false);
        return;
      }

      // Same sign-in the login page uses
      clearSignedOutFlag();
      const result = await signIn("credentials", { redirect: false, email: data.email, password });
      if (result?.ok && !result.error) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      router.push(`/login?email=${encodeURIComponent(data.email)}`);
    } catch {
      setProblem({ text: "Your account could not be set up. Check your connection and try again." });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Join {agencyName}</h1>
        <p className="text-[15px] leading-normal text-ink-2">
          {invitedBy ? `${invitedBy} invited you` : "You've been invited"} to join the team as {article}{" "}
          <strong className="font-semibold text-ink">{roleLabel}</strong>. Choose a password to set up your account.
        </p>
        <p className="text-[13px] text-ink-2" suppressHydrationWarning>
          This link works once, until {formatDay(expiresAt)}.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {problem && (
          <div role="alert" className="rounded-[8px] border border-late/35 bg-late/10 p-3.5 text-[15px] text-ink">
            {problem.text}
            {problem.signIn && (
              <>
                {" "}
                <Link
                  href={`/login?email=${encodeURIComponent(email)}`}
                  className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
                >
                  Go to sign in
                </Link>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="join-name">Your name</Label>
          <Input
            id="join-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            disabled={busy}
            className="h-12 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="join-email">Email address</Label>
          <Input
            id="join-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={emailLocked}
            aria-describedby={emailLocked ? "join-email-hint" : undefined}
            required
            disabled={busy}
            className="h-12 px-4 read-only:text-ink-2"
          />
          {emailLocked && (
            <p id="join-email-hint" className="text-[13px] text-ink-2">
              This invite is for this address. You&apos;ll sign in with it.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="join-password">Choose a password</Label>
          <Input
            id="join-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
            aria-describedby="join-password-rules"
            className="h-12 px-4"
          />
          <ul id="join-password-rules" className="mt-2 space-y-1">
            {requirements.map((r) => {
              const met = !!password && r.test(password);
              return (
                <li key={r.label} className={`flex items-center text-sm ${met ? "text-ink" : "text-ink-2"}`}>
                  {met ? <Check className="mr-2 size-4" aria-hidden="true" /> : <X className="mr-2 size-4" aria-hidden="true" />}
                  {r.label}
                  <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="join-confirm">Type the password again</Label>
          <Input
            id="join-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={busy}
            aria-invalid={!!confirm && confirm !== password}
            className="h-12 px-4"
          />
          {confirm && confirm !== password && (
            <p className="text-sm text-ink-2">The passwords don&apos;t match yet.</p>
          )}
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full text-base">
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {busy ? "Setting up your account…" : "Create account and sign in"}
        </Button>
      </form>

      <p className="text-[15px] text-ink-2">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
