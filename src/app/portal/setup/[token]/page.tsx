"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Loader2, Check, X, Clock, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";
import { storeCreatorSession, clearSignedOutFlag } from "@/lib/remember-token";
import { setCreatorCookie } from "@/lib/creator-cookies";

interface Creator {
  id: string;
  name: string;
  email: string;
  agencyName: string;
}

interface CreatorSessionPayload {
  token: string;
  creatorId: string;
  name: string;
  email: string;
  onboardingCompleted?: boolean;
}

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
];

const inputClass = "h-12 text-base";

/**
 * Stores a creator session exactly like the login page does for creators
 * (localStorage, iOS-PWA cookies, IndexedDB) and returns where to go next.
 */
async function signInCreator(session: CreatorSessionPayload): Promise<string> {
  clearSignedOutFlag();

  localStorage.setItem("creatorToken", session.token);
  localStorage.setItem("creatorId", session.creatorId);
  localStorage.setItem("creatorName", session.name);
  localStorage.setItem("creatorEmail", session.email);
  const onboardingComplete = session.onboardingCompleted === true;
  localStorage.setItem("creatorOnboardingComplete", onboardingComplete ? "true" : "false");

  const maxAge = 30 * 24 * 60 * 60; // 30 days
  setCreatorCookie("creatorToken", session.token, maxAge);
  setCreatorCookie("creatorId", session.creatorId, maxAge);
  setCreatorCookie("creatorName", encodeURIComponent(session.name), maxAge);
  setCreatorCookie("creatorEmail", encodeURIComponent(session.email), maxAge);

  try {
    await storeCreatorSession({
      token: session.token,
      creatorId: session.creatorId,
      name: session.name,
      email: session.email,
    });
  } catch (err) {
    console.warn("Failed to store creator session in IndexedDB:", err);
  }

  // First-time creators go through onboarding before the dashboard
  return onboardingComplete ? "/creator/dashboard" : "/portal/onboarding";
}

function BrandHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Image
        src={BRAND.logoPath}
        alt={BRAND.name}
        width={40}
        height={40}
        className="size-10 object-contain invert"
        priority
      />
      <div className="space-y-2">
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance text-ink">{title}</h1>
        {subtitle && <p className="text-[15px] leading-normal text-ink-2">{subtitle}</p>}
      </div>
    </div>
  );
}

function SetupFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(2.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-[var(--tw-r-tile)] bg-tile">
          <div className="space-y-6 p-5 sm:p-8">{children}</div>
        </div>
        <p className="text-center text-[13px] text-ink-2">
          &copy; {new Date().getFullYear()} {BRAND.legalName}
        </p>
      </div>
    </div>
  );
}

export default function PortalSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [error, setError] = useState<{ reason: "expired" | "invalid" | "network"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch(`/api/portal/verify-invite?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || data.valid === false) {
          setError({
            reason: data.reason === "expired" ? "expired" : "invalid",
            text: data.error || "This invite link no longer works.",
          });
          setLoading(false);
          return;
        }

        setCreator(data);
      } catch {
        setError({ reason: "network", text: "We couldn't check this invite. Check your connection and reload the page." });
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("The two passwords don't match. Type them again.");
      return;
    }

    const failedReqs = passwordRequirements.filter((req) => !req.test(formData.password));
    if (failedReqs.length > 0) {
      toast.error("Your password needs everything in the list under it.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/portal/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Setup failed");
        setSubmitting(false);
        return;
      }

      const session = data.session as CreatorSessionPayload | null | undefined;
      if (session?.token) {
        const next = await signInCreator(session);
        toast.success("You're all set");
        router.push(next);
        return;
      }

      // No session (e.g. access paused): fall back to signing in manually
      toast.success("You're all set. Please sign in.");
      router.push(`/login?email=${encodeURIComponent(creator!.email)}`);
    } catch {
      toast.error("Couldn't finish setting up your account. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SetupFrame>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-icon motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-[15px] text-ink-2">Checking your invite…</p>
        </div>
      </SetupFrame>
    );
  }

  if (error) {
    const Icon = error.reason === "expired" ? Clock : Link2Off;
    return (
      <SetupFrame>
        <BrandHeader
          title={
            error.reason === "expired"
              ? "This invite link has expired"
              : error.reason === "network"
                ? "We couldn't check this invite"
                : "This invite link no longer works"
          }
        />
        <div className="flex gap-3 rounded-[var(--tw-r-ctl)] bg-well p-3.5">
          <Icon className="mt-0.5 size-4 shrink-0 text-icon" aria-hidden="true" />
          <p className="text-[15px] text-ink">{error.text}</p>
        </div>
        {error.reason !== "network" && (
          <p className="text-[15px] leading-normal text-ink-2">
            Ask your team for a new link.
          </p>
        )}
        <p className="text-[15px] text-ink-2">
          Already set up your account?{" "}
          <Link
            href="/login"
            className="font-medium text-ink underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink"
          >
            Sign in
          </Link>
        </p>
      </SetupFrame>
    );
  }

  return (
    <SetupFrame>
      <BrandHeader
        title={`Set up your ${BRAND.name} account`}
        subtitle={
          <>
            Hi {creator?.name}. Create a password to start sharing content with{" "}
            <strong className="text-foreground">{creator?.agencyName}</strong>.
          </>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={creator?.email || ""}
            readOnly
            disabled
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Create password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a secure password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            disabled={submitting}
            className={inputClass}
          />
          <ul className="mt-2 space-y-1">
            {passwordRequirements.map((req) => {
              const met = !!formData.password && req.test(formData.password);
              return (
                <li
                  key={req.label}
                  className={`flex items-center text-sm ${met ? "text-ink" : "text-ink-2"}`}
                >
                  {met ? (
                    <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  ) : (
                    <X className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {req.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            disabled={submitting}
            className={inputClass}
          />
          {formData.confirmPassword && (
            <div
              className={`flex items-center text-sm ${
                formData.password === formData.confirmPassword ? "text-ink" : "text-late"
              }`}
            >
              {formData.password === formData.confirmPassword ? (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  Passwords match
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" aria-hidden="true" />
                  Passwords do not match
                </>
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full text-base font-semibold"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "Setting up…" : "Create account and sign in"}
        </Button>
      </form>
    </SetupFrame>
  );
}
