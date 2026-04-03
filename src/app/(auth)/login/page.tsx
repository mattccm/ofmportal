"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // First try team member login via NextAuth
      // Only include totpCode if 2FA is required and user has entered a code
      const credentials: Record<string, string | boolean> = {
        email,
        password,
        redirect: false,
      };
      if (requires2FA && totpCode) {
        credentials.totpCode = totpCode;
      }
      const result = await signIn("credentials", credentials);

      if (result?.ok && !result.error) {
        // Team member login successful
        router.push(callbackUrl);
        router.refresh();
        return;
      }

      // If team login failed with 2FA required, handle that
      if (result?.error === "2FA_REQUIRED") {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      // Log team login failure for debugging
      console.log("Team member login result:", result);

      // Team login failed, try creator login
      try {
        const creatorResponse = await fetch("/api/portal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const creatorData = await creatorResponse.json();

        if (creatorResponse.ok) {
          // Store creator token and info in localStorage
          localStorage.setItem("creatorToken", creatorData.token);
          localStorage.setItem("creatorId", creatorData.creatorId);
          localStorage.setItem("creatorName", creatorData.name);
          localStorage.setItem("creatorEmail", creatorData.email);
          localStorage.setItem("creatorOnboardingComplete", "true");

          // Also store in cookies for iOS PWA persistence (localStorage can be cleared on app close)
          const maxAge = 30 * 24 * 60 * 60; // 30 days
          document.cookie = `creatorToken=${creatorData.token}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `creatorId=${creatorData.creatorId}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `creatorName=${encodeURIComponent(creatorData.name)}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `creatorEmail=${encodeURIComponent(creatorData.email)}; path=/; max-age=${maxAge}; SameSite=Lax`;

          // Redirect to creator dashboard
          router.push("/creator/dashboard");
          return;
        }

        // Creator login also failed
        console.log("Creator login failed:", creatorData.error);
        setError(creatorData.error || "Invalid email or password");
        setLoading(false);
      } catch (fetchError) {
        console.error("Creator login fetch error:", fetchError);
        setError("Invalid email or password");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-muted-foreground">
          Sign in to access your portal
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-12 rounded-xl border-border bg-background px-4 transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-12 rounded-xl border-border bg-background px-4 transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {requires2FA && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label htmlFor="totpCode" className="text-sm font-medium">
                  Two-Factor Authentication
                </Label>
              </div>
              <Input
                id="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                disabled={loading}
                autoFocus
                className="h-14 rounded-xl border-border bg-background px-4 text-center text-2xl font-semibold tracking-widest transition-all focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl btn-gradient text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {requires2FA ? "Verify & Sign In" : "Sign In"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      {/* Footer */}
      <div className="pt-4 border-t border-border">
        <p className="text-sm text-center text-muted-foreground">
          Need access? Contact your administrator.
        </p>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-lg animate-shimmer" />
        <div className="h-5 w-64 bg-muted rounded-lg animate-shimmer" />
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full bg-muted rounded-xl animate-shimmer" />
        <div className="h-12 w-full bg-muted rounded-xl animate-shimmer" />
        <div className="h-12 w-full bg-muted rounded-xl animate-shimmer" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
