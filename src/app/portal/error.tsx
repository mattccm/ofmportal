"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Mail,
  ChevronDown,
  ChevronUp,
  Copy,
  Upload,
} from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PortalError({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log the error
    console.error("Portal Error:", error);

    const errorLog = {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      section: "portal",
    };

    console.group("Portal Error Boundary");
    console.log("Error Details:", errorLog);
    console.groupEnd();
  }, [error]);

  const handleCopyError = () => {
    const errorText = `
Portal Error Report
===================
Error: ${error.message}
ID: ${error.digest || "N/A"}
URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-background to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20">
      <div className="max-w-md w-full">
        <Card className="border-amber-200/50 dark:border-amber-800/30 shadow-xl">
          {/* Header gradient */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 rounded-t-xl" />

          <CardHeader className="text-center pt-8 pb-4">
            {/* Icon */}
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>

            <CardTitle className="text-xl">
              Something Went Wrong
            </CardTitle>
            <CardDescription className="text-base mt-2">
              We encountered an error while loading this page. Don&apos;t worry - your uploads are safe.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error summary */}
            {error.message && (
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-center">
                <p className="text-sm text-muted-foreground">
                  {error.message}
                </p>
              </div>
            )}

            {/* Technical details */}
            {error.stack && (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    Technical Details
                  </span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showDetails && (
                  <div className="border-t border-border/50 p-3 bg-muted/30">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyError}
                        className="h-7 text-xs"
                      >
                        {copied ? (
                          <span className="text-emerald-500">Copied!</span>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto max-h-24 overflow-y-auto p-2 bg-background rounded-lg font-mono">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Help text */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 text-center">
              <p className="text-sm text-blue-700/70 dark:text-blue-300/70">
                If you need assistance, please contact your agency or email support.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
            <Button
              onClick={reset}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>

            <div className="flex gap-2 w-full">
              <Button variant="outline" asChild className="flex-1">
                <Link href="/login">
                  <Upload className="h-4 w-4 mr-2" />
                  Portal Home
                </Link>
              </Button>
              <Button
                variant="ghost"
                asChild
                className="flex-1 text-muted-foreground"
              >
                <a href="mailto:support@contentportal.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Support
                </a>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
