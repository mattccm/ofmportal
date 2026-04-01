"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertOctagon,
  RefreshCw,
  Home,
  Mail,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Server,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("App Error:", error);

    // Structure error for logging
    const errorLog = {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    console.group("Root Error Boundary");
    console.log("Error Details:", errorLog);
    console.groupEnd();

    // TODO: Send to error tracking service
    // reportError(errorLog);
  }, [error]);

  const handleCopyError = () => {
    const errorText = `
Error: ${error.message}
Digest: ${error.digest || "N/A"}
URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}
Timestamp: ${new Date().toISOString()}
Stack: ${error.stack || "No stack trace"}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-rose-50 via-background to-orange-50 dark:from-rose-950/20 dark:via-background dark:to-orange-950/20">
      <div className="max-w-lg w-full">
        <Card className="border-rose-200/50 dark:border-rose-800/30 shadow-2xl">
          {/* Animated gradient header */}
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 rounded-t-xl animate-pulse" />

          <CardHeader className="text-center pt-8 pb-4">
            {/* Error icon with animation */}
            <div className="mx-auto relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-lg shadow-rose-500/20 animate-bounce-slow">
                <AlertOctagon className="h-10 w-10 text-rose-500" />
              </div>
              {/* Decorative rings */}
              <div className="absolute inset-0 h-20 w-20 rounded-2xl border-2 border-rose-300/30 animate-ping" />
            </div>

            <CardTitle className="text-2xl mt-6">
              Something Went Wrong
            </CardTitle>
            <CardDescription className="text-base mt-2 max-w-sm mx-auto">
              We encountered an unexpected error while processing your request. Don&apos;t worry - your data is safe.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error summary card */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-start gap-3">
                <Server className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Error Information
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 break-words">
                    {error.message || "An unknown error occurred"}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible stack trace */}
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
                            Copy Error
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto max-h-40 overflow-y-auto p-2 bg-background rounded-lg font-mono whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Recovery suggestions */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                What you can try:
              </p>
              <ul className="text-sm text-amber-700/70 dark:text-amber-300/70 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">1.</span>
                  Click &quot;Try Again&quot; to reload this page
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">2.</span>
                  Clear your browser cache and refresh
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">3.</span>
                  If the problem persists, contact support
                </li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
            {/* Primary actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                onClick={reset}
                className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-lg shadow-rose-500/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/dashboard">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button
                variant="ghost"
                onClick={handleGoBack}
                className="flex-1 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button
                variant="ghost"
                asChild
                className="flex-1 text-muted-foreground"
              >
                <a href="mailto:support@contentportal.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Support
                </a>
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Footer text */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          If you continue to experience issues, please email{" "}
          <a
            href="mailto:support@contentportal.com"
            className="text-primary hover:underline"
          >
            support@contentportal.com
          </a>
        </p>
      </div>

      {/* Add custom animation */}
      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
