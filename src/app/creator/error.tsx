"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, Mail, RefreshCw } from "lucide-react";
import { useBranding } from "@/components/providers/branding-provider";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Creator-area error boundary: keeps creators inside the creator app (the root
// error page links to the staff dashboard) and uses the agency's own support contact.
export default function CreatorError({ error, reset }: ErrorProps) {
  const { branding } = useBranding();
  const supportHref = branding.supportEmail
    ? `mailto:${branding.supportEmail}`
    : branding.supportUrl && /^https?:\/\//i.test(branding.supportUrl)
      ? branding.supportUrl
      : null;

  useEffect(() => {
    console.error("Creator Error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            This page couldn&apos;t be loaded. Please try again.
            {error.digest && (
              <span className="block mt-2 text-xs font-mono">Error ID: {error.digest}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={reset} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="outline" asChild className="flex-1">
              <Link href="/creator/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            {supportHref && (
              <Button variant="ghost" asChild className="flex-1 text-muted-foreground">
                <a
                  href={supportHref}
                  {...(branding.supportEmail
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Support
                </a>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
