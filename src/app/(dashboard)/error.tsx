"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Home, RefreshCw } from "lucide-react";
import { ErrorShell } from "@/components/errors/error-shell";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Dashboard Error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShell
      title="This section hit an error"
      message="Your work is safe. Try again, or head back to the dashboard."
      digest={error.digest}
      primaryAction={{ label: "Try again", onClick: reset, icon: RefreshCw }}
      secondaryAction={{ label: "Go to dashboard", href: "/dashboard", icon: Home }}
    >
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs break-words text-muted-foreground">
          {error.message}
        </p>
      )}
    </ErrorShell>
  );
}
