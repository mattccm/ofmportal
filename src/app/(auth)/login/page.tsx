"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";
import {
  createRememberToken,
  isIOSPWA,
  attemptAutoLogin,
  isIndexedDBAvailable,
  getRememberToken,
  hasIndicatorCookie,
  hasSignedOutFlag,
  clearSignedOutFlag,
  storeCreatorSession,
} from "@/lib/remember-token";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [autoLoginInProgress, setAutoLoginInProgress] = useState(false);
  const autoLoginAttempted = useRef(false);

  // Check if running as PWA on mount and attempt auto-login
  useEffect(() => {
    const isPWAMode = isIOSPWA();
    setIsPWA(isPWAMode);

    // Default to stay signed in when running as PWA
    if (isPWAMode) {
      setStaySignedIn(true);
    }

    // Attempt auto-login if we have a remember token
    // This is the PRIMARY auto-login trigger for returning PWA users
    const tryAutoLogin = async () => {
      // Don't retry if already attempted
      if (autoLoginAttempted.current) return;

      // Check if user intentionally signed out - don't auto-login
      if (hasSignedOutFlag()) {
        console.log("[Login] User signed out intentionally, skipping auto-login");
        return;
      }

      // Quick check: if no indicator cookie, likely no token
      // This is a fast synchronous check before doing async storage checks
      if (!hasIndicatorCookie() && !isPWAMode) {
        console.log("[Login] No indicator cookie and not in PWA mode, skipping auto-login");
        return;
      }

      // Check if we have a stored token (checks IndexedDB and localStorage)
      const storedToken = await getRememberToken();
      if (!storedToken) {
        console.log("[Login] No remember token found in any storage");
        return;
      }

      console.log("[Login] Found remember token, attempting auto-login");
      autoLoginAttempted.current = true;
      setAutoLoginInProgress(true);

      try {
        const result = await attemptAutoLogin();

        if (result) {
          console.log("[Login] Auto-login validated, creating session");
          const signInResult = await signIn("credentials", {
            redirect: false,
            email: result.user.email,
            password: "__REMEMBER_TOKEN_VALIDATED__",
            rememberUserId: result.user.id,
          });

          if (signInResult?.ok) {
            console.log("[Login] Session created, redirecting to:", callbackUrl);
            router.push(callbackUrl);
            router.refresh();
            return;
          } else {
            console.error("[Login] signIn failed:", signInResult?.error);
          }
        }
      } catch (err) {
        console.error("[Login] Auto-login error:", err);
      } finally {
        setAutoLoginInProgress(false);
      }
    };

    // Run auto-login check immediately
    tryAutoLogin();
  }, [callbackUrl, router]);

  // If already authenticated, redirect
  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, callbackUrl, router]);

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
        // Clear the signed-out flag since user is logging in
        clearSignedOutFlag();

        // Create remember token if user opted in (especially for PWA)
        if (staySignedIn) {
          try {
            await createRememberToken();
            console.log("Remember token created successfully");
          } catch (err) {
            console.error("Failed to create remember token:", err);
            // Non-blocking - continue with login even if token creation fails
          }
        }
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
          // Clear the signed-out flag since user is logging in
          clearSignedOutFlag();

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

          // Store in IndexedDB for iOS PWA persistence (most reliable on iOS)
          let indexedDBSuccess = false;
          try {
            await storeCreatorSession({
              token: creatorData.token,
              creatorId: creatorData.creatorId,
              name: creatorData.name,
              email: creatorData.email,
            });
            indexedDBSuccess = true;
          } catch (err) {
            console.warn("Failed to store creator session in IndexedDB:", err);
          }

          // Send debug log to server
          try {
            await fetch("/api/debug/session-log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId: localStorage.getItem("debug-device-id") || "unknown",
                event: "creator-login",
                data: {
                  email: creatorData.email,
                  creatorId: creatorData.creatorId,
                  indexedDBSuccess,
                  localStorageSet: true,
                  cookiesSet: true,
                  isPWA: isIOSPWA(),
                  timestamp: new Date().toISOString(),
                },
              }),
            });
          } catch (e) {
            // Ignore debug log failures
          }

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

  // Show loading state during auto-login or if already authenticated
  if (autoLoginInProgress || status === "authenticated") {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {autoLoginInProgress ? "Signing you in..." : "Redirecting..."}
          </h1>
          <p className="text-muted-foreground text-sm">
            {autoLoginInProgress ? "Using your saved credentials" : "Please wait..."}
          </p>
        </div>
      </div>
    );
  }

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

          {/* Stay Signed In - especially useful for PWA users */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="staySignedIn"
              checked={staySignedIn}
              onCheckedChange={(checked) => setStaySignedIn(checked === true)}
              disabled={loading}
            />
            <div className="flex items-center gap-2">
              <Label
                htmlFor="staySignedIn"
                className="text-sm font-medium cursor-pointer"
              >
                Stay signed in
              </Label>
              {isPWA && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Smartphone className="h-3 w-3" />
                  Recommended for app
                </span>
              )}
            </div>
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
