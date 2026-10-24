"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { Home, RefreshCw } from "lucide-react";
import { ErrorShell } from "@/components/errors/error-shell";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Creator-facing routes must never link to staff URLs
function isCreatorPath(pathname: string | null): boolean {
  return !!pathname && /^\/(creator|portal)(\/|$)/.test(pathname);
}

export default function Error({ error, reset }: ErrorProps) {
  const pathname = usePathname();
  const creator = isCreatorPath(pathname);

  useEffect(() => {
    console.error("App Error:", error);
    Sentry.captureException(error);

    // Server-side error log (best effort)
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    }).catch(() => {
      // Silently fail
    });
  }, [error]);

  return (
    <ErrorShell
      fullScreen
      title="Something went wrong"
      message="This page hit an unexpected error. Your data is safe, so try again or head back home."
      digest={error.digest}
      primaryAction={{ label: "Try again", onClick: reset, icon: RefreshCw }}
      secondaryAction={
        creator
          ? { label: "Go to my dashboard", href: "/creator/dashboard", icon: Home }
          : { label: "Go to dashboard", href: "/dashboard", icon: Home }
      }
    />
  );
}
