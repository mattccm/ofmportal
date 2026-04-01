"use client";

import { ErrorInfo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  ExternalLink,
  ShieldAlert,
  Frown,
  Bug,
} from "lucide-react";
import Link from "next/link";

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  onRetry?: () => void;
  onReport?: () => void;
  level?: "page" | "section" | "widget";
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  errorInfo,
  onRetry,
  onReport,
  level = "page",
  title,
  description,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyError = () => {
    const errorText = `
Error: ${error?.message || "Unknown error"}
Stack: ${error?.stack || "No stack trace"}
Component Stack: ${errorInfo?.componentStack || "No component stack"}
URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Different layouts based on error level
  if (level === "widget") {
    return (
      <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/30">
        <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-2">
          <AlertCircle className="h-5 w-5 text-rose-500" />
        </div>
        <p className="text-sm text-muted-foreground text-center mb-3">
          {title || "Unable to load this section"}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (level === "section") {
    return (
      <Card className="border-rose-200/50 dark:border-rose-800/30 bg-gradient-to-br from-rose-50/50 to-orange-50/30 dark:from-rose-950/20 dark:to-orange-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <CardTitle className="text-base">
                {title || "Something went wrong"}
              </CardTitle>
              <CardDescription>
                {description || "This section encountered an error"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            We apologize for the inconvenience. You can try refreshing this section or continue using other parts of the application.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Full page error fallback
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <Card className="border-rose-200/50 dark:border-rose-800/30 shadow-xl">
          {/* Header with calming gradient */}
          <div className="h-2 w-full bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 rounded-t-xl" />

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
              <Frown className="h-8 w-8 text-rose-500" />
            </div>
            <CardTitle className="text-2xl">
              {title || "Oops! Something went wrong"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {description || "We encountered an unexpected error. Don't worry, your data is safe."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error summary */}
            {error && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-start gap-3">
                  <Bug className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Error Details
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 break-words">
                      {error.message || "An unknown error occurred"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible technical details */}
            {(error?.stack || errorInfo?.componentStack) && (
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
                          <>
                            <span className="text-emerald-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto p-2 bg-background rounded-lg font-mono">
                      {error?.stack || "No stack trace available"}
                    </pre>
                    {errorInfo?.componentStack && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
                          Component Stack:
                        </p>
                        <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32 overflow-y-auto p-2 bg-background rounded-lg font-mono">
                          {errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Support info */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                Need help?
              </p>
              <p className="text-sm text-blue-700/70 dark:text-blue-300/70 mb-3">
                If this error persists, please contact our support team.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-blue-200 dark:border-blue-800 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                  asChild
                >
                  <a href="mailto:support@contentportal.com">
                    <Mail className="h-3 w-3 mr-1" />
                    support@contentportal.com
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-blue-200 dark:border-blue-800 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                  asChild
                >
                  <Link href="/dashboard/help">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Help Center
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="w-full sm:w-auto bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
            {onReport && (
              <Button
                variant="ghost"
                onClick={onReport}
                className="w-full sm:w-auto text-muted-foreground"
              >
                <Mail className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Additional help text */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Error ID: {Date.now().toString(36).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

/**
 * Simple inline error display for forms and small components
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Loading error state for async operations
 */
export function LoadingError({
  title = "Failed to load",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-rose-500" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        {description || "We couldn't load this content. Please try again."}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
