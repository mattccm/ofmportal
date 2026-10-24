"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Home, RefreshCw } from "lucide-react";
import { ErrorShell } from "@/components/errors/error-shell";
import { useBranding } from "@/components/providers/branding-provider";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Legacy creator portal boundary: keeps creators inside the creator app
// (never links to staff URLs) and prefers the agency's own support address.
export default function PortalError({ error, reset }: ErrorProps) {
  const { branding } = useBranding();

  useEffect(() => {
    console.error("Portal Error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShell
      fullScreen
      title="Something went wrong"
      message="This page couldn't be loaded. Don't worry, your uploads are safe."
      digest={error.digest}
      supportEmail={branding.supportEmail}
      primaryAction={{ label: "Try again", onClick: reset, icon: RefreshCw }}
      secondaryAction={{ label: "Go to my dashboard", href: "/creator/dashboard", icon: Home }}
    />
  );
}
